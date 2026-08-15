import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { initializeFirebase } from '../firebase/admin.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const REQUEST_COOLDOWN_MS = 60 * 60 * 1000;
const RECENT_SIGN_IN_MS = 15 * 60 * 1000;
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
const deleteIdentity = async (uid) => {
  initializeFirebase();
  return getAuth().deleteUser(uid);
};
const publicStatus = (request) => ({ status: request?.status ?? 'NONE', requestedAt: request?.requestedAt ?? null, reviewedAt: request?.reviewedAt ?? null });

export class AccountDeletionService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.now = options.now ?? (() => Date.now());
    this.deleteIdentity = options.deleteIdentity ?? deleteIdentity;
    this.isRelayOwner = options.isRelayOwner ?? ((email) => env.adminEmails.includes(normalizeEmail(email)));
    this.invalidateProject = options.invalidateProject ?? (() => undefined);
  }

  #assertRecentSignIn(user) {
    const authenticatedAt = Number(user.auth_time ?? 0) * 1000;
    if (!authenticatedAt || this.now() - authenticatedAt > RECENT_SIGN_IN_MS) throw new AppError(403, 'ACCOUNT_DELETION_REAUTH_REQUIRED', 'For your security, sign out and sign in again before requesting account deletion.');
  }

  #assertEmail(user, email) {
    if (!user.email || normalizeEmail(user.email) !== normalizeEmail(email)) throw new AppError(400, 'ACCOUNT_DELETION_EMAIL_MISMATCH', 'Enter the email address for this signed-in account.');
  }

  async status(user) { return publicStatus(await this.repository.getAccountDeletionRequest(user.uid)); }

  async request(user, input) {
    this.#assertRecentSignIn(user);
    this.#assertEmail(user, input.email);
    if (this.isRelayOwner(user.email)) throw new AppError(403, 'RELAY_OWNER_DELETION_DENIED', 'Relay owner accounts cannot request deletion from their own account. Ask another Relay owner for assistance.');
    const timestamp = this.now();
    const request = {
      email: normalizeEmail(user.email),
      displayName: String(user.name ?? '').trim().slice(0, 80) || null,
      status: 'PENDING',
      requestedAt: timestamp,
      reviewedAt: null,
      reviewedBy: null,
      cooldownUntil: timestamp + REQUEST_COOLDOWN_MS
    };
    const created = await this.repository.createAccountDeletionRequest(user.uid, request);
    if (!created.created) {
      if (['PENDING', 'PROCESSING'].includes(created.request?.status)) return { ...publicStatus(created.request), alreadyRequested: true };
      const retryAfter = Math.max(1, Math.ceil(((created.request?.cooldownUntil ?? timestamp) - timestamp) / 1000));
      throw new AppError(429, 'ACCOUNT_DELETION_REQUEST_COOLDOWN', 'Please wait before submitting another account deletion request.', { retryAfter });
    }
    return publicStatus(request);
  }

  async review(uid, reviewer, decision) {
    if (uid === reviewer.uid) throw new AppError(400, 'RELAY_ADMIN_SELF_DELETION_DENIED', 'Relay owners cannot approve deletion of their own account.');
    const timestamp = this.now();
    if (decision === 'reject') {
      const result = await this.repository.rejectAccountDeletionRequest(uid, reviewer.uid, timestamp);
      if (!result.reviewed) throw new AppError(409, 'ACCOUNT_DELETION_REQUEST_UNAVAILABLE', 'This account deletion request is no longer pending.');
      return { status: 'REJECTED' };
    }
    const claim = await this.repository.claimAccountDeletionRequest(uid, reviewer.uid, timestamp);
    if (!claim.claimed) throw new AppError(409, 'ACCOUNT_DELETION_REQUEST_UNAVAILABLE', 'This account deletion request is no longer pending.');
    return this.#deleteApprovedAccount(uid, true);
  }

  async deleteDirectly(uid, reviewer) {
    if (uid === reviewer.uid) throw new AppError(400, 'RELAY_ADMIN_SELF_DELETION_DENIED', 'Relay owners cannot delete their own account.');
    return this.#deleteApprovedAccount(uid, false);
  }

  async #deleteApprovedAccount(uid, hasPendingRequest) {
    try {
      const projects = await this.repository.deleteAccountData(uid);
      await this.deleteIdentity(uid);
      for (const project of projects ?? []) this.invalidateProject(project.id);
      await this.repository.clearAccountDeletionRequest(uid);
      return { status: 'DELETED' };
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        await this.repository.clearAccountDeletionRequest(uid);
        return { status: 'DELETED' };
      }
      if (hasPendingRequest) await this.repository.releaseAccountDeletionRequest(uid).catch((releaseError) => logger.error('account_deletion_release_failed', { uid, code: releaseError?.code ?? 'UNKNOWN' }));
      logger.error('account_deletion_failed', { uid, code: error?.code ?? 'UNKNOWN' });
      throw new AppError(503, 'ACCOUNT_DELETION_RETRY_REQUIRED', hasPendingRequest ? 'Account deletion could not be completed. The request remains pending for review.' : 'Account deletion could not be completed. Please try again.');
    }
  }
}
