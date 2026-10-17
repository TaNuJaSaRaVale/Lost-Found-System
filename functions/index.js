const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Keep functions close to your Firestore location to reduce latency/cost.
setGlobalOptions({ maxInstances: 10 });

// ---------------------------------------------------------------------------
// Matching engine. Keep in sync with lost-found-app/utils/matching.ts
// Weights: category 0.35, keywords 0.35, location 0.2, date proximity 0.1
// ---------------------------------------------------------------------------
const MATCH_THRESHOLD = 0.5; // Push notifications only for confident matches
const CANDIDATE_LIMIT = 300;

const STOP_WORDS = new Set([
  "the", "and", "with", "for", "near", "from", "this", "that", "was", "were", "has", "have",
  "had", "its", "are", "but", "not", "any", "all", "one", "some", "very", "lost", "found",
  "item", "please", "contact", "someone", "left", "inside", "colour", "color", "my", "mine",
]);

const CATEGORY_ALIASES = {
  "wallet / purse": "wallet", "id card": "id_card", "books & notes": "books",
  "bottle / tiffin": "bottle", "other": "others",
};

function normalizeCategory(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return CATEGORY_ALIASES[v] || v || "others";
}

function keywords(...texts) {
  const words = new Set();
  for (const text of texts) {
    if (!text) continue;
    const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
    for (const t of tokens.slice(0, 50)) {
      if (t.length > 2 && !STOP_WORDS.has(t)) words.add(t);
    }
  }
  return words;
}

function overlap(a, b) {
  let n = 0;
  b.forEach((w) => {
    if (a.has(w)) return n++;
    if (w.length >= 4) {
      for (const o of a) {
        if (o.length >= 4 && (o.includes(w) || w.includes(o))) return n++;
      }
    }
  });
  return n;
}

function millis(item) {
  if (item.eventDate) {
    const t = new Date(item.eventDate).getTime();
    if (!isNaN(t)) return t;
  }
  if (item.createdAt && item.createdAt.toMillis) return item.createdAt.toMillis();
  if (item.dateReported) {
    const t = new Date(item.dateReported).getTime();
    if (!isNaN(t)) return t;
  }
  return Date.now();
}

function calculateMatchScore(lost, found) {
  let score = 0;
  if (normalizeCategory(lost.category) === normalizeCategory(found.category)) score += 0.35;
  const kw = overlap(keywords(lost.title, lost.description), keywords(found.title, found.description));
  score += Math.min(0.35, (kw / 3) * 0.35);
  const ll = keywords(lost.location);
  const fl = keywords(found.location);
  if (ll.size && fl.size && overlap(ll, fl) > 0) score += 0.2;
  const days = (millis(found) - millis(lost)) / 86400000;
  if (days >= -1 && days <= 14) score += 0.1;
  return Math.min(1, score);
}

// ---------------------------------------------------------------------------
// Push notifications via Expo
// ---------------------------------------------------------------------------
async function pushToUser(userId, title, body, data = {}) {
  if (!userId) return;
  const userRef = db.collection("users").doc(userId);
  const snap = await userRef.get();
  const user = snap.data();
  if (!user || !user.expoPushToken || user.notificationsEnabled === false) return;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ to: user.expoPushToken, sound: "default", title, body, data, channelId: "default" }),
    });
    const json = await res.json();
    // Clean up tokens for uninstalled apps so we stop sending to them
    if (json && json.data && json.data.details && json.data.details.error === "DeviceNotRegistered") {
      await userRef.update({ expoPushToken: admin.firestore.FieldValue.delete() });
    }
  } catch (err) {
    console.error("Push failed for", userId, err.message);
  }
}

// ---------------------------------------------------------------------------
// New report → find matches and notify the people whose reports match
// ---------------------------------------------------------------------------
async function handleNewItem(newItem, newId, newType) {
  const otherType = newType === "lost_items" ? "found_items" : "lost_items";
  const candidates = await db.collection(otherType)
    .where("status", "==", "open")
    .orderBy("createdAt", "desc")
    .limit(CANDIDATE_LIMIT)
    .get();

  const batch = db.batch();
  const notifications = [];
  let count = 0;

  candidates.forEach((d) => {
    const other = d.data();
    if (other.userId === newItem.userId) return;
    const [lost, found, lostId, foundId] = newType === "lost_items"
      ? [newItem, other, newId, d.id]
      : [other, newItem, d.id, newId];
    const score = calculateMatchScore(lost, found);
    if (score < MATCH_THRESHOLD) return;

    count++;
    batch.set(db.collection("matches").doc(`${lostId}_${foundId}`), {
      lostItemId: lostId, foundItemId: foundId, similarityScore: score, status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    notifications.push(pushToUser(
      other.userId,
      newType === "found_items" ? "🔎 Someone may have found your item!" : "🙋 Someone may have lost what you found",
      `"${newItem.title}" looks similar to your report "${other.title}". Tap to check.`,
      { itemId: newId, itemType: newType },
    ));
  });

  if (count > 0) {
    notifications.push(pushToUser(newItem.userId, "✨ Possible matches found",
      `We found ${count} report${count > 1 ? "s" : ""} similar to "${newItem.title}".`, { screen: "matches" }));
    await batch.commit();
  }
  await Promise.all(notifications);
}

exports.onLostItemCreated = onDocumentCreated("lost_items/{itemId}", (event) =>
  handleNewItem(event.data.data(), event.params.itemId, "lost_items"));

exports.onFoundItemCreated = onDocumentCreated("found_items/{itemId}", (event) =>
  handleNewItem(event.data.data(), event.params.itemId, "found_items"));

// ---------------------------------------------------------------------------
// Claims & chat notifications
// ---------------------------------------------------------------------------
exports.onClaimCreated = onDocumentCreated("claims/{claimId}", async (event) => {
  const c = event.data.data();
  const isFoundReport = c.itemType === "lost_items"; // someone says they found your lost item
  await pushToUser(c.ownerId,
    isFoundReport ? "🙌 Someone found your item!" : "📩 New claim on your found item",
    `${c.claimantName || "Someone"} responded to "${c.itemTitle}". Review it now.`,
    { itemId: c.itemId, itemType: c.itemType });
});

exports.onClaimUpdated = onDocumentUpdated("claims/{claimId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status) return;

  const messages = {
    approved: ["✅ Approved!", `Your response on "${after.itemTitle}" was approved. Chat to arrange the handover.`],
    rejected: ["Claim declined", `Your response on "${after.itemTitle}" was declined.`],
    returned: ["🎉 Case closed", `"${after.itemTitle}" has been marked as returned. Thanks for using Lost & Found!`],
  };
  const msg = messages[after.status];
  if (msg) {
    await pushToUser(after.claimantId, msg[0], msg[1], { claimId: event.params.claimId, screen: "chat" });
  }
});

exports.onMessageCreated = onDocumentCreated("messages/{messageId}", async (event) => {
  const m = event.data.data();
  const recipient = (m.participants || []).find((p) => p !== m.senderId);
  if (!recipient) return;

  let title = "💬 New message";
  if (!String(m.claimId).startsWith("admin_")) {
    const claim = (await db.collection("claims").doc(m.claimId).get()).data();
    if (claim) {
      const senderName = m.senderId === claim.ownerId ? claim.ownerName : claim.claimantName;
      title = `💬 ${senderName || "New message"} · ${claim.itemTitle}`;
    }
  }
  const text = String(m.text || "");
  await pushToUser(recipient, title, text.length > 120 ? `${text.slice(0, 117)}…` : text,
    { claimId: m.claimId, screen: "chat" });
});
