/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Workspace OAuth Scopes
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export const googleAuthProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});
// Request offline access if needed and prompt for consent
googleAuthProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

// Flag to track sign-in state
let isSigningIn = false;
// In-memory token cache (never in localStorage per security guidelines)
let cachedAccessToken: string | null = null;

/**
 * Validates connection to Firestore at initial boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline or network restricted.');
      return false;
    }
    // Expected if document doesn't exist, but connection succeeded
    return true;
  }
}

/**
 * Initialize Auth State Listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

/**
 * Sign in with Google Popup
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      // Sometimes existing tokens can be retrieved or fall back to ID token
      console.warn('No OAuth access token directly in credential, requesting token');
    }

    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Firestore Persistence Helpers for Visualizer Presets and Workspace Notes
 */
export interface StoredPreset {
  id: string;
  userId: string;
  name: string;
  theme: string;
  visualizerMode: string;
  effectIntensity: number;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredWorkspaceNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  source: 'google-docs' | 'google-slides' | 'keep-note' | 'custom';
  sourceId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function savePresetToFirestore(
  userId: string,
  preset: Omit<StoredPreset, 'userId' | 'createdAt' | 'updatedAt'>
) {
  const presetRef = doc(db, 'users', userId, 'presets', preset.id);
  const now = new Date().toISOString();
  await setDoc(presetRef, {
    ...preset,
    userId,
    updatedAt: now,
    createdAt: now,
  });
}

export async function getPresetsFromFirestore(userId: string): Promise<StoredPreset[]> {
  try {
    const colRef = collection(db, 'users', userId, 'presets');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((docSnap) => docSnap.data() as StoredPreset);
  } catch (err) {
    console.error('Failed to load presets from Firestore:', err);
    return [];
  }
}

export async function saveWorkspaceNoteToFirestore(
  userId: string,
  note: Omit<StoredWorkspaceNote, 'userId' | 'createdAt' | 'updatedAt'>
) {
  const noteRef = doc(db, 'users', userId, 'workspaceNotes', note.id);
  const now = new Date().toISOString();
  await setDoc(noteRef, {
    ...note,
    userId,
    updatedAt: now,
    createdAt: now,
  });
}

export async function getWorkspaceNotesFromFirestore(userId: string): Promise<StoredWorkspaceNote[]> {
  try {
    const colRef = collection(db, 'users', userId, 'workspaceNotes');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((docSnap) => docSnap.data() as StoredWorkspaceNote);
  } catch (err) {
    console.error('Failed to load notes from Firestore:', err);
    return [];
  }
}

export async function deleteWorkspaceNoteFromFirestore(userId: string, noteId: string) {
  const noteRef = doc(db, 'users', userId, 'workspaceNotes', noteId);
  await deleteDoc(noteRef);
}
