import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB_nJPrZczKhbGSBeDicNUNYMr9dORoDj4",
  authDomain: "vvl-trip-accounts.firebaseapp.com",
  projectId: "vvl-trip-accounts",
  storageBucket: "vvl-trip-accounts.firebasestorage.app",
  messagingSenderId: "775557289196",
  appId: "1:775557289196:web:f40d2e811c4af21ea681c9",
  measurementId: "G-XM57XKGXK5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { collection, doc, setDoc, getDocs, deleteDoc, onSnapshot };
