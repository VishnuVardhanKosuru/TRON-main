// Firebase app initialization — imported once, reused everywhere
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForStaticBuildPrerender",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "second-brain.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "second-brain",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "second-brain.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:abcdef",
};

// Prevent re-initializing on hot reload in dev
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const db             = getFirestore(app);
export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
