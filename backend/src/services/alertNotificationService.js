import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env, hasFirebaseTriggerEmailConfiguration } from '../config/env.js';
import { db } from '../firebase/admin.js';
import { logger } from '../lib/logger.js';

const safeName = (value, fallback) => [...String(value ?? fallback)].filter((character) => {
  const codePoint = character.codePointAt(0);
  return codePoint >= 32 && codePoint !== 127;
}).join('').trim().slice(0, 100) || fallback;

const firebaseUser = async (uid) => {
  db();
  return getAuth().getUser(uid);
};

const queueFirebaseEmail = async (message) => {
  db();
  return getFirestore().collection(env.firebase.triggerEmailCollection).add(message);
};

export class AlertNotificationService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.getUser = options.getUser ?? firebaseUser;
    this.isDeliveryConfigured = options.isDeliveryConfigured ?? hasFirebaseTriggerEmailConfiguration;
    this.queueEmail = options.queueEmail ?? queueFirebaseEmail;
  }

  async notifyBackendDown({ backend, health, result, eventId }) {
    try {
      const project = await this.repository.get(`projects/${backend.projectId}`);
      const notification = await this.repository.createNotification(backend.projectId, {
        channel: 'EMAIL',
        type: 'BACKEND_DOWN',
        backendId: backend.id,
        eventId,
        status: 'PENDING'
      });

      if (!project?.ownerId) return this.#record(backend.projectId, notification.id, { status: 'SKIPPED_NO_OWNER' });

      let owner;
      try {
        owner = await this.getUser(project.ownerId);
      } catch {
        logger.error('alert_owner_lookup_failed', { projectId: backend.projectId, notificationId: notification.id });
        return this.#record(backend.projectId, notification.id, { status: 'DELIVERY_FAILED', failureCode: 'OWNER_LOOKUP_FAILED' });
      }

      if (!owner.email || !owner.emailVerified) {
        return this.#record(backend.projectId, notification.id, { status: 'SKIPPED_UNVERIFIED_EMAIL' });
      }

      if (!this.isDeliveryConfigured) {
        logger.warn('alert_email_not_configured', { projectId: backend.projectId, notificationId: notification.id });
        return this.#record(backend.projectId, notification.id, { status: 'NOT_CONFIGURED' });
      }

      const dispatch = await this.queueEmail({
        to: owner.email,
        message: {
          subject: `Relay alert: ${safeName(backend.name, 'A backend')} is unavailable`,
          text: [
            `Relay detected that ${safeName(backend.name, 'a backend')} is unavailable.`,
            `Project: ${safeName(project.name, 'Unnamed project')}`,
            `The health check did not recover after ${result.attempts ?? 1} attempt${(result.attempts ?? 1) === 1 ? '' : 's'}.`,
            `Relay recorded this after the monitor reached its configured failure threshold (${health.consecutiveFailures}).`,
            'Review the alert and backend health details in your Relay dashboard.'
          ].join('\n\n')
        }
      });
      logger.info('alert_email_queued', { projectId: backend.projectId, notificationId: notification.id });
      return this.#record(backend.projectId, notification.id, { status: 'QUEUED', dispatchId: dispatch.id, queuedAt: Date.now() });
    } catch {
      logger.error('alert_notification_failed', { projectId: backend.projectId, backendId: backend.id });
      return { status: 'DELIVERY_FAILED' };
    }
  }

  async #record(projectId, notificationId, input) {
    return this.repository.updateNotification(projectId, notificationId, input);
  }
}
