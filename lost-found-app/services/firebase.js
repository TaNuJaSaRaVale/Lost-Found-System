import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth 
} from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDoc } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { LogBox } from 'react-native';

// Suppress expected offline and WebChannel transport warnings in development
LogBox.ignoreLogs([
  "Could not reach Cloud Firestore backend",
  "WebChannelConnection RPC 'Listen' stream",
  "Backend didn't respond within 10 seconds",
  "Missing or insufficient permissions"
]);

// Firebase project configuration, read from .env (see .env.example) or EAS environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// 1. App Singleton
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (e) {
  console.error("❌ Firebase Init Error:", e);
}

// 2. Auth Singleton
let _auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  _auth = getAuth(app);
}

// 3. Firestore Singleton
let _db;
try {
  _db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  _db = getFirestore(app);
}

export const auth = _auth;
export const db = _db;

// 4. Diagnostic Helper
export const testFirebaseConnection = async () => {
  try {
    const start = Date.now();
    // A simple, fast operation to check the network
    await getDoc(doc(_db, "_diagnostic", "test")); 
    return { success: true, latency: Date.now() - start };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export default app;


