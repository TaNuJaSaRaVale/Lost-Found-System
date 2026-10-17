// Similarity scoring between a lost and a found report.
// Keep in sync with functions/index.js (calculateMatchScore), which runs the same logic server-side.
//
// Weights: category 0.35, keywords 0.35, location 0.2, date proximity 0.1

import { normalizeCategory } from './format';

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'for', 'near', 'from', 'this', 'that', 'was', 'were', 'has', 'have',
  'had', 'its', 'are', 'but', 'not', 'any', 'all', 'one', 'some', 'very', 'lost', 'found',
  'item', 'please', 'contact', 'someone', 'left', 'inside', 'colour', 'color', 'my', 'mine',
]);

const MAX_WORDS = 50; // Prevent keyword stuffing

export function extractKeywords(...texts: (string | undefined)[]): Set<string> {
  const words = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
    for (const t of tokens.slice(0, MAX_WORDS)) {
      if (t.length > 2 && !STOP_WORDS.has(t)) words.add(t);
    }
  }
  return words;
}

function keywordOverlap(a: Set<string>, b: Set<string>) {
  let matches = 0;
  b.forEach(word => {
    if (a.has(word)) {
      matches++;
      return;
    }
    // Fragment match for longer words, e.g. "iphone" ~ "phone"
    if (word.length >= 4) {
      for (const other of a) {
        if (other.length >= 4 && (other.includes(word) || word.includes(other))) {
          matches++;
          return;
        }
      }
    }
  });
  return matches;
}

function toMillis(item: any): number | null {
  if (item?.eventDate) {
    const t = new Date(item.eventDate).getTime();
    if (!isNaN(t)) return t;
  }
  if (item?.createdAt?.toMillis) return item.createdAt.toMillis();
  if (item?.dateReported) {
    const t = new Date(item.dateReported).getTime();
    if (!isNaN(t)) return t;
  }
  return null;
}

export function calculateMatchScore(lost: any, found: any): number {
  let score = 0;

  if (normalizeCategory(lost.category) === normalizeCategory(found.category)) score += 0.35;

  const kw = keywordOverlap(
    extractKeywords(lost.title, lost.description),
    extractKeywords(found.title, found.description),
  );
  score += Math.min(0.35, (kw / 3) * 0.35);

  const lostLoc = extractKeywords(lost.location);
  const foundLoc = extractKeywords(found.location);
  if (lostLoc.size && foundLoc.size && keywordOverlap(lostLoc, foundLoc) > 0) score += 0.2;

  const lostAt = toMillis(lost);
  const foundAt = toMillis(found);
  if (lostAt && foundAt) {
    const days = (foundAt - lostAt) / 86_400_000;
    // Found shortly after (or around the same time as) it was lost
    if (days >= -1 && days <= 14) score += 0.1;
  }

  return Math.min(1, score);
}
