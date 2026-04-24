const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- MATCHING ALGORITHM ENGINE ---
// Calculates similarity between a lost and found item.
// Score weights: Category (+0.3), Keywords in description/title (+0.4), Location (+0.2), Date Logic (+0.1)
function calculateMatchScore(lostItem, foundItem) {
  let score = 0;
  const breakDown = {};

  // 1. Category Matching (Base weight: 0.3)
  if (lostItem.category.toLowerCase() === foundItem.category.toLowerCase()) {
    score += 0.3;
    breakDown.category = 0.3;
  }

  // 2. Location Matching (Base weight: 0.2)
  if (lostItem.location.toLowerCase().includes(foundItem.location.toLowerCase()) || 
      foundItem.location.toLowerCase().includes(lostItem.location.toLowerCase())) {
    score += 0.2;
    breakDown.location = 0.2;
  }

  // 3. Keyword Matching with Substring support (Base weight: 0.4)
  const extractWords = (text) => text ? text.toLowerCase().match(/\b\w+\b/g) || [] : [];
  const lostWords = [...extractWords(lostItem.title), ...extractWords(lostItem.description)];
  const foundWords = [...extractWords(foundItem.title), ...extractWords(foundItem.description)];

  let matchedKeywords = 0;
  const uniqueFoundWords = new Set(foundWords);
  
  uniqueFoundWords.forEach(fWord => {
    if (fWord.length <= 2) return; 
    
    // Check if finding word is inside any lost word or vice-versa (e.g. "phone" matches "iPhone")
    const isFragmentMatch = lostWords.some(lWord => 
       lWord === fWord || lWord.includes(fWord) || fWord.includes(lWord)
    );

    if (isFragmentMatch) matchedKeywords++;
  });
  
  const kwScore = Math.min(0.4, (matchedKeywords / 3) * 0.4);
  score += kwScore;
  breakDown.keywords = kwScore;

  // 4. Date Logic (Base weight: 0.1)
  const lostDate = new Date(lostItem.createdAt?.toDate?.() || lostItem.dateReported);
  const foundDate = new Date(foundItem.createdAt?.toDate?.() || foundItem.dateReported);
  const diffDays = Math.ceil(Math.abs(foundDate - lostDate) / (1000 * 60 * 60 * 24)); 
  
  if (diffDays <= 7) {
    score += 0.1;
    breakDown.date = 0.1;
  }

  console.log(`[Matching Engine] Score: ${score.toFixed(2)} | Breakdown:`, breakDown);
  return score;
}

// TRIGGER: When a new Lost Item is reported
exports.onLostItemCreated = onDocumentCreated("lost_items/{itemId}", async (event) => {
  const lostItem = event.data.data();
  const lostItemId = event.params.itemId;

  // Fetch all found items that are open
  const foundItemsSnap = await db.collection("found_items").where("status", "==", "open").get();
  
  const matchingPromises = [];

  foundItemsSnap.forEach((doc) => {
    const foundItem = doc.data();
    const score = calculateMatchScore(lostItem, foundItem);

    if (score >= 0.6) {
      // Possible match synthesized! Write to 'matches' collection
      matchingPromises.push(db.collection("matches").add({
        lostItemId: lostItemId,
        foundItemId: doc.id,
        similarityScore: score,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
    }
  });

  if (matchingPromises.length > 0) {
    await Promise.all(matchingPromises);
    console.log(`Generated ${matchingPromises.length} potential matches for lost item ${lostItemId}`);
  }
});

// TRIGGER: When a new Found Item is reported
exports.onFoundItemCreated = onDocumentCreated("found_items/{itemId}", async (event) => {
  const foundItem = event.data.data();
  const foundItemId = event.params.itemId;

  // Fetch all lost items that are open
  const lostItemsSnap = await db.collection("lost_items").where("status", "==", "open").get();
  
  const matchingPromises = [];

  lostItemsSnap.forEach((doc) => {
    const lostItem = doc.data();
    const score = calculateMatchScore(lostItem, foundItem);

    if (score >= 0.6) {
      // Possible match synthesized! Write to 'matches' collection
      matchingPromises.push(db.collection("matches").add({
        lostItemId: doc.id,
        foundItemId: foundItemId,
        similarityScore: score,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
    }
  });

  if (matchingPromises.length > 0) {
    await Promise.all(matchingPromises);
    console.log(`Generated ${matchingPromises.length} potential matches for found item ${foundItemId}`);
  }
});

// TRIGGER: When a new Match is synthesized, notify the user.
exports.onMatchCreated = onDocumentCreated("matches/{matchId}", async (event) => {
  const match = event.data.data();
  
  // Get the person who lost the item
  const lostItemDoc = await db.collection("lost_items").doc(match.lostItemId).get();
  if (!lostItemDoc.exists) return;
  const lostItem = lostItemDoc.data();

  // Get their push token
  const userDoc = await db.collection("users").doc(lostItem.userId).get();
  if (!userDoc.exists) return;
  const user = userDoc.data();

  if (user.expoPushToken) {
    // Send standard Expo push notification payload using fetch
    const message = {
      to: user.expoPushToken,
      sound: "default",
      title: "🔎 Potential Match Found!",
      body: `We found a possible match for your lost ${lostItem.title}. Tap to check it out!`,
      data: { matchId: event.params.matchId },
    };

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      console.log("Notification sent to", user.expoPushToken);
    } catch(err) {
      console.error("Failed to send push notification", err);
    }
  }
});
