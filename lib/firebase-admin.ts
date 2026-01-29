// lib/firebase-admin.ts
// For use in serverless functions (api/ folder)

import * as admin from "firebase-admin";

// Initialize Firebase Admin (only once)
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const adminDb = admin.firestore();

export { adminDb, admin };

