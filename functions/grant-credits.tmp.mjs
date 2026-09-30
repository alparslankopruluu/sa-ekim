// One-off admin grant. Usage: node grant-credits.tmp.mjs <email> <credits> [--apply]
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const [email, amountRaw, flag] = process.argv.slice(2);
const amount = Number(amountRaw);
if (!email || !Number.isInteger(amount) || amount <= 0) throw new Error('bad args');
initializeApp({ credential: applicationDefault(), projectId: 'kok-prod' });
const db = getFirestore();
const user = await getAuth().getUserByEmail(email);
const walletRef = db.doc(`users/${user.uid}/private/wallet`);
const before = (await walletRef.get()).data() ?? null;
process.stdout.write(JSON.stringify({ project: 'kok-prod', uid: user.uid, providers: user.providerData.map(p => p.providerId), walletBefore: before }) + '\n');
if (flag !== '--apply') { process.stdout.write('DRY RUN — no write\n'); process.exit(0); }
const now = Date.now();
await db.runTransaction(async (tx) => {
  const snap = await tx.get(walletRef);
  if (snap.exists) tx.update(walletRef, { balance: FieldValue.increment(amount), updatedAt: now });
  else tx.set(walletRef, { balance: amount, freeHighTokens: 0, previewUsed: false, updatedAt: now });
  tx.create(db.collection(`users/${user.uid}/ledger`).doc(), { delta: amount, reason: 'credit_pack', refId: `manual_test_grant_${now}`, createdAt: now });
});
process.stdout.write(JSON.stringify({ walletAfter: (await walletRef.get()).data() }) + '\n');
