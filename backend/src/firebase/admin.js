import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { env, hasFirebaseConfiguration } from '../config/env.js';
import { AppError } from '../lib/errors.js';

let database;

export const initializeFirebase = () => {
  if (database) return database;
  if (!hasFirebaseConfiguration) throw new AppError(503, 'SERVICE_NOT_CONFIGURED', 'The account service is not configured.');
  const credential = env.firebase.clientEmail && env.firebase.privateKey
    ? cert({ projectId: env.firebase.projectId, clientEmail: env.firebase.clientEmail, privateKey: env.firebase.privateKey })
    : undefined;
  const app = getApps()[0] ?? initializeApp({ projectId: env.firebase.projectId, databaseURL: env.firebase.databaseURL, ...(credential ? { credential } : {}) });
  database = getDatabase(app);
  return database;
};

export const db = () => initializeFirebase();
