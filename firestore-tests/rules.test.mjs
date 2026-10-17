import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-lostfound',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); }
}

// Seed data with rules disabled
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users/admin1'), { name: 'Admin', email: 'a@x', role: 'admin', status: 'active' });
  await setDoc(doc(db, 'users/admin2'), { name: 'Admin2', email: 'a2@x', role: 'admin', status: 'active' });
  await setDoc(doc(db, 'users/alice'), { name: 'Alice', email: 'al@x', role: 'user', status: 'active' });
  await setDoc(doc(db, 'users/bob'), { name: 'Bob', email: 'b@x', role: 'user', status: 'active' });
  await setDoc(doc(db, 'users/carol'), { name: 'Carol', email: 'c@x', role: 'user', status: 'active' });
  await setDoc(doc(db, 'users/mallory'), { name: 'Mal', email: 'm@x', role: 'user', status: 'blocked' });
  // Alice found a wallet; Bob lost a wallet
  await setDoc(doc(db, 'found_items/f1'), { title: 'Black wallet', description: '', category: 'wallet', location: 'Library', userId: 'alice', status: 'open' });
  await setDoc(doc(db, 'lost_items/l1'), { title: 'My wallet', description: '', category: 'wallet', location: 'Library', userId: 'bob', status: 'open' });
});

const as = uid => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();
const item = (userId, extra = {}) => ({ title: 'Blue bottle', description: 'Milton', category: 'bottle', location: 'Canteen', userId, status: 'open', ...extra });

console.log('Users');
await t('new user can create own profile as user', () => assertSucceeds(setDoc(doc(as('dave'), 'users/dave'), { name: 'Dave', email: 'd@x', role: 'user', status: 'active', createdAt: serverTimestamp() })));
await t('cannot self-register as admin', () => assertFails(setDoc(doc(as('eve'), 'users/eve'), { name: 'Eve', email: 'e@x', role: 'admin', status: 'active' })));
await t('cannot promote self to admin', () => assertFails(updateDoc(doc(as('alice'), 'users/alice'), { role: 'admin' })));
await t('blocked user cannot unblock self', () => assertFails(updateDoc(doc(as('mallory'), 'users/mallory'), { status: 'active' })));
await t('user can edit own name/class', () => assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { name: 'Alice S', studentClass: 'TY' })));
await t('user can acknowledge warning (set false)', () => assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { hasPendingWarning: false })));
await t('user cannot read another profile', () => assertFails(getDoc(doc(as('alice'), 'users/bob'))));
await t('user cannot list users', () => assertFails(getDocs(collection(as('alice'), 'users'))));
await t('admin can list users', () => assertSucceeds(getDocs(collection(as('admin1'), 'users'))));
await t('admin can block another user', () => assertSucceeds(updateDoc(doc(as('admin1'), 'users/carol'), { status: 'blocked' })));
await t('admin can unblock', () => assertSucceeds(updateDoc(doc(as('admin1'), 'users/carol'), { status: 'active' })));
await t('admin cannot demote self', () => assertFails(updateDoc(doc(as('admin1'), 'users/admin1'), { role: 'user' })));
await t('admin can warn user', () => assertSucceeds(updateDoc(doc(as('admin1'), 'users/bob'), { warnings: 1, hasPendingWarning: true })));
await t('admin cannot edit user name', () => assertFails(updateDoc(doc(as('admin1'), 'users/bob'), { name: 'hacked' })));
await t('push token save (merge) works', () => assertSucceeds(setDoc(doc(as('bob'), 'users/bob'), { expoPushToken: 'tok', notificationsEnabled: true }, { merge: true })));

console.log('Items');
await t('unauthenticated cannot read items', () => assertFails(getDocs(collection(anon, 'found_items'))));
await t('signed-in user can browse items', () => assertSucceeds(getDocs(collection(as('carol'), 'found_items'))));
await t('can post own item', () => assertSucceeds(setDoc(doc(as('carol'), 'found_items/c1'), item('carol'))));
await t('cannot post as someone else', () => assertFails(setDoc(doc(as('carol'), 'found_items/c2'), item('alice'))));
await t('blocked user cannot post', () => assertFails(setDoc(doc(as('mallory'), 'found_items/m1'), item('mallory'))));
await t('cannot post with status returned', () => assertFails(setDoc(doc(as('carol'), 'found_items/c3'), item('carol', { status: 'returned' }))));
await t('title over 80 chars rejected', () => assertFails(setDoc(doc(as('carol'), 'found_items/c4'), item('carol', { title: 'x'.repeat(81) }))));
await t('cannot edit another user item', () => assertFails(updateDoc(doc(as('bob'), 'found_items/f1'), { title: 'mine now' })));
await t('cannot set status on others item without claim', () => assertFails(updateDoc(doc(as('bob'), 'found_items/f1'), { status: 'returned' })));
await t('item + image batch create', () => {
  const db = as('carol'); const b = writeBatch(db);
  b.set(doc(db, 'lost_items/c5'), item('carol', { thumbnail: 'data:x', hasImage: true }));
  b.set(doc(db, 'item_images/c5'), { image: 'data:big', userId: 'carol', itemType: 'lost_items' });
  return assertSucceeds(b.commit());
});

console.log('Claims');
await t('claim with non-deterministic id rejected', () => assertFails(setDoc(doc(as('bob'), 'claims/random'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'bob', ownerId: 'alice', status: 'pending', proofDescription: 'red stitch', sourceItemId: 'l1', sourceItemType: 'lost_items' })));
await t('claim with wrong ownerId rejected', () => assertFails(setDoc(doc(as('bob'), 'claims/f1_bob'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'bob', ownerId: 'carol', status: 'pending', proofDescription: 'x', sourceItemId: null })));
await t('cannot claim own item', () => assertFails(setDoc(doc(as('alice'), 'claims/f1_alice'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'alice', ownerId: 'alice', status: 'pending', proofDescription: 'x', sourceItemId: null })));
await t('cannot link someone else\'s item as source', () => assertFails(setDoc(doc(as('carol'), 'claims/f1_carol'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'carol', ownerId: 'alice', status: 'pending', proofDescription: 'x', sourceItemId: 'l1', sourceItemType: 'lost_items' })));
await t('blocked user cannot claim', () => assertFails(setDoc(doc(as('mallory'), 'claims/f1_mallory'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'mallory', ownerId: 'alice', status: 'pending', proofDescription: 'x', sourceItemId: null })));
await t('Bob claims Alice\'s found wallet', () => assertSucceeds(setDoc(doc(as('bob'), 'claims/f1_bob'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'bob', ownerId: 'alice', ownerName: 'Alice', status: 'pending',
  proofDescription: 'red stitching inside', sourceItemId: 'l1', sourceItemType: 'lost_items', createdAt: serverTimestamp() })));
await t('Carol also claims it (item not locked)', () => assertSucceeds(setDoc(doc(as('carol'), 'claims/f1_carol'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'carol', ownerId: 'alice', status: 'pending', proofDescription: 'brown', sourceItemId: null })));
await t('Bob cannot claim twice (create on existing id fails)', () => assertFails(setDoc(doc(as('bob'), 'claims/f1_bob'), {
  itemId: 'f1', itemType: 'found_items', claimantId: 'bob', ownerId: 'alice', status: 'pending', proofDescription: 'again', sourceItemId: null })));
await t('claimant cannot approve own claim', () => assertFails(updateDoc(doc(as('bob'), 'claims/f1_bob'), { status: 'approved' })));
await t('outsider cannot read claim', () => assertFails(getDoc(doc(as('dave'), 'claims/f1_bob'))));
await t('owner lists claims on item (profile/item queries)', () => assertSucceeds(getDocs(query(collection(as('alice'), 'claims'), where('ownerId', '==', 'alice'), where('itemId', '==', 'f1')))));
await t('claimant lists own claims', () => assertSucceeds(getDocs(query(collection(as('bob'), 'claims'), where('claimantId', '==', 'bob'), where('itemId', '==', 'f1')))));
await t('unscoped claims query denied', () => assertFails(getDocs(query(collection(as('bob'), 'claims'), where('itemId', '==', 'f1')))));

console.log('Chat');
const msg = (sender, claimId, participants, text = 'hi') => ({ claimId, senderId: sender, participants, text, createdAt: serverTimestamp() });
await t('claimant can message', () => assertSucceeds(addDoc(collection(as('bob'), 'messages'), msg('bob', 'f1_bob', ['bob', 'alice']))));
await t('owner can message', () => assertSucceeds(addDoc(collection(as('alice'), 'messages'), msg('alice', 'f1_bob', ['bob', 'alice']))));
await t('outsider cannot inject message', () => assertFails(addDoc(collection(as('dave'), 'messages'), msg('dave', 'f1_bob', ['dave', 'alice']))));
await t('cannot spoof sender', () => assertFails(addDoc(collection(as('bob'), 'messages'), msg('alice', 'f1_bob', ['bob', 'alice']))));
await t('chat query with participant filter allowed', () => assertSucceeds(getDocs(query(collection(as('bob'), 'messages'), where('claimId', '==', 'f1_bob'), where('participants', 'array-contains', 'bob')))));
await t('chat query without filter denied', () => assertFails(getDocs(query(collection(as('bob'), 'messages'), where('claimId', '==', 'f1_bob')))));
await t('outsider sees no messages of others', async () => {
  const snap = await getDocs(query(collection(as('dave'), 'messages'), where('claimId', '==', 'f1_bob'), where('participants', 'array-contains', 'dave')));
  if (snap.size !== 0) throw new Error('outsider saw ' + snap.size + ' messages');
});
await t('either party updates chat metadata', () => assertSucceeds(updateDoc(doc(as('bob'), 'claims/f1_bob'), { lastMessageText: 'hi', lastMessageSenderId: 'bob', hasUnread: true, lastMessageAt: serverTimestamp() })));
await t('admin direct message', () => assertSucceeds(addDoc(collection(as('admin1'), 'messages'), msg('admin1', 'admin_admin1_admin2', ['admin1', 'admin2']))));
await t('non-admin cannot use admin chat', () => assertFails(addDoc(collection(as('bob'), 'messages'), msg('bob', 'admin_alice_bob', ['alice', 'bob']))));

console.log('Approve → handover → returned');
await t('Alice approves Bob (batch incl. Bob\'s lost item + reject Carol)', () => {
  const db = as('alice'); const b = writeBatch(db);
  b.update(doc(db, 'claims/f1_bob'), { status: 'approved', updatedAt: serverTimestamp() });
  b.update(doc(db, 'found_items/f1'), { status: 'pending_handover', statusClaimId: 'f1_bob', updatedAt: serverTimestamp() });
  b.update(doc(db, 'lost_items/l1'), { status: 'pending_handover', statusClaimId: 'f1_bob', updatedAt: serverTimestamp() });
  b.update(doc(db, 'claims/f1_carol'), { status: 'rejected', updatedAt: serverTimestamp() });
  return assertSucceeds(b.commit());
});
await t('rejected Carol can no longer message', () => assertFails(addDoc(collection(as('carol'), 'messages'), msg('carol', 'f1_carol', ['carol', 'alice']))));
await t('Carol cannot reopen her rejected claim', () => assertFails(updateDoc(doc(as('carol'), 'claims/f1_carol'), { status: 'pending', proofDescription: 'pls' })));
await t('status sync cannot touch other fields', () => assertFails(updateDoc(doc(as('alice'), 'lost_items/l1'), { title: 'x', status: 'returned', statusClaimId: 'f1_bob' })));
await t('status sync with unrelated claim rejected', () => assertFails(updateDoc(doc(as('carol'), 'lost_items/l1'), { status: 'returned', statusClaimId: 'f1_carol' })));
await t('Alice marks returned (batch)', () => {
  const db = as('alice'); const b = writeBatch(db);
  b.update(doc(db, 'claims/f1_bob'), { status: 'returned', updatedAt: serverTimestamp() });
  b.update(doc(db, 'found_items/f1'), { status: 'returned', statusClaimId: 'f1_bob', updatedAt: serverTimestamp() });
  b.update(doc(db, 'lost_items/l1'), { status: 'returned', statusClaimId: 'f1_bob', updatedAt: serverTimestamp() });
  return assertSucceeds(b.commit());
});
await t('cannot move returned claim back to pending', () => assertFails(updateDoc(doc(as('alice'), 'claims/f1_bob'), { status: 'pending' })));

console.log('Withdraw / resubmit');
await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'found_items/f2'), { title: 'Keys', description: '', category: 'keys', location: 'Hostel', userId: 'alice', status: 'open' }));
await t('Dave claims f2', () => assertSucceeds(setDoc(doc(as('dave'), 'claims/f2_dave'), { itemId: 'f2', itemType: 'found_items', claimantId: 'dave', ownerId: 'alice', status: 'pending', proofDescription: 'keychain', sourceItemId: null })));
await t('Dave withdraws', () => assertSucceeds(updateDoc(doc(as('dave'), 'claims/f2_dave'), { status: 'withdrawn', updatedAt: serverTimestamp() })));
await t('withdrawn chat locked', () => assertFails(addDoc(collection(as('dave'), 'messages'), msg('dave', 'f2_dave', ['dave', 'alice']))));
await t('Dave resubmits', () => assertSucceeds(updateDoc(doc(as('dave'), 'claims/f2_dave'), { status: 'pending', proofDescription: 'red keychain', updatedAt: serverTimestamp() })));

console.log('Reports & deletion');
await t('user can report another', () => assertSucceeds(addDoc(collection(as('bob'), 'user_reports'), { reportedUserId: 'alice', reportedBy: 'bob', reason: 'spam', createdAt: serverTimestamp() })));
await t('cannot report as someone else', () => assertFails(addDoc(collection(as('bob'), 'user_reports'), { reportedUserId: 'alice', reportedBy: 'carol', reason: 'spam' })));
await t('non-admin cannot read reports', () => assertFails(getDocs(collection(as('bob'), 'user_reports'))));
await t('admin reads reports', () => assertSucceeds(getDocs(collection(as('admin1'), 'user_reports'))));
await t('owner cascade delete (item + missing image + claims)', async () => {
  const db = as('alice');
  const claims = await getDocs(query(collection(db, 'claims'), where('ownerId', '==', 'alice'), where('itemId', '==', 'f2')));
  const b = writeBatch(db);
  b.delete(doc(db, 'found_items/f2')); b.delete(doc(db, 'item_images/f2'));
  claims.docs.forEach(d => b.delete(d.ref));
  return assertSucceeds(b.commit());
});
await t('admin cascade delete of another user item', async () => {
  const db = as('admin1');
  const claims = await getDocs(query(collection(db, 'claims'), where('itemId', '==', 'c5')));
  const b = writeBatch(db);
  b.delete(doc(db, 'lost_items/c5')); b.delete(doc(db, 'item_images/c5'));
  claims.docs.forEach(d => b.delete(d.ref));
  return assertSucceeds(b.commit());
});
await t('cannot delete another user item', () => assertFails(deleteDoc(doc(as('bob'), 'found_items/c1'))));
await t('user can delete own profile (account deletion)', () => assertSucceeds(deleteDoc(doc(as('dave'), 'users/dave'))));
await t('clients cannot write matches', () => assertFails(setDoc(doc(as('bob'), 'matches/x'), { a: 1 })));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
