import { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export interface ItemData {
  id: string;
  userId?: string;
  status?: string;
  category?: string;
  location?: string;
  title?: string;
  description?: string;
  [key: string]: any;
}

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [myLostItems, setMyLostItems] = useState<ItemData[]>([]);
  const [allFoundItems, setAllFoundItems] = useState<ItemData[]>([]);
  const [myFoundItems, setMyFoundItems] = useState<ItemData[]>([]);
  const [allLostItems, setAllLostItems] = useState<ItemData[]>([]);

  // --- MATCHING ENGINE ---
  const calculateMatchScore = (item1: ItemData, item2: ItemData) => {
    let score = 0;
    // 1. Category Matching (0.3)
    if (item1.category?.toLowerCase() === item2.category?.toLowerCase()) score += 0.3;
    // 2. Location Matching (0.3)
    if (item1.location?.toLowerCase().includes(item2.location?.toLowerCase()) || 
        item2.location?.toLowerCase().includes(item1.location?.toLowerCase())) score += 0.3;
    // 3. Keyword Matching (0.4)
    // Strip punctuation and split by whitespace
    const extractWords = (t?: string) => {
       if (!t) return [];
       const words = t.toLowerCase().replace(/[^\w\s]/g, '').match(/\b\w+\b/g) || [];
       return words.slice(0, 50); // Cap at 50 words to prevent keyword stuffing
    };
    const words1 = new Set([...extractWords(item1.title), ...extractWords(item1.description)]);
    const words2 = new Set([...extractWords(item2.title), ...extractWords(item2.description)]);
    let matchAmount = 0;
    words2.forEach(w => { if (words1.has(w) && w.length > 1) matchAmount++; });
    if (matchAmount > 0) score += Math.min(0.4, (matchAmount / 3) * 0.4);
    return Math.min(1.0, score);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    setLoading(true);

    // 1. Listener for user's Lost Items
    const lostMyQ = query(collection(db, 'lost_items'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeMyLost = onSnapshot(lostMyQ, (snapshot) => {
      setMyLostItems(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ItemData)).filter(i => i.status === 'open'));
    }, (error) => console.log(error));

    // 2. Listener for user's Found Items
    const foundMyQ = query(collection(db, 'found_items'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeMyFound = onSnapshot(foundMyQ, (snapshot) => {
      setMyFoundItems(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ItemData)).filter(i => i.status === 'open'));
    }, (error) => console.log(error));

    // 3. Listener for All Other Lost Items (Index-free)
    const allLostQ = query(collection(db, 'lost_items'));
    const unsubscribeAllLost = onSnapshot(allLostQ, (snapshot) => {
      setAllLostItems(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ItemData)).filter(i => i.status === 'open' && i.userId !== auth.currentUser?.uid));
    }, (error) => console.log(error));

    // 4. Listener for All Other Found Items (Index-free)
    const allFoundQ = query(collection(db, 'found_items'));
    const unsubscribeAllFound = onSnapshot(allFoundQ, (snapshot) => {
      setAllFoundItems(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ItemData)).filter(i => i.status === 'open' && i.userId !== auth.currentUser?.uid));
      setLoading(false);
    }, (error) => console.log(error));

    return () => {
      unsubscribeMyLost();
      unsubscribeMyFound();
      unsubscribeAllLost();
      unsubscribeAllFound();
    };
  }, [auth.currentUser]);

  // 3. Real-time Match Calculation Logic
  useEffect(() => {
    const localMatches: any[] = [];
    
    // Direction A: Items I lost vs Items Others found
    myLostItems.forEach(lost => {
      allFoundItems.forEach(found => {
        const score = calculateMatchScore(lost, found);
        if (score >= 0.35) { 
          localMatches.push({
            id: `${lost.id}_${found.id}`,
            similarityScore: score,
            matchType: 'lost_mine', // I lost this, someone found that
            myTitle: lost.title,
            myId: lost.id,
            myType: 'lost_items',
            otherTitle: found.title,
            otherLocation: found.location,
            otherId: found.id,
            otherType: 'found_items'
          });
        }
      });
    });

    // Direction B: Items I found vs Items Others lost
    myFoundItems.forEach(found => {
      allLostItems.forEach(lost => {
        const score = calculateMatchScore(found, lost);
        if (score >= 0.35) {
          localMatches.push({
            id: `${found.id}_${lost.id}`,
            similarityScore: score,
            matchType: 'found_mine', // I found this, someone lost that
            myTitle: found.title,
            myId: found.id,
            myType: 'found_items',
            otherTitle: lost.title,
            otherLocation: lost.location,
            otherId: lost.id,
            otherType: 'lost_items'
          });
        }
      });
    });

    setMatches(localMatches.sort((a,b) => b.similarityScore - a.similarityScore));
  }, [myLostItems, allFoundItems, myFoundItems, allLostItems]);







  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark p-4">
      <View className="mb-4">
        <Text className="text-sm text-textLight dark:text-textLight-dark">Potential items that match your lost reports</Text>
      </View>
      {matches.length === 0 ? (
         <View className="flex-1 justify-center items-center">
            <Text className="text-6xl mb-4">🕵️‍♂️</Text>
            <Text className="text-textLight dark:text-textLight-dark font-bold text-lg">No matches yet.</Text>
            <Text className="text-textLight dark:text-textLight-dark text-center mt-2 px-4 italic">Our matching engine is actively scanning. We'll notify you when a match is found!</Text>
         </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View className="bg-surface dark:bg-surface-dark p-4 rounded-3xl shadow-sm mb-4 border border-primary/10 dark:border-primary/20">
              <View className="flex-row justify-between items-center mb-4">
                 <View className="flex-row items-center">
                   <Ionicons name="sparkles" size={16} color="#4F46E5" />
                   <Text className="text-xs font-bold text-primary ml-1">
                      {Math.round(item.similarityScore * 100)}% Match
                   </Text>
                 </View>
                 <View className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    <Text className="text-[10px] font-bold text-textLight dark:text-textLight-dark tracking-widest">POTENTIAL</Text>
                 </View>
              </View>

              <View className="mb-4">
                <Text className="text-textLight dark:text-textLight-dark text-xs mb-1 uppercase tracking-wider font-semibold">
                  {item.matchType === 'lost_mine' ? "Matched your Lost report:" : "Matched the item you Found:"}
                </Text>
                <Text className="text-base font-bold text-primary mb-2 italic">"{item.myTitle}"</Text>
                
                <View className="h-[1px] bg-gray-100 dark:bg-gray-800 w-full my-3" />

                <Text className="text-lg font-bold text-text dark:text-text-dark mb-1">{item.otherTitle}</Text>
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text className="text-textLight dark:text-textLight-dark text-sm ml-1">{item.otherLocation}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                className="bg-primary py-4 rounded-xl items-center flex-row justify-center shadow-sm" 
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.otherId, type: item.otherType, sourceItemId: item.myId, sourceItemType: item.myType } })}
              >
                <Ionicons name="eye-outline" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  {item.matchType === 'lost_mine' ? "Is this yours?" : "Check Report"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

    </View>
  );
}
