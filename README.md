<div align="center">
  <img src="lost-found-app/assets/images/logo.png" alt="Campus Lost & Found Logo" width="150" />
  <h1>Campus Lost & Found System</h1>
  <p><strong>A secure, intelligent, and real-time platform for recovering lost items on campus.</strong></p>
</div>

---

## 🚀 Overview

The **Campus Lost & Found System** is a robust mobile application built with **React Native (Expo)** and **Firebase**. Designed to streamline the chaotic process of recovering lost items within a campus environment, it features an intelligent matching engine, real-time in-app communication, and strict moderation tools to ensure a safe, spam-free, and accountable environment for all students and administrators.

## ✨ Key Features

- **Intelligent Matching Engine**: Actively scans and calculates similarity scores between "Lost" and "Found" reports using a sophisticated algorithm analyzing categories, locations, and unique keywords. 
- **Secure Authentication**: Integrated with Firebase Authentication, supporting both traditional Email/Password and Native Google Sign-In flows.
- **Real-Time Communication**: Built-in chat system allowing secure, real-time negotiation between item owners and finders.
- **Admin Moderation Dashboard**: A unified control center for administrators to manage users (suspend/warn), moderate item listings, and review user reports.
- **Offline Resilience**: Architected with offline-first capabilities. Users can browse cached items and their profiles without internet access, and the app gracefully handles network drops without crashing.
- **Modern, Responsive UI**: Uses NativeWind (Tailwind CSS for React Native) with a consistent indigo / emerald design system and a deep-navy dark mode (Light / Dark / System).
- **Fair Claim Workflow**: Multiple people can claim an item; the reporter reviews proofs inline, approves one (others are auto-declined), then confirms the handover. Claimants can withdraw or resubmit.
- **Push Notifications**: Alerts for new matches, new claims, claim decisions and chat messages (Cloud Functions + Expo Push), with tap-to-open deep links.
- **Fast Feeds**: Paginated Lost / Found feeds with thumbnails, category and status filters, search and "only mine". Full-size photos load only on the detail screen.
- **Smart Reporting**: Category picker, campus location quick-picks, date chips, camera or gallery photos, rewards and "currently kept at" for found items.
- **Share Anywhere**: Share any report to WhatsApp/Instagram groups with one tap.
- **Account Control**: Forgot password, email verification, optional campus-email restriction, and in-app account deletion (Google Play requirement).
- **Tested Security Rules**: 68 emulator tests cover the claim state machine, chat privacy, admin safeguards and abuse cases (`firestore-tests/`).

---

## 🛡️ Edge Cases & Security Loopholes Solved

Building a public-facing community platform requires strict attention to abuse vectors and technical edge cases. We identified and implemented robust solutions for the following critical loopholes:

### 1. Keyword-Stuffing & Spam Mitigation in the Matching Engine
**The Loophole:** Malicious users could artificially inflate their item's similarity score to force false matches by stuffing their item descriptions with hundreds of popular keywords.
**The Fix:** The matching algorithm sanitizes inputs, enforces a strict 50-word extraction limit, and utilizes a `Set` data structure to count unique word matches. The scoring weight is capped, guaranteeing that descriptive accuracy outranks keyword volume.

### 2. Harassment via Rejected/Orphaned Claims
**The Loophole:** Users whose item claims were rejected by the finder could continue to harass the finder through the open chat thread. Additionally, deleting an item could leave "ghost" chat threads active.
**The Fix:** Implementing strict state-based communication locks. The moment a claim is marked as `rejected`, the associated real-time chat interface instantly disables input and alerts participants. 

### 3. Administrative Deadlocks
**The Loophole:** Admins could accidentally (or maliciously) demote or block their own accounts, potentially leaving the platform entirely unmoderated if they were the only administrator.
**The Fix:** Firestore security rules reject any change an admin makes to their own role or status, and roles can never be self-assigned at sign-up. Admins are promoted only by another admin.

### 4. Premature Cache Lockouts
**The Loophole:** Due to Firebase's aggressive local caching, an active user might open the app while offline and trigger an outdated local cache that incorrectly labeled their account as "blocked" from a previous session, locking them out of the app.
**The Fix:** `AuthContext` was enhanced to explicitly check `docSnap.metadata.fromCache`. If a "blocked" status is pulled purely from offline memory, the app waits for server confirmation before enforcing the lockout screen.

### 5. Fatal Offline Promise Rejections & WebChannel Drops
**The Loophole:** React Native struggles with maintaining continuous WebSocket/WebChannel streams. Losing Wi-Fi for even a fraction of a second would cause unhandled promise rejections on Firebase `getDoc` and `onSnapshot` listeners, resulting in fatal app crashes.
**The Fix:** 
- Replaced unstable "forced long-polling" overrides with modern auto-detect transport streams.
- Migrated primary data fetching to the globally resilient `useAuth` hook.
- Added strict `(error)` boundary callbacks to all `onSnapshot` listeners across the matching engine, profile, and found feeds to gracefully catch and dismiss `[code=permission-denied]` exceptions when network auth fails.

---

## 🛠️ Tech Stack

- **Frontend framework**: React Native & Expo Router (File-based routing)
- **Styling**: NativeWind (Tailwind CSS)
- **Backend & Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth (Email & Google OAuth)
- **Build System**: EAS Build (Expo Application Services)

## 📦 Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TaNuJaSaRaVale/Lost-Found-System.git
   cd Lost-Found-System/lost-found-app
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start the development server:**
   ```bash
   npx expo start
   ```

4. **Deploy the backend (required for v2):**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   cd functions && npm install && cd .. && firebase deploy --only functions   # needs the Blaze plan
   ```
5. **Run the security-rule tests** (needs Java 11+):
   ```bash
   cd firestore-tests && npm install && npm test
   ```

See **[LAUNCH_GUIDE.md](LAUNCH_GUIDE.md)** for publishing on Google Play, scaling, and monetization, and **[PRIVACY.md](PRIVACY.md)** for the privacy policy template.

*Note: Google Sign-In requires native module linking. To test full authentication flows, use an EAS Development Client or run `npx expo run:android` / `npx expo run:ios`.*
