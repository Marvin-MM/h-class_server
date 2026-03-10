import admin from 'firebase-admin';
import type { AppConfig } from '../config/index.js';
import { logger } from '../shared/utils/logger.js';

/**
 * Initializes the Firebase Admin SDK for push notifications via FCM.
 * Returns the messaging instance for sending push notifications.
 */
export function initializeFirebase(config: AppConfig): admin.messaging.Messaging {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    logger.info('Firebase Admin SDK initialized');
  }

  return admin.messaging();
}
