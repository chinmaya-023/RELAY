import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env, hasFirebaseTriggerEmailConfiguration } from '../config/env.js';
import { db, initializeFirebase } from '../firebase/admin.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RECENT_SIGN_IN_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const defaultCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (pepper, code) => createHash('sha256').update(`${pepper}:account-deletion:${code}`).digest('hex');

const queueEmail = async (message) => {
  db();
  return getFirestore().collection(env.firebase.triggerEmailCollection).add(message);
};

const deleteIdentity = async (uid) => {
  initializeFirebase();
  return getAuth().deleteUser(uid);
};

export class AccountDeletionService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.now = options.now ?? (() => Date.now());
    this.createCode = options.createCode ?? defaultCode;
    this.pepper = options.pepper ?? env.apiKeyPepper;
    this.isDeliveryConfigured = options.isDeliveryConfigured ?? hasFirebaseTriggerEmailConfiguration;
    this.queueEmail = options.queueEmail ?? queueEmail;
    this.deleteIdentity = options.deleteIdentity ?? deleteIdentity;
  }

  #assertReady(requireDelivery = false) {
    if (!this.pepper) throw new AppError(503, 'ACCOUNT_DELETION_UNAVAILABLE', 'Account deletion is temporarily unavailable. Please try again later.');
    if (requireDelivery && !this.isDeliveryConfigured) throw new AppError(503, 'ACCOUNT_DELETION_EMAIL_UNAVAILABLE', 'We cannot send a verification code right now. Please try again later.');
  }

  #assertRecentSignIn(user) {
    const authenticatedAt = Number(user.auth_time ?? 0) * 1000;
    if (!authenticatedAt || this.now() - authenticatedAt > RECENT_SIGN_IN_MS) {
      throw new AppError(403, 'ACCOUNT_DELETION_REAUTH_REQUIRED', 'For your security, sign out and sign in again before deleting your account.');
    }
  }

  #assertEmail(user, email) {
    if (!user.email || normalizeEmail(user.email) !== normalizeEmail(email)) {
      throw new AppError(400, 'ACCOUNT_DELETION_EMAIL_MISMATCH', 'Enter the email address for this signed-in account.');
    }
  }

  async request(user, input) {
    this.#assertReady(true);
    this.#assertRecentSignIn(user);
    this.#assertEmail(user, input.email);
    const timestamp = this.now();
    const code = this.createCode();
    const request = {
      email: normalizeEmail(user.email),
      codeHash: hashCode(this.pepper, code),
      createdAt: timestamp,
      expiresAt: timestamp + CODE_TTL_MS,
      cooldownUntil: timestamp + RESEND_COOLDOWN_MS,
      attempts: 0
    };
    let created;
    if (this.repository.createAccountDeletionRequest) {
      created = await this.repository.createAccountDeletionRequest(user.uid, request);
    } else {
      const existing = await this.repository.getAccountDeletionRequest(user.uid);
      if (existing?.cooldownUntil > timestamp) created = { created: false, request: existing };
      else {
        await this.repository.saveAccountDeletionRequest(user.uid, request);
        created = { created: true, request };
      }
    }
    if (!created.created) {
      if (created.request?.processing) {
        throw new AppError(409, 'ACCOUNT_DELETION_IN_PROGRESS', 'Account deletion is already being processed. Please wait a moment.');
      }
      const retryAfter = Math.max(1, Math.ceil((created.request?.cooldownUntil - timestamp) / 1000));
      throw new AppError(429, 'ACCOUNT_DELETION_CODE_COOLDOWN', 'Please wait before requesting another verification code.', { retryAfter });
    }
    try {
      await this.queueEmail({
        to: request.email,
        message: {
          subject: 'Confirm your Relay account deletion',
          text: `Use this verification code to permanently delete your Relay account: ${code}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.`
        }
      });
    } catch (error) {
      await this.repository.clearAccountDeletionRequest(user.uid);
      logger.error('account_deletion_code_delivery_failed', { uid: user.uid, code: error?.code ?? 'UNKNOWN' });
      throw new AppError(503, 'ACCOUNT_DELETION_EMAIL_UNAVAILABLE', 'We cannot send a verification code right now. Please try again later.');
    }
    return { expiresAt: request.expiresAt, cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000) };
  }

  async confirm(user, input) {
    this.#assertReady();
    this.#assertRecentSignIn(user);
    this.#assertEmail(user, input.email);
    const timestamp = this.now();
    const candidateHash = hashCode(this.pepper, input.code);
    if (this.repository.verifyAndClaimAccountDeletionRequest) {
      const result = await this.repository.verifyAndClaimAccountDeletionRequest(user.uid, candidateHash, timestamp, MAX_CODE_ATTEMPTS);
      if (result.status === 'IN_PROGRESS') throw new AppError(409, 'ACCOUNT_DELETION_IN_PROGRESS', 'Account deletion is already being processed. Please wait a moment.');
      if (result.status !== 'VALID') {
        throw new AppError(400, 'ACCOUNT_DELETION_CODE_INVALID', 'The verification code is invalid or expired. Request a new code.');
      }
    } else {
      const request = await this.repository.getAccountDeletionRequest(user.uid);
      if (!request || request.expiresAt <= timestamp || request.attempts >= MAX_CODE_ATTEMPTS) {
        if (request) await this.repository.clearAccountDeletionRequest(user.uid);
        throw new AppError(400, 'ACCOUNT_DELETION_CODE_INVALID', 'The verification code is invalid or expired. Request a new code.');
      }
      const expected = Buffer.from(request.codeHash, 'hex');
      const actual = Buffer.from(candidateHash, 'hex');
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
      if (!valid) {
        const attempts = request.attempts + 1;
        if (attempts >= MAX_CODE_ATTEMPTS) await this.repository.clearAccountDeletionRequest(user.uid);
        else await this.repository.saveAccountDeletionRequest(user.uid, { ...request, attempts });
        throw new AppError(400, 'ACCOUNT_DELETION_CODE_INVALID', 'The verification code is invalid or expired. Request a new code.');
      }
      const claimed = this.repository.claimAccountDeletionRequest
        ? await this.repository.claimAccountDeletionRequest(user.uid, timestamp)
        : { claimed: true, request };
      if (!claimed.claimed) throw new AppError(409, 'ACCOUNT_DELETION_IN_PROGRESS', 'Account deletion is already being processed. Please wait a moment.');
    }
    try {
      await this.repository.deleteAccountData(user.uid);
      await this.deleteIdentity(user.uid);
      await this.repository.clearAccountDeletionRequest(user.uid);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        await this.repository.clearAccountDeletionRequest(user.uid);
        return { deleted: true };
      }
      await this.repository.releaseAccountDeletionRequest?.(user.uid).catch((releaseError) => logger.error('account_deletion_release_failed', { uid: user.uid, code: releaseError?.code ?? 'UNKNOWN' }));
      logger.error('account_deletion_failed', { uid: user.uid, code: error?.code ?? 'UNKNOWN' });
      throw new AppError(503, 'ACCOUNT_DELETION_RETRY_REQUIRED', 'We could not complete account deletion. Please try again. If your code expires, request a new one.');
    }
    return { deleted: true };
  }
}
