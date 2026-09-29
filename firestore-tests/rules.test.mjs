/**
 * Security rules tests (Firestore + Storage) against the local emulators.
 * Run: npm test   (starts the emulators for the `demo-kok` project — no cloud access)
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getBytes, getMetadata, ref, uploadBytes } from 'firebase/storage';

const MB = 1024 * 1024;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kok',
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
      setDoc(doc(db, 'users/alice'), { locale: 'tr', goal: 'crown', stage: 'done', onboardingVariant: 'a', createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { locale: 'ar', goal: null, stage: 'planned' }));
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
  });

  test('other users and signed-out clients cannot read or write it (IDOR)', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), { locale: 'en' }));
    await assertFails(getDoc(doc(bob().firestore(), 'users/alice')));
    await assertFails(setDoc(doc(bob().firestore(), 'users/alice'), { locale: 'de' }));
    await assertFails(updateDoc(doc(bob().firestore(), 'users/alice'), { locale: 'de' }));
    await assertFails(deleteDoc(doc(bob().firestore(), 'users/alice')));
    await assertFails(getDoc(doc(anon().firestore(), 'users/alice')));
    await assertFails(setDoc(doc(anon().firestore(), 'users/alice'), { locale: 'de' }));
  });

  test('money/entitlement fields, bad values and client timestamps are rejected', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice'), { locale: 'en', isPro: true }));
    await assertFails(setDoc(doc(db, 'users/alice'), { locale: 'en', balance: 9999 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { goal: 'nose' }));
    await assertFails(setDoc(doc(db, 'users/alice'), { stage: 'healed' }));
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
  const device = () => ({ token: 'fcm-token-123', platform: 'ios', topics: ['offers'], locale: 'tr', updatedAt: serverTimestamp() });

  test('owner registers, reads and removes own devices', async () => {
    const db = alice().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/devices/d1'), device()));
    await assertSucceeds(setDoc(doc(db, 'users/alice/devices/d2'), { ...device(), topics: [] }));
    await assertSucceeds(getDocs(collection(db, 'users/alice/devices')));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/devices/d1')));
  });

  test('shape is enforced and other users are denied (IDOR)', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), platform: 'windows' }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), admin: true }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), topics: ['everything'] }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { ...device(), updatedAt: new Date() }));
    await assertFails(setDoc(doc(db, 'users/alice/devices/d1'), { platform: 'ios', updatedAt: serverTimestamp() }));
    await seed((sdb) => setDoc(doc(sdb, 'users/alice/devices/d9'), { token: 't', platform: 'ios', updatedAt: 1 }));
    await assertFails(setDoc(doc(bob().firestore(), 'users/alice/devices/d1'), device()));
    await assertFails(getDocs(collection(bob().firestore(), 'users/alice/devices')));
    await assertFails(deleteDoc(doc(bob().firestore(), 'users/alice/devices/d9')));
  });
});

describe('firestore: server-written collections', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/alice/private/wallet'), { balance: 12, freeHighTokens: 0, previewUsed: false, updatedAt: 1 });
      await setDoc(doc(db, 'users/alice/private/gift'), { prizeId: 'credits5', segmentIndex: 2, spunAt: 1, expiresAt: 2, redeemedAt: 1 });
      await setDoc(doc(db, 'users/alice/private/consent'), { version: 1, acceptedAt: 1 });
      await setDoc(doc(db, 'users/alice/private/entitlement'), { pro: false });
      await setDoc(doc(db, 'users/alice/previews/p1'), { id: 'p1', status: 'succeeded', chargedCredits: 1 });
      await setDoc(doc(db, 'users/alice/ledger/l1'), { delta: 12, reason: 'plan_allowance', refId: 'rc:e1', createdAt: 1 });
      await setDoc(doc(db, 'users/alice/requests/k1'), { kind: 'createPreview', status: 'done' });
      await setDoc(doc(db, 'users/alice/previews_private/p1'), { requestId: 'fal-req' });
      await setDoc(doc(db, 'users/alice/rc_events/e1'), { type: 'RENEWAL' });
      await setDoc(doc(db, 'cohortMembers/alice'), { procedureDate: '2026-09-01', goal: 'crown', kind: 'transplant', joinedAt: 1 });
      await setDoc(doc(db, 'reports/r1'), { uid: 'alice', previewId: 'p1', reason: 'unsafe' });
      await setDoc(doc(db, 'config/runtime'), { generationEnabled: true });
      await setDoc(doc(db, 'config/wheel'), { weights: { credits10: 1 } });
    });
  });

  test('owner can read wallet, gift, consent, entitlement, previews and ledger', async () => {
    const db = alice().firestore();
    for (const path of ['users/alice/private/wallet', 'users/alice/private/gift', 'users/alice/private/consent', 'users/alice/private/entitlement', 'users/alice/previews/p1']) {
      await assertSucceeds(getDoc(doc(db, path)));
    }
    await assertSucceeds(getDocs(collection(db, 'users/alice/previews')));
    await assertSucceeds(getDocs(collection(db, 'users/alice/ledger')));
  });

  test('owner can never write them (no client isPro, no free credits, no fake result)', async () => {
    const db = alice().firestore();
    await assertFails(setDoc(doc(db, 'users/alice/private/wallet'), { balance: 99999 }));
    await assertFails(updateDoc(doc(db, 'users/alice/private/wallet'), { balance: 99999 }));
    await assertFails(updateDoc(doc(db, 'users/alice/private/wallet'), { previewUsed: false }));
    await assertFails(updateDoc(doc(db, 'users/alice/private/gift'), { redeemedAt: null }));
    await assertFails(setDoc(doc(db, 'users/alice/private/entitlement'), { pro: true }));
    await assertFails(setDoc(doc(db, 'users/alice/private/consent'), { version: 99 }));
    await assertFails(setDoc(doc(db, 'users/alice/previews/p2'), { id: 'p2', status: 'succeeded' }));
    await assertFails(updateDoc(doc(db, 'users/alice/previews/p1'), { status: 'failed' }));
    await assertFails(deleteDoc(doc(db, 'users/alice/previews/p1')));
    await assertFails(setDoc(doc(db, 'users/alice/ledger/l2'), { delta: 500 }));
    await assertFails(getDocs(collection(db, 'users/alice/private'))); // listing the private folder is not allowed
  });

  test('provider state, idempotency records, RC events, cohort, reports and config are invisible to clients', async () => {
    const db = alice().firestore();
    await assertFails(getDoc(doc(db, 'users/alice/requests/k1')));
    await assertFails(getDoc(doc(db, 'users/alice/previews_private/p1')));
    await assertFails(getDoc(doc(db, 'users/alice/rc_events/e1')));
    await assertFails(getDoc(doc(db, 'cohortMembers/alice')));
    await assertFails(getDocs(collection(db, 'cohortMembers')));
    await assertFails(setDoc(doc(db, 'cohortMembers/alice'), { procedureDate: '2026-09-01', goal: 'crown', kind: 'prp', joinedAt: 1 }));
    await assertFails(getDoc(doc(db, 'reports/r1')));
    await assertFails(setDoc(doc(db, 'reports/r2'), { uid: 'alice', previewId: 'p1', reason: 'other' }));
    await assertFails(getDoc(doc(db, 'config/runtime')));
    await assertFails(setDoc(doc(db, 'config/runtime'), { generationEnabled: true, imageModelQueueURL: 'https://evil.example/x' }));
    await assertFails(setDoc(doc(db, 'config/wheel'), { weights: { credits10: 1000 } }));
  });

  test('another user cannot read, update or delete alice\'s wallet, gift, previews or ledger (IDOR)', async () => {
    const db = bob().firestore();
    for (const path of ['users/alice/private/wallet', 'users/alice/private/gift', 'users/alice/private/consent', 'users/alice/private/entitlement', 'users/alice/previews/p1']) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(db, path), { hacked: true }));
      await assertFails(setDoc(doc(db, path), { hacked: true }));
      await assertFails(deleteDoc(doc(db, path)));
    }
    await assertFails(getDocs(collection(db, 'users/alice/previews')));
    await assertFails(getDocs(collection(db, 'users/alice/ledger')));
    const signedOut = anon().firestore();
    await assertFails(getDoc(doc(signedOut, 'users/alice/private/wallet')));
    await assertFails(getDocs(collection(signedOut, 'users/alice/previews')));
  });
});

describe('storage', () => {
  const bytes = (n) => new Uint8Array(n);

  test('owner uploads a selfie within type, size and name limits, then reads and deletes it', async () => {
    const storage = alice().storage();
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/8a6f2c1e-4b3d-4e5f-9a7b-1c2d3e4f5a6b.jpg'), bytes(1024), { contentType: 'image/jpeg' }));
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/photo.png'), bytes(1024), { contentType: 'image/png' }));
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/photo.heic'), bytes(1024), { contentType: 'image/heic' }));
    await assertSucceeds(getMetadata(ref(storage, 'uploads/alice/photo.png')));
    await assertSucceeds(deleteObject(ref(storage, 'uploads/alice/photo.png')));
  });

  test('wrong types, oversize files, odd names, nesting and overwrites are rejected', async () => {
    const storage = alice().storage();
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/x.svg'), bytes(1024), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/x.jpg'), bytes(1024), { contentType: 'application/octet-stream' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/x.mp4'), bytes(1024), { contentType: 'video/mp4' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/x.gif'), bytes(1024), { contentType: 'image/gif' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/big.jpg'), bytes(10 * MB + 1), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/empty.jpg'), bytes(0), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/sp ace.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/a.b.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/nested/p.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertSucceeds(uploadBytes(ref(storage, 'uploads/alice/once.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'uploads/alice/once.jpg'), bytes(20), { contentType: 'image/jpeg' }));
  });

  test('other users cannot upload into, read or delete my uploads (IDOR)', async () => {
    await seed((_db, storage) => uploadBytes(ref(storage, 'uploads/alice/photo.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(bob().storage(), 'uploads/alice/evil.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(getMetadata(ref(bob().storage(), 'uploads/alice/photo.jpg')));
    await assertFails(getBytes(ref(bob().storage(), 'uploads/alice/photo.jpg')));
    await assertFails(deleteObject(ref(bob().storage(), 'uploads/alice/photo.jpg')));
    await assertFails(getMetadata(ref(anon().storage(), 'uploads/alice/photo.jpg')));
    await assertFails(uploadBytes(ref(anon().storage(), 'uploads/alice/x.jpg'), bytes(10), { contentType: 'image/jpeg' }));
  });

  test('preview results are owner-readable and never client-writable or deletable', async () => {
    await seed((_db, storage) => uploadBytes(ref(storage, 'users/alice/previews/p1.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    const storage = alice().storage();
    await assertSucceeds(getMetadata(ref(storage, 'users/alice/previews/p1.jpg')));
    await assertFails(uploadBytes(ref(storage, 'users/alice/previews/fake.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'users/alice/previews/p1.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(deleteObject(ref(storage, 'users/alice/previews/p1.jpg')));
    // IDOR
    await assertFails(getMetadata(ref(bob().storage(), 'users/alice/previews/p1.jpg')));
    await assertFails(getBytes(ref(bob().storage(), 'users/alice/previews/p1.jpg')));
    await assertFails(deleteObject(ref(bob().storage(), 'users/alice/previews/p1.jpg')));
    await assertFails(getMetadata(ref(anon().storage(), 'users/alice/previews/p1.jpg')));
  });

  test('everything outside the two known prefixes is denied', async () => {
    await seed((_db, storage) => uploadBytes(ref(storage, 'catalog/x.jpg'), bytes(10), { contentType: 'image/jpeg' }));
    await assertFails(getMetadata(ref(alice().storage(), 'catalog/x.jpg')));
    await assertFails(uploadBytes(ref(alice().storage(), 'renders/alice/x.mp4'), bytes(10), { contentType: 'video/mp4' }));
    await assertFails(uploadBytes(ref(alice().storage(), 'users/alice/other.jpg'), bytes(10), { contentType: 'image/jpeg' }));
  });
});
