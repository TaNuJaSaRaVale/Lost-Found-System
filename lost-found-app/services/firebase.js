import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth 
} from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore
} from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDU9oto_VjZq4pe0v1-G1MYeC-xZC4KPtk",
  authDomain: "lost-found-system-e745e.firebaseapp.com",
  projectId: "lost-found-system-e745e",
  storageBucket: "lost-found-system-e745e.firebasestorage.app",
  messagingSenderId: "145937489025",
  appId: "1:145937489025:web:5ca6e8d00cbef815c04180"
};

// 1. App Singleton
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("🔥 Firebase Initialized successfully");
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
  console.log("🔐 Auth Persistence initialized");
} catch (e) {
  _auth = getAuth(app);
}

// 3. Firestore Singleton
let _db;
try {
  _db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false, // More stable for some mobile networks
  });
  console.log("📦 Firestore Initialized (Long Polling: ON)");
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


