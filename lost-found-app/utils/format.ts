import { CATEGORIES } from '../constants/config';

export type ItemType = 'lost_items' | 'found_items';

// Items created before v2 stored free-text categories ("Wallet", "ID card", ...).
export function normalizeCategory(raw?: string): string {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return 'others';
  const match = CATEGORIES.find(
    c => c.id === value || c.label.toLowerCase() === value || value.startsWith(c.id.replace('_', ' ')),
  );
  return match ? match.id : value;
}

export function categoryInfo(raw?: string) {
  const id = normalizeCategory(raw);
  const known = CATEGORIES.find(c => c.id === id);
  return known ?? { id: 'others', label: raw?.trim() || 'Others', icon: 'cube-outline' as const };
}

export type StatusKind = 'open' | 'pending' | 'returned';

// Legacy statuses (pending_claim / pending_found / claimed) are still mapped for old data.
export function statusKind(status?: string): StatusKind {
  switch (status) {
    case 'pending_claim':
    case 'pending_found':
    case 'pending_handover':
      return 'pending';
    case 'returned':
    case 'claimed':
    case 'resolved':
      return 'returned';
    default:
      return 'open';
  }
}

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(value: any): string {
  const date = toDate(value);
  if (!date) return 'Just now';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// The date the item was lost / found. Falls back to legacy free-text fields.
export function eventDateLabel(item: any): string {
  const date = toDate(item?.eventDate);
  if (date) {
    const label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return item.eventTime ? `${label}, ${item.eventTime}` : label;
  }
  return item?.dateLost || item?.dateFound || item?.dateTime || 'Recently';
}

export function isAllowedEmail(email: string, domains: string[]) {
  if (!domains.length) return true;
  const domain = email.trim().toLowerCase().split('@')[1] || '';
  return domains.some(d => domain === d.toLowerCase());
}

export function friendlyAuthError(error: any): string {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 6 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your network and try again.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and log in again, then retry.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}
