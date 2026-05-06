import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAaxaIqm9HQUyvvjl5RGUxNDGwuf1HgtaE",
  authDomain: "central-go-9f8fe.firebaseapp.com",
  databaseURL: "https://central-go-9f8fe-default-rtdb.firebaseio.com",
  projectId: "central-go-9f8fe",
  storageBucket: "central-go-9f8fe.firebasestorage.app",
  messagingSenderId: "394563648766",
  appId: "1:394563648766:web:f610857a41ca22004339af",
  measurementId: "G-63G4RFG361",
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export async function getFirebaseMessaging() {
  try {
    const supported = await isSupported();

    if (!supported) {
      console.warn("[push] Firebase Messaging no es soportado en este navegador.");
      return null;
    }

    return getMessaging(firebaseApp);
  } catch (error) {
    console.warn("[push] No se pudo inicializar Firebase Messaging:", error);
    return null;
  }
}