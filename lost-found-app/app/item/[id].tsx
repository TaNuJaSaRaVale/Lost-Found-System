import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams(); 
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [userClaimId, setUserClaimId] = useState<string | null>(null);
  
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [proofDescription, setProofDescription] = useState('');

  useEffect(() => {
    const fetchItemAndClaim = async () => {
      if (!id || !type) return;
      try {
        const docRef = doc(db, type as string, id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setItem({ id: docSnap.id, ...docSnap.data() });
        } else {
          Alert.alert('Error', 'Item not found');
          router.back();
          return;
        }

        if (auth.currentUser) {
          const claimQ = query(
             collection(db, 'claims'), 
             where('itemId', '==', id), 
             where('claimantId', '==', auth.currentUser!.uid)
          );
          const claimSnap = await getDocs(claimQ);
          if (!claimSnap.empty) {
             setUserClaimId(claimSnap.docs[0].id);
          }
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to fetch item details');
      } finally {
        setLoading(false);
      }
    };
    fetchItemAndClaim();
  }, [id, type]);

  const handleClaimInitiate = () => {
    if (!auth.currentUser) {
      Alert.alert('Authentication Required', 'Please log in to claim an item.');
      return;
    }
    setProofDescription('');
    setIsClaimModalVisible(true);
  };

  const submitClaim = async () => {
    if (!proofDescription.trim()) {
      Alert.alert('Proof Required', 'Please provide some details to prove this item belongs to you.');
      return;
    }

    setClaiming(true);
    try {
      // 0. Double check we have all data
      if (!auth.currentUser || !item) {
        Alert.alert('Error', 'Session lost. Please log in again.');
        return;
      }

      // 1. Create claim doc
      console.log("📝 Step 1: Creating claim document...");
      const claimRef = doc(collection(db, 'claims'));
      const claimData = {
        itemId: id,
        itemType: type,
        claimantId: auth.currentUser.uid,
        ownerId: item.userId || '',
        status: 'pending',
        proofDescription: proofDescription.trim(),
        createdAt: serverTimestamp()
      };
      
      await setDoc(claimRef, claimData);
      console.log("✅ Step 1 complete");
      
      // 2. Update item status (Safe partial update)
      console.log("🔄 Step 2: Updating item status...");
      const itemRef = doc(db, type as string, id as string);
      await updateDoc(itemRef, {
        status: 'pending_claim'
      });
      console.log("✅ Step 2 complete");
      
      setIsClaimModalVisible(false);
      Alert.alert('Success 🎉', 'Claim submitted! The owner will review your proof soon.');
      router.back();
    } catch (error: any) {
      console.error("❌ SUBMIT CLAIM ERROR:", error);
      
      if (error.message.includes('permission')) {
        Alert.alert(
          'Permission Denied', 
          'Your Firestore Rules are still blocking this update. Please ensure you clicked "Publish" on the Firebase website.'
        );
      } else {
        Alert.alert('Submission Failed', `There was a technical issue: ${error.message}`);
      }
    } finally {
      setClaiming(false);
    }
  };



  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!item) return null;

  const isOwner = auth.currentUser?.uid === item.userId;
  const isPending = item.status === 'pending_claim';

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="h-72 bg-gray-100 items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            className="w-full h-full" 
            resizeMode="cover"
          />
        ) : (
          <View className="items-center">
            <Ionicons name="camera-outline" size={48} color="#cbd5e1" />
            <Text className="text-gray-400 mt-2 font-medium">No image provided</Text>
          </View>
        )}
      </View>


      <View className="p-6">
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-3xl font-bold text-text flex-1 mr-4">{item.title}</Text>
          {isPending && (
            <View className="bg-yellow-100 px-3 py-1 rounded-full">
              <Text className="text-yellow-700 text-xs font-bold">Pending Claim</Text>
            </View>
          )}
        </View>

        <Text className="text-primary text-sm font-semibold mb-6">{item.category}</Text>

        <View className="bg-surface p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
          <Text className="text-sm text-textLight mb-1">Description</Text>
          <Text className="text-base text-text">{item.description || 'No description provided.'}</Text>
        </View>

        <View className="flex-row justify-between mb-8">
          <View className="flex-1 bg-surface p-4 rounded-2xl border border-gray-100 shadow-sm mr-2">
            <Text className="text-xs text-textLight mb-1">Location</Text>
            <Text className="text-base font-semibold text-text">{item.location}</Text>
          </View>
          <View className="flex-1 bg-surface p-4 rounded-2xl border border-gray-100 shadow-sm ml-2">
            <Text className="text-xs text-textLight mb-1">{type === 'lost_items' ? 'Date Lost' : 'Date Found'}</Text>
            <Text className="text-base font-semibold text-text">{item.dateTime || item.dateLost || item.dateFound || 'Unknown'}</Text>
          </View>
        </View>

        {item.reward && (
          <View className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-8 flex-row items-center">
            <View className="bg-primary/10 p-2 rounded-full mr-3">
              <Ionicons name="gift" size={20} color="#4F46E5" />
            </View>
            <View>
              <Text className="text-xs text-primary font-bold uppercase tracking-wider">Reward Offered</Text>
              <Text className="text-lg font-bold text-text">{item.reward}</Text>
            </View>
          </View>
        )}

        {!isOwner && item.status !== 'claimed' && (
          <>
            {userClaimId ? (
              <TouchableOpacity 
                className="bg-primary/10 py-4 rounded-xl items-center flex-row justify-center border border-primary/20 shadow-sm"
                onPress={() => router.push(`/chat/${userClaimId}`)}
              >
                <Ionicons name="chatbubbles" size={20} color="#4F46E5" />
                <Text className="text-primary font-bold text-lg ml-2">Message Owner</Text>
              </TouchableOpacity>
            ) : !isPending && (
              <TouchableOpacity 
                className="bg-primary py-4 rounded-xl items-center shadow-sm"
                onPress={handleClaimInitiate}
                disabled={claiming}
              >
                {claiming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-lg">This is Mine!</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {isOwner && isPending && (
          <View className="bg-orange-50 p-4 rounded-xl border border-orange-200">
            <Text className="text-orange-800 text-center font-bold">
              Someone has claimed this item! Check your Profile to review.
            </Text>
          </View>
        )}

        {item.status === 'claimed' && (
          <View className="bg-green-50 p-4 rounded-xl border border-green-200">
            <Text className="text-green-800 text-center font-bold pb-1">
              Item Successfully Claimed & Resolved!
            </Text>
          </View>
        )}
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isClaimModalVisible}
        onRequestClose={() => setIsClaimModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text">Verify Ownership</Text>
              <TouchableOpacity onPress={() => setIsClaimModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text className="text-textLight mb-4">
              Please provide proof that this item belongs to you. Mention unique marks, details, or exact contents.
            </Text>

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-text text-base mb-6 min-h-[120px]"
              placeholder="e.g. It has a small scratch on the logo and a sticker of a cat on the bottom..."
              value={proofDescription}
              onChangeText={setProofDescription}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity 
              className="bg-primary py-4 rounded-xl items-center shadow-md mb-2"
              onPress={submitClaim}
              disabled={claiming}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">Submit Proof & Claim</Text>
              )}
            </TouchableOpacity>
            
            <Text className="text-center text-xs text-textLight mt-2 mb-4">
              Item owner will review your proof before responding.
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

