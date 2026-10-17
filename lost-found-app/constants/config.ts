// App-wide configuration. Edit these to tailor the app to your campus.

export const APP_NAME = 'Campus Lost & Found';

// Restrict sign-ups to campus email domains, e.g. ['walchandsangli.ac.in'].
// Leave empty to allow any email address.
export const ALLOWED_EMAIL_DOMAINS: string[] = [];

export const GOOGLE_WEB_CLIENT_ID =
  '145937489025-r4uuaugq8pj9md58s9ppqthq4sin7vv0.apps.googleusercontent.com';

// Shown on the login/register screens and Play Store listing. Host your own policy page.
export const PRIVACY_POLICY_URL = 'https://github.com/TaNuJaSaRaVale/Lost-Found-System/blob/main/PRIVACY.md';

export const CATEGORIES = [
  { id: 'electronics', label: 'Electronics', icon: 'phone-portrait-outline' },
  { id: 'wallet', label: 'Wallet / Purse', icon: 'wallet-outline' },
  { id: 'id_card', label: 'ID Card', icon: 'id-card-outline' },
  { id: 'documents', label: 'Documents', icon: 'document-text-outline' },
  { id: 'keys', label: 'Keys', icon: 'key-outline' },
  { id: 'bag', label: 'Bag', icon: 'bag-handle-outline' },
  { id: 'books', label: 'Books & Notes', icon: 'book-outline' },
  { id: 'clothing', label: 'Clothing', icon: 'shirt-outline' },
  { id: 'accessories', label: 'Accessories', icon: 'watch-outline' },
  { id: 'bottle', label: 'Bottle / Tiffin', icon: 'water-outline' },
  { id: 'others', label: 'Others', icon: 'cube-outline' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

// Quick-pick chips on the report form. Users can still type any location.
export const CAMPUS_LOCATIONS = [
  'Library',
  'Canteen',
  'Main Building',
  'Auditorium',
  'Hostel',
  'Parking',
  'Sports Ground',
  'Labs',
  'Bus Stop',
];

export const LIMITS = {
  title: 80,
  description: 600,
  location: 80,
  reward: 40,
  message: 1000,
  proof: 600,
  reportReason: 300,
};

// Page size for the Lost / Found feeds.
export const FEED_PAGE_SIZE = 30;

// Minimum similarity (0-1) for an item pair to show up on the Matches tab.
export const MATCH_THRESHOLD = 0.4;
