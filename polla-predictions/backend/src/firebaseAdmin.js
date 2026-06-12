import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (serviceAccountBase64) {
  const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
  admin.initializeApp({
    credential: admin.cert(serviceAccount)
  });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.applicationDefault()
  });
} else {
  throw new Error('Firebase admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_BASE64 or GOOGLE_APPLICATION_CREDENTIALS.');
}

export const firebaseAuth = getAuth();
export const db = getFirestore();
