import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ALLOWED_EMAIL_DOMAINS, GOOGLE_WEB_CLIENT_ID } from '../constants/config';
import { isAllowedEmail } from '../utils/format';

let GoogleSignin: any = null;
let statusCodes: any = {};

try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
} catch {
  // Native module is missing in Expo Go; Google sign-in needs a dev/production build.
}

export class GoogleSignInCancelled extends Error {}

/** Signs in with Google and makes sure a Firestore profile exists. New accounts are always standard users. */
export async function signInWithGoogle(extraProfile: Record<string, any> = {}) {
  if (!GoogleSignin) {
    throw new Error('Google Sign-In needs the installed app (it is not available in Expo Go).');
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result?.type === 'cancelled') throw new GoogleSignInCancelled();
    const idToken = result?.data?.idToken || result?.idToken;
    if (!idToken) throw new Error('Google did not return a sign-in token. Please try again.');

    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));

    if (!isAllowedEmail(user.email || '', ALLOWED_EMAIL_DOMAINS)) {
      await GoogleSignin.signOut().catch(() => {});
      await signOut(auth);
      throw new Error(`Please use your campus Google account (${ALLOWED_EMAIL_DOMAINS.join(', ')}).`);
    }

    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: user.displayName || 'Student',
        email: user.email || '',
        studentClass: '',
        ...extraProfile,
        role: 'user',
        status: 'active',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error: any) {
    if (error instanceof GoogleSignInCancelled || error?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCancelled();
    }
    if (error?.code === statusCodes.IN_PROGRESS) throw new GoogleSignInCancelled();
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is missing or out of date on this device.');
    }
    // Android DEVELOPER_ERROR: this build's signing SHA-1 isn't registered in Firebase.
    if (String(error?.code) === '10' || /DEVELOPER_ERROR/.test(String(error?.message))) {
      throw new Error('Google Sign-In is not set up for this build yet. Add the app\'s SHA-1 fingerprint in Firebase (see LAUNCH_GUIDE.md), or use email login.');
    }
    throw error;
  }
}
