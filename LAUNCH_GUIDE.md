# Launch, Scale & Monetize — Campus Lost & Found

A practical checklist for taking this app from a working build to the Play Store, growing it, and earning from it.

---

## 1. Deploy the backend (do this first)

The app's security now depends on the new Firestore rules, so deploy them before anyone installs v2.

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

Indexes take a few minutes to build. Until the `messages` index finishes, chats will show "Chat is being set up".

**Cloud Functions (push notifications + server-side matching)** need the Firebase **Blaze** (pay-as-you-go) plan. Blaze still includes a generous free tier; a single campus typically stays within it. Set a budget alert in Google Cloud Billing (e.g. ₹500) for peace of mind.

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

Without Functions the app still works fully. You just won't get push notifications.

**Make your first admin:** Firebase Console → Firestore → `users/<your uid>` → set `role` to `admin`. After that, promote others from the in-app Admin dashboard.

> ⚠️ **Audit existing admins.** The old sign-up screen let anyone choose "Administrator". Open the `users` collection, filter `role == admin`, and demote anyone who shouldn't be one.

**Optional — restrict to campus emails:** set `ALLOWED_EMAIL_DOMAINS` in `lost-found-app/constants/config.ts`, e.g. `['walchandsangli.ac.in']`.

### Test the security rules

```bash
cd firestore-tests && npm install && npm test   # requires Java 11+
```

---

## 2. Publish on Google Play

### One-time setup

1. **Google Play Console account**: one-time US$25 fee at <https://play.google.com/console>.
   New *personal* accounts must run a **closed test with at least 12 testers for 14 consecutive days** before they can publish to production. Recruit classmates early!
2. **EAS CLI**: `npm install -g eas-cli && eas login`.
3. **Push notifications on Android** need Firebase Cloud Messaging credentials:
   - Firebase Console → Project settings → add an Android app with package `com.tanuja888.lostfoundapp` → download `google-services.json` into `lost-found-app/`.
   - Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
   - Firebase Console → Project settings → Service accounts → generate a key, then upload it with `eas credentials` → Android → Google Service Account → FCM V1.
4. **Google Sign-In in release builds** (the #1 cause of "DEVELOPER_ERROR"):
   after your first upload, copy the **SHA-1 of the App signing key** from Play Console → Setup → App integrity, and add it to Firebase → Project settings → your Android app → SHA fingerprints. Also add the SHA-1 from `eas credentials` (upload key).

### Build & submit

```bash
cd lost-found-app
eas build --platform android --profile production   # produces an .aab
eas submit --platform android --latest              # uploads to Play Console
```

### Store listing checklist

- [ ] App name, short description (80 chars), full description
- [ ] Icon 512×512, feature graphic 1024×500, at least 4 phone screenshots (Lost feed, Item detail, Chat, Matches)
- [ ] **Privacy policy URL**: publish `PRIVACY.md` (GitHub Pages or Google Sites) and set the URL in `constants/config.ts` (replace the support email in it first)
- [ ] **Data safety form**: declare name, email, user IDs, photos, messages; data is encrypted in transit; users can request deletion
- [ ] **Account deletion**: in-app (Profile → Delete my account) ✅, *plus* a web URL where users can request deletion (a simple Google Form works)
- [ ] **App access**: login is required, so give reviewers a test email + password
- [ ] Content rating questionnaire (user-generated content + chat → answer "yes" for user interaction; mention reporting/blocking tools)
- [ ] Target audience: 18+ (college students) avoids extra children's-policy requirements

### Before each release

- Bump nothing manually; `eas.json` uses remote auto-incremented version codes.
- Run `npm run typecheck && npm run lint` in `lost-found-app`.
- Test on a real device with a **preview** build: `eas build -p android --profile preview`.

---

## 3. Making people rely on it

Trust comes from things working every time and from people actually using it:

- **Launch with the security desk.** Ask campus security / the library to post everything handed to them. Instant inventory makes the app useful on day one.
- **Seed it.** Put a QR code poster at the library, canteen, hostel and main gate linking to the Play Store page.
- **Close the loop.** Encourage people to mark items *Returned*; the "Returned" counter on profiles and the return-rate stat in the Admin dashboard become your success metrics.
- **Moderate quickly.** Check the Admin → Reports tab daily during the first month.
- **Add crash reporting** (`sentry-expo` or Firebase Crashlytics) so you hear about bugs before users do.
- **Enable Firebase App Check** to stop scripts from abusing your backend.

---

## 4. Scaling up

| Stage | What to change |
| --- | --- |
| **One campus (now)** | Current architecture is fine. Firestore free tier ≈ 50k reads/day. |
| **Thousands of items** | Photos: move from Firestore base64 to Firebase Storage or Cloudinary (cheaper and faster). Add a scheduled Function that archives reports older than ~60 days. |
| **Many campuses** | Add a `campusId` to users and items; filter every query by it and enforce it in the rules. Give each campus its own admins. |
| **Better search** | Integrate Typesense or Algolia for typo-tolerant search across all items. |
| **Beyond colleges** | Same product fits offices, malls, hotels, events, railway stations and hostels. |

Feature ideas that add real value:

1. **QR "return-to-owner" tags.** Users print or stick a QR on laptops, bottles and ID cards. A finder scans it and opens an anonymous chat with the owner. This is the biggest product upgrade, and it can also make money (see below).
2. **Security-desk mode.** A web dashboard for the security office to log handed-in items in bulk.
3. **Image-based matching.** Use an image-embedding model (e.g. via a Cloud Function) to match photos, not just text.
4. **Marathi / Hindi translations.**
5. **"Boost" a post.** Notify everyone on campus for urgent losses (ID card before an exam).

---

## 5. Earning money

Be realistic: a free campus utility earns very little from ads. The money is in **institutions** and **physical tags**.

1. **Campus licensing (B2B SaaS), the most viable option.** Sell colleges a white-labelled version: their logo, campus-email restriction, the admin dashboard, and monthly reports for the administration. Charge an annual fee per campus. Start with your own college as the reference customer.
2. **QR smart tags.** Sell sticker or keychain packs that link to the owner's profile. Low cost to produce, with recurring sales every semester.
3. **Premium features (freemium).** Boosted posts, more active reports, priority matching alerts. Digital goods sold inside the app **must use Google Play Billing**.
4. **Local sponsorships.** One tasteful sponsored card in the feed from campus-relevant businesses (stationery, cafés, coaching). This keeps trust better than generic AdMob banners.
5. **Grants & incubation.** College innovation cells, hackathons and startup programmes (e.g. Startup India Seed Fund, state incubators) fund student products with real users.

> Avoid taking a cut of rewards between students. It adds payment, legal and trust complications for little revenue.

**Suggested path:** launch free at your campus → collect stats (items returned, active users) → use them to pitch 2–3 nearby colleges a paid licence → add QR tags.
