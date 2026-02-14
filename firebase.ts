
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwwF1nwJlIIP62Nym8tV8RZCV5k8uglYQ",
  authDomain: "my-app-a2a1a.firebaseapp.com",
  projectId: "my-app-a2a1a",
  storageBucket: "my-app-a2a1a.firebasestorage.app",
  messagingSenderId: "175874937978",
  appId: "1:175874937978:web:7f02eb186dfe58e8d897c3",
  measurementId: "G-YQVNRDNMRC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Analytics only if supported/in window context
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
