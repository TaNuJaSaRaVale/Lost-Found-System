// Lost / found report persistence.
//
// Photos are stored as compressed base64 so the app works on Firebase's free (Spark) plan.
// To keep feeds fast, the item document only carries a tiny thumbnail; the full-size photo lives in
// item_images/{itemId} and is loaded only on the detail screen.

import * as ImageManipulator from 'expo-image-manipulator';
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ItemType } from '../utils/format';

export interface ProcessedImage {
  full: string;
  thumbnail: string;
}

export async function processImage(uri: string): Promise<ProcessedImage> {
  const [full, thumb] = await Promise.all([
    ImageManipulator.manipulateAsync(uri, [{ resize: { width: 900 } }], {
      compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    }),
    ImageManipulator.manipulateAsync(uri, [{ resize: { width: 200 } }], {
      compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    }),
  ]);
  return {
    full: `data:image/jpeg;base64,${full.base64}`,
    thumbnail: `data:image/jpeg;base64,${thumb.base64}`,
  };
}

export async function createItem(type: ItemType, data: Record<string, any>, image: ProcessedImage | null) {
  const itemRef = doc(collection(db, type));
  const batch = writeBatch(db);
  batch.set(itemRef, {
    ...data,
    thumbnail: image?.thumbnail || '',
    hasImage: !!image,
    status: 'open',
    dateReported: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (image) {
    batch.set(doc(db, 'item_images', itemRef.id), { image: image.full, userId: data.userId, itemType: type });
  }
  await batch.commit();
  return itemRef.id;
}

// Full-size photo for the detail screen. Pre-v2 items kept the photo inline as `imageUrl`.
export async function getItemImage(item: any): Promise<string | null> {
  if (item?.imageUrl) return item.imageUrl;
  if (!item?.hasImage) return item?.thumbnail || null;
  try {
    const snap = await getDoc(doc(db, 'item_images', item.id));
    return snap.exists() ? snap.data().image : item.thumbnail || null;
  } catch {
    return item.thumbnail || null;
  }
}

// Deletes the report, its photo and every claim on it in one atomic batch.
// `ownerId` scopes the claims query so it satisfies the security rules (admins may pass undefined).
export async function deleteItemCascade(type: ItemType, itemId: string, ownerId?: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, type, itemId));
  batch.delete(doc(db, 'item_images', itemId));

  const claimsQuery = ownerId
    ? query(collection(db, 'claims'), where('ownerId', '==', ownerId), where('itemId', '==', itemId))
    : query(collection(db, 'claims'), where('itemId', '==', itemId));
  const claims = await getDocs(claimsQuery);
  claims.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

export async function markItemResolved(type: ItemType, itemId: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, type, itemId), { status: 'returned', updatedAt: serverTimestamp() });
  await batch.commit();
}
