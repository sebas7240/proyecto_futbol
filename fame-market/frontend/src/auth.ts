import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  FirebaseAuthentication,
  type User as NativeUser
} from '@capacitor-firebase/authentication';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const missingFirebaseConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
export const firebaseReady = missingFirebaseConfigKeys.length === 0;

const app = firebaseReady ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
auth?.useDeviceLanguage();

export type AuthUser = Pick<User, 'uid' | 'email' | 'displayName'>;

function isNativeAuthPlatform() {
  return Capacitor.isNativePlatform();
}

function normalizeNativeUser(user: NativeUser | null | undefined): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  };
}

function readableAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';

  if (
    message.includes('Default FirebaseApp is not initialized') ||
    message.includes('google-services.json') ||
    message.includes('google_app_id') ||
    code.includes('configuration')
  ) {
    return new Error(
      'El login nativo de Android necesita agregar la app Android en Firebase y descargar google-services.json para com.fameplays.app.'
    );
  }

  return error instanceof Error
    ? error
    : new Error(message || 'No se pudo iniciar sesion con Google.');
}

export function subscribeToAuth(callback: (user: AuthUser | null) => void) {
  if (isNativeAuthPlatform()) {
    let active = true;
    let listener: { remove: () => Promise<void> } | null = null;

    FirebaseAuthentication.getCurrentUser()
      .then((result) => {
        if (active) callback(normalizeNativeUser(result.user));
      })
      .catch(() => {
        if (active) callback(null);
      });

    FirebaseAuthentication.addListener('authStateChange', (event) => {
      callback(normalizeNativeUser(event.user));
    })
      .then((handle) => {
        listener = handle;
      })
      .catch(() => undefined);

    return () => {
      active = false;
      void listener?.remove();
    };
  }

  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  if (isNativeAuthPlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: true
      });
      const user = normalizeNativeUser(result.user);
      if (!user) throw new Error('Google no devolvio una sesion valida.');
      return user;
    } catch (error) {
      throw readableAuthError(error);
    }
  }

  if (!auth) {
    throw new Error(
      `Falta configuracion de Firebase: ${missingFirebaseConfigKeys.join(', ')}.`
    );
  }
  try {
    return (await signInWithPopup(auth, googleProvider)).user;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw readableAuthError(error);
  }
}

export async function logout() {
  if (isNativeAuthPlatform()) {
    await FirebaseAuthentication.signOut();
    return;
  }
  if (auth) await signOut(auth);
}

export async function currentIdToken() {
  if (isNativeAuthPlatform()) {
    try {
      return (await FirebaseAuthentication.getIdToken({ forceRefresh: false })).token;
    } catch {
      return null;
    }
  }
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}
