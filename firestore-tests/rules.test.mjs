/**
 * Security rules tests (Firestore + Storage) against the local emulators.
 * Run: npm test   (starts the emulators for the `demo-belto` project — no cloud access)
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getMetadata, ref, uploadBytes } from 'firebase/storage';

const MB = 1024 * 1024;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-belto',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
    storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

const alice = () => env.authenticatedContext('alice');
const bob = () => env.authenticatedContext('bob');
const anon = () => env.unauthenticatedContext();

async function seed(work) {
  await env.withSecurityRulesDisabled(async (ctx) => work(ctx.firestore(), ctx.storage()));
}

describe('firestore: users/{uid} profile', () => {
  test('owner creates and updates a valid profile', async () => {
    const db = alice().firestore();
    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), {
        locale: 'en',
        goal: 'pet',
        genres: ['pop', 'kpop'],
        onboardingVariant: 'a',
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { locale: 'tr', goal: null }));
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
  });

  test('other users and signed-out clients cannot read or write it (IDOR)', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), { locale: 'en' }));
    await assertFails(getDoc(doc(bob().firestore(), 'users/alice')));
    await assertFails(setDoc(doc(bob().firestore(), 'users/alice'), { locale: 'de' }));
    await assertFails(getDoc(doc(anon().firestore(), 'users/alice')));
    await assertFails(setDoc(doc(anon().firestore(), 'users/alice'), { locale: 'de' }));
  });

  test('unknown fields, bad values and client timestamps are rejected', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice'), { locale: 'en', isPro: true }));
    await assertFails(setDoc(doc(db, 'users/alice'), { locale: 'en', balance: 9999 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { goal: 'hacker' }));
    await assertFails(setDoc(doc(db, 'users/alice'), { genres: ['pop', 'metal'] }));
    await assertFails(setDoc(doc(db, 'users/alice'), { locale: 'x'.repeat(36) }));
    await assertFails(setDoc(doc(db, 'users/alice'), { createdAt: new Date('2020-01-01') }));
  });

  test('createdAt never changes after creation; profiles cannot be deleted by the client', async () => {
    const db = alice().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice'), { locale: 'en', createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { createdAt: new Date('2020-01-01') }));
    await assertFails(deleteDoc(doc(db, 'users/alice')));
  });
});

describe('firestore: devices', () => {
  const device = () => ({ token: 'fcm-token-123', platform: 'ios', topics: ['renders'], updatedAt: serverTimestamp() });

  test('owner registers, reads and removes own devices', async () => {
    const db = alice().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/devices/d1'), device()));
    await assertSucceeds(getDocs(collection(db, 'users/alice/devices')));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/devices/d1')));
  });

  test('shape is enforced and other users are denied', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), platform: 'windows' }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), admin: true }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), updatedAt: new Date() }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { platform: 'ios', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(bob().firestore(), 'users/alice/devices/d1'), device()));
    await assertFails(getDocs(collection(bob().firestore(), 'users/alice/devices')));
  });
});

describe('firestore: server-written collections', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/alice/private/wallet'), { balance: 40, freePosterTokens: 0, hdBoostTokens: 0, previewUsed: false, updatedAt: 1 });
      await setDoc(doc(db, 'users/alice/private/entitlement'), { pro: false });
      await setDoc(doc(db, 'users/alice/renders/r1'), { id: 'r1', status: 'queued' });
      await setDoc(doc(db, 'users/alice/ledger/l1'), { delta: 40, reason: 'wheel_prize', refId: 'credits40', createdAt: 1 });
      await setDoc(doc(db, 'users/alice/requests/k1'), { kind: 'createPoster', status: 'done' });
      await setDoc(doc(db, 'users/alice/renders_private/r1'), { requestId: 'fal-req' });
      await setDoc(doc(db, 'users/alice/rc_events/e1'), { type: 'RENEWAL' });
      await setDoc(doc(db, 'config/wheel'), { weights: { credits40: 1 } });
    });
  });

  test('owner can read wallet, entitlement, renders and ledger', async () => {
    const db = alice().firestore();
    await assertSucceeds(getDoc(doc(db, 'users/alice/private/wallet')));
    await assertSucceeds(getDoc(doc(db, 'users/alice/private/entitlement')));
    await assertSucceeds(getDocs(collection(db, 'users/alice/renders')));
    await assertSucceeds(getDocs(collection(db, 'users/alice/ledger')));
  });

  test('owner can never write them (no client isPro, no free credits)', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice/private/wallet'), { balance: 99999 }));
    await assertFails(updateDoc(doc(db, 'users/alice/private/wallet'), { balance: 99999 }));
    await assertFails(setDoc(doc(db, 'users/alice/private/entitlement'), { pro: true }));
    await assertFails(setDoc(doc(db, 'users/alice/private/consent'), { version: 1 }));
    await assertFails(updateDoc(doc(db, 'users/alice/renders/r1'), { status: 'succeeded' }));
    await assertFails(setDoc(doc(db, 'users/alice/ledger/l2'), { delta: 500 }));
    await assertFails(deleteDoc(doc(db, 'users/alice/renders/r1')));
  });

  test('provider state, idempotency records, RC events and config are invisible to clients', async () => {
    const db = alice().firestore();
    await assertFails(getDoc(doc(db, 'users/alice/requests/k1')));
    await assertFails(getDoc(doc(db, 'users/alice/renders_private/r1')));
    await assertFails(getDoc(doc(db, 'users/alice/rc_events/e1')));
    await assertFails(getDoc(doc(db, 'config/wheel')));
    await assertFails(setDoc(doc(db, 'config/wheel'), { weights: { credits40: 1000 } }));
  });

  test('other users cannot read any of alice\'s data (IDOR)', async () => {
    const db = bob().firestore();
    await assertFails(getDoc(doc(db, 'users/alice/private/wallet')));
    await assertFails(getDocs(collection(db, 'users/alice/renders')));
    await assertFails(getDocs(collection(db, 'users/alice/ledger')));
  });
});

describe('storage', () => {
  const bytes = (n) => new Uint8Array(n);

  test('owner uploads a photo or recording within type and size limits', async () => {
    const storage = alice().storage();
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/photo.jpg'), bytes(1024), { contentType: 'image/jpeg' }));
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/rec.m4a'), bytes(1024), { contentType: 'audio/mp4' }));
    await assertSucceeds(getMetadata(ref(storage, 'uploads/alice/photo.jpg')));
  });

  test('wrong types, oversize files and odd names are rejected', async () => {
    const storage = alice().storage();
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/p.heic'), bytes(1024), { contentType: 'image/heic' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/x.svg'), bytes(1024), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/app.bin'), bytes(1024), { contentType: 'application/octet-stream' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/big.jpg'), bytes(10 * MB + 1), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/big.m4a'), bytes(8 * MB + 1), { contentType: 'audio/mp4' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/sp ace.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/nested/p.jpg'), bytes(10), { contentType: 'image/jpeg' }));
  });

  test('other users cannot upload into or read my uploads (IDOR)', async () => {
    await seed((_db, storage) => uploadBytes(ref(storage, 'uploads/alice/photo.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(bob().storage(), 'uploads/alice/evil.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(getMetadata(ref(bob().storage(), 'uploads/alice/photo.jpg')));
    await assertFails(getMetadata(ref(anon().storage(), 'uploads/alice/photo.jpg')));
  });

  test('generated media is owner-readable and never client-writable', async () => {
    await seed(async (_db, storage) => {
      for (const path of ['posters/alice/p.png', 'voices/alice/v.mp3', 'songs/alice/s.mp3', 'renders/alice/r.mp4', 'tmp/alice/r.mp3']) {
        await uploadBytes(ref(storage, path), bytes(10), { contentType: 'application/octet-stream' });
      }
    });
    const storage = alice().storage();
    for (const path of ['posters/alice/p.png', 'voices/alice/v.mp3', 'songs/alice/s.mp3', 'renders/alice/r.mp4']) {
      await assertSucceeds(getMetadata(ref(storage, path)));
      await assertFails(getMetadata(ref(bob().storage(), path)));
    }
    await assertFails(getMetadata(ref(storage, 'tmp/alice/r.mp3')));
    await assertFails(uploadBytes(ref(storage, 'posters/alice/fake.png'), bytes(10), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage, 'renders/alice/fake.mp4'), bytes(10), { contentType: 'video/mp4' }));
  });

  test('catalog audio is readable by any signed-in user only', async () => {
    await seed((_db, storage) => uploadBytes(ref(storage, 'catalog/songs/main-character.mp3'), bytes(10), { contentType: 'audio/mpeg' }));
    await assertSucceeds(getMetadata(ref(bob().storage(), 'catalog/songs/main-character.mp3')));
    await assertFails(getMetadata(ref(anon().storage(), 'catalog/songs/main-character.mp3')));
    await assertFails(uploadBytes(ref(alice().storage(), 'catalog/songs/x.mp3'), bytes(10), { contentType: 'audio/mpeg' }));
  });
});
