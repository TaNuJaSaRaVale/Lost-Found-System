// Push notifications sent straight from the app through Expo's free push service.
//
// This keeps notifications working on Firebase's free (Spark) plan, where Cloud Functions are not
// available. If you later move to the Blaze plan and deploy `functions/`, set PUSH_SENDER to
// 'functions' in constants/config.ts so people don't get every notification twice.

import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { PUSH_SENDER } from '../constants/config';
import { calculateMatchScore } from '../utils/matching';
import type { ItemType } from '../utils/format';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MATCH_PUSH_THRESHOLD = 0.5; // Only confident matches are worth a notification
const MATCH_CANDIDATES = 100;

async function tokenFor(userId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'push_tokens', userId));
    return snap.exists() ? snap.data().token || null : null;
  } catch {
    return null;
  }
}

/** Best effort: never throws, so a failed notification can't break the action that triggered it. */
export async function notifyUser(userId: string | undefined, title: string, body: string, data: Record<string, any> = {}) {
  if (PUSH_SENDER !== 'app' || !userId || userId === auth.currentUser?.uid) return;
  const token = await tokenFor(userId);
  if (!token) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, sound: 'default', title, body, data, channelId: 'default' }),
    });
  } catch (e: any) {
    console.log('Push failed:', e?.message);
  }
}

/** After a new report, tell the people whose open reports look like a confident match. */
export async function notifyMatches(newType: ItemType, newId: string, newItem: Record<string, any>) {
  if (PUSH_SENDER !== 'app') return;
  const otherType: ItemType = newType === 'lost_items' ? 'found_items' : 'lost_items';
  try {
    const snap = await getDocs(query(
      collection(db, otherType),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(MATCH_CANDIDATES),
    ));
    const notified = new Set<string>();
    const jobs: Promise<void>[] = [];
    snap.docs.forEach(d => {
      const other = d.data();
      if (!other.userId || other.userId === newItem.userId || notified.has(other.userId)) return;
      const score = newType === 'lost_items'
        ? calculateMatchScore(newItem, other)
        : calculateMatchScore(other, newItem);
      if (score < MATCH_PUSH_THRESHOLD) return;
      notified.add(other.userId);
      jobs.push(notifyUser(
        other.userId,
        newType === 'found_items' ? '🔎 Someone may have found your item!' : '🙋 Someone may have lost what you found',
        `"${newItem.title}" looks similar to your report "${other.title}". Tap to check.`,
        { itemId: newId, itemType: newType },
      ));
    });
    await Promise.all(jobs);
  } catch (e: any) {
    console.log('Match notifications skipped:', e?.message);
  }
}
