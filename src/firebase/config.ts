// Firebase project keys. Paste the values from the Firebase console here
// (Project settings -> Your apps -> Web app -> SDK setup and configuration).
// These keys are not secret: they only say which project the app talks to.
// Who may read and write is decided by firestore.rules.
//
// While projectId is empty the app runs in local mode: everything stays in
// this browser and nothing is sent anywhere.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** True when cloud sync is switched on (keys filled in, and not the embed preview). */
export const CLOUD = import.meta.env.VITE_EMBED !== '1' && !!firebaseConfig.projectId;
