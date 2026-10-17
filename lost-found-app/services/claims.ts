// Claim lifecycle. Every transition is a single atomic batch so items and claims never drift apart.
//
//   pending ──approve──▶ approved ──markReturned──▶ returned
//      │                    (other pending claims on the item are auto-rejected)
//      ├──reject──▶ rejected   (chat locked)
//      └──withdraw─▶ withdrawn
//
// Item status: open ──(claim approved)──▶ pending_handover ──▶ returned
// Submitting a claim does NOT lock the item, so one person can't block everyone else.

import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'withdrawn' | 'admin_direct';

export interface Claim {
  id: string;
  itemId: string;
  itemType: 'lost_items' | 'found_items';
  sourceItemId?: string | null;
  sourceItemType?: string | null;
  itemTitle: string;
  claimantId: string;
  claimantName: string;
  claimantClass?: string;
  ownerId: string;
  ownerName: string;
  status: ClaimStatus;
  proofDescription: string;
  createdAt?: any;
  updatedAt?: any;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: any;
  hasUnread?: boolean;
}

// Deterministic id: one claim per person per item (prevents duplicate / spam claims).
export const claimIdFor = (itemId: string, claimantId: string) => `${itemId}_${claimantId}`;

const LEGACY_PENDING = ['pending_claim', 'pending_found'];

// The claimant's own linked report may have been deleted since the claim was made.
async function sourceItemExists(claim: Claim) {
  if (!claim.sourceItemId || !claim.sourceItemType) return false;
  try {
    return (await getDoc(doc(db, claim.sourceItemType, claim.sourceItemId))).exists();
  } catch {
    return false;
  }
}

function setItemStatus(batch: ReturnType<typeof writeBatch>, type: string, id: string, status: string, claimId: string) {
  batch.update(doc(db, type, id), { status, statusClaimId: claimId, updatedAt: serverTimestamp() });
}

export async function approveClaim(claim: Claim) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'claims', claim.id), { status: 'approved', updatedAt: serverTimestamp() });
  setItemStatus(batch, claim.itemType, claim.itemId, 'pending_handover', claim.id);
  if (await sourceItemExists(claim)) {
    setItemStatus(batch, claim.sourceItemType!, claim.sourceItemId!, 'pending_handover', claim.id);
  }

  // Only one claim can win: reject the other pending claims on this item.
  const others = await getDocs(query(
    collection(db, 'claims'),
    where('ownerId', '==', claim.ownerId),
    where('itemId', '==', claim.itemId),
    where('status', '==', 'pending'),
  ));
  others.docs.forEach(d => {
    if (d.id !== claim.id) batch.update(d.ref, { status: 'rejected', updatedAt: serverTimestamp() });
  });

  await batch.commit();
}

export async function rejectClaim(claim: Claim) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'claims', claim.id), { status: 'rejected', updatedAt: serverTimestamp() });

  // Items created before v2 were locked while a claim was pending; unlock them.
  const item = await getDoc(doc(db, claim.itemType, claim.itemId));
  if (item.exists() && LEGACY_PENDING.includes(item.data().status)) {
    setItemStatus(batch, claim.itemType, claim.itemId, 'open', claim.id);
  }
  await batch.commit();
}

export async function markClaimReturned(claim: Claim) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'claims', claim.id), { status: 'returned', updatedAt: serverTimestamp() });
  setItemStatus(batch, claim.itemType, claim.itemId, 'returned', claim.id);
  if (await sourceItemExists(claim)) {
    setItemStatus(batch, claim.sourceItemType!, claim.sourceItemId!, 'returned', claim.id);
  }
  await batch.commit();
}

export async function withdrawClaim(claim: Claim) {
  await updateDoc(doc(db, 'claims', claim.id), { status: 'withdrawn', updatedAt: serverTimestamp() });
}
