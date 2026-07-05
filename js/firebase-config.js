// ================================================================
// FIREBASE CONFIG
// Ganti dengan config Firebase project kamu
// Cara dapet config:
// 1. Buka console.firebase.google.com
// 2. Buat project baru → "elektrons-2025"
// 3. Add Web App → copy config di bawah
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    onValue, 
    remove,
    update,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
    getStorage,
    ref as storageRef,
    uploadString,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ⚠️ GANTI INI DENGAN CONFIG FIREBASE KAMU
const STORAGE_KEY = 'elektrons_firebase_config';

function readStoredFirebaseConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

const firebaseConfig = window.ELEKTRONS_FIREBASE_CONFIG || readStoredFirebaseConfig();

if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error('Firebase config belum diisi dengan nilai yang valid. Set window.ELEKTRONS_FIREBASE_CONFIG di index.html.');
}

const app     = initializeApp(firebaseConfig);
const db      = getDatabase(app);
const storage = getStorage(app);
const auth    = getAuth(app);

async function ensureFirebaseAuth() {
    if (auth.currentUser) return auth.currentUser;
    try {
        const cred = await signInAnonymously(auth);
        return cred.user;
    } catch (err) {
        console.warn('Firebase auth belum siap:', err);
        return null;
    }
}

export { 
    db, storage, auth, ensureFirebaseAuth,
    ref, push, onValue, remove, update, serverTimestamp,
    storageRef, uploadString, getDownloadURL, deleteObject
};