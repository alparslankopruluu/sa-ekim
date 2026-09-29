/** Single Admin SDK initialization shared by every function. */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

if (getApps().length === 0) initializeApp();

export const db = () => getFirestore();
export const bucket = () => getStorage().bucket();
export const auth = () => getAuth();
export const messaging = () => getMessaging();
export const functionsAdmin = () => getFunctions();
