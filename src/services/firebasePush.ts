import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { db, firebaseApp } from '../lib/firebase';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

async function tokenDocumentId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function currentToken(): Promise<{ token: string }> {
  if (!firebaseApp || !db) throw new Error('Connect Firebase before enabling browser push notifications.');
  if (!vapidKey) throw new Error('Add VITE_FIREBASE_VAPID_KEY to .env.local before enabling browser push.');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('This browser does not support web push notifications.');
  if (!(await isSupported())) throw new Error('Firebase Messaging is not supported in this browser.');

  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Firebase did not return a browser notification token.');
  return { token };
}

export async function registerBrowserPush(patientId: string, uid: string): Promise<void> {
  const { token } = await currentToken();
  if (!db) throw new Error('Firestore is not configured.');
  const tokenId = await tokenDocumentId(token);
  await setDoc(doc(db, 'fcmTokens', tokenId), { patientId, uid, token, updatedAt: serverTimestamp() });
}

export async function unregisterBrowserPush(): Promise<void> {
  if (!db || !firebaseApp || !vapidKey || !('serviceWorker' in navigator) || !(await isSupported())) return;
  const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  if (!registration) return;
  const permission = 'Notification' in window ? Notification.permission : 'denied';
  if (permission !== 'granted') return;
  const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
  if (token) await deleteDoc(doc(db, 'fcmTokens', await tokenDocumentId(token)));
}
