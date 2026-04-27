import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_STYLES: Record<string, { color: string; bg: string; darkColor: string; darkBg: string }> = {
  'electronics': { color: 'text-blue-700', bg: 'bg-blue-100', darkColor: 'text-blue-200', darkBg: 'bg-blue-900/30' },
  'wallet': { color: 'text-green-700', bg: 'bg-green-100', darkColor: 'text-green-200', darkBg: 'bg-green-900/30' },
  'documents': { color: 'text-red-700', bg: 'bg-red-100', darkColor: 'text-red-200', darkBg: 'bg-red-900/30' },
  'keys': { color: 'text-yellow-700', bg: 'bg-yellow-100', darkColor: 'text-yellow-200', darkBg: 'bg-yellow-900/30' },
  'clothing': { color: 'text-purple-700', bg: 'bg-purple-100', darkColor: 'text-purple-200', darkBg: 'bg-purple-900/30' },
  'others': { color: 'text-slate-700', bg: 'bg-slate-100', darkColor: 'text-slate-200', darkBg: 'bg-slate-800/30' },
};

const getCategoryStyle = (category: string) => {
  const cat = category?.toLowerCase() || 'others';
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES['others'];
};

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id, type, sourceItemId, sourceItemType } = useLocalSearchParams(); 
  const { theme } = useTheme();
  const { profile } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [userClaimId, setUserClaimId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [proofDescription, setProofDescription] = useState('');

  // Report User State
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingUser, setReportingUser] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => setCurrentUser(user));
    return unsubscribe;
  }, []);

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

        if (currentUser) {
          const claimQ = query(
             collection(db, 'claims'), 
             where('itemId', '==', id), 
             where('claimantId', '==', currentUser.uid)
          );
          const claimSnap = await getDocs(claimQ);
          if (!claimSnap.empty) {
             const claimData = claimSnap.docs[0].data();
             setUserClaimId(claimSnap.docs[0].id);
             setClaimStatus(claimData.status);
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
  }, [id, type, currentUser]);

  const handleClaimInitiate = () => {
    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please log in to claim an item.');
      return;
    }
    setProofDescription('');
    setIsClaimModalVisible(true);
  };

  const handleFoundInitiate = () => {
    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please log in to respond to this item.');
      return;
    }
    setProofDescription('');
    setIsClaimModalVisible(true);
  };

  const submitClaim = async () => {
    if (!proofDescription.trim()) {
      Alert.alert('Message Required', type === 'lost_items' ? 'Please provide some details on how/where you found it.' : 'Please provide some details to prove this item belongs to you.');
      return;
    }

    setClaiming(true);
    try {
      if (!currentUser || !item) return;

      const claimantDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const ownerDoc = await getDoc(doc(db, 'users', item.userId));
      
      const claimantData = claimantDoc.exists() ? claimantDoc.data() : {};
      const ownerData = ownerDoc.exists() ? ownerDoc.data() : {};

      let matchedSourceId = sourceItemId as string | undefined;
      let matchedSourceType = sourceItemType as string | undefined;
      
      if (!matchedSourceId && currentUser) {
         if (type === 'found_items') {
            const myLostQ = query(collection(db, 'lost_items'), where('userId', '==', currentUser.uid), where('status', '==', 'open'));
            const myLostSnap = await getDocs(myLostQ);
            if (!myLostSnap.empty) {
               const match = myLostSnap.docs.find(d => d.data().category === item.category) || myLostSnap.docs[0];
               matchedSourceId = match.id;
               matchedSourceType = 'lost_items';
            }
         } else if (type === 'lost_items') {
            const myFoundQ = query(collection(db, 'found_items'), where('userId', '==', currentUser.uid), where('status', '==', 'open'));
            const myFoundSnap = await getDocs(myFoundQ);
            if (!myFoundSnap.empty) {
               const match = myFoundSnap.docs.find(d => d.data().category === item.category) || myFoundSnap.docs[0];
               matchedSourceId = match.id;
               matchedSourceType = 'found_items';
            }
         }
      }

      const claimRef = doc(collection(db, 'claims'));
      const claimData = {
        itemId: id,
        itemType: type,
        sourceItemId: matchedSourceId || null,
        sourceItemType: matchedSourceType || null,
        itemTitle: item.title,
        claimantId: currentUser.uid,
        claimantName: claimantData.name || currentUser.displayName || 'Unknown User',
        claimantClass: claimantData.studentClass || 'Unknown Class',
        ownerId: item.userId || '',
        ownerName: ownerData.name || 'Owner',
        status: 'pending',
        proofDescription: proofDescription.trim(),
        createdAt: serverTimestamp()
      };
      
      await setDoc(claimRef, claimData);
      
      const itemRef = doc(db, type as string, id as string);
      await updateDoc(itemRef, {
        status: type === 'lost_items' ? 'pending_found' : 'pending_claim'
      });
      
      if (matchedSourceId && matchedSourceType) {
        const sourceItemRef = doc(db, matchedSourceType, matchedSourceId);
        await updateDoc(sourceItemRef, {
          status: matchedSourceType === 'lost_items' ? 'pending_found' : 'pending_claim'
        });
      }
      
      setIsClaimModalVisible(false);
      Alert.alert('Success 🎉', type === 'lost_items' ? 'Message sent! The owner will review your details soon.' : 'Claim submitted! The owner will review your proof soon.');
      router.back();
    } catch (error: any) {
      Alert.alert('Submission Failed', error.message);
    } finally {
      setClaiming(false);
    }
  };

  const submitUserReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for reporting this user.');
      return;
    }
    
    setReportingUser(true);
    try {
      if (!currentUser || !item) return;

      const reportRef = doc(collection(db, 'user_reports'));
      const reportData = {
        reportedUserId: item.userId,
        reportedBy: currentUser.uid,
        reason: reportReason.trim(),
        itemId: id as string,
        createdAt: serverTimestamp()
      };
      
      await setDoc(reportRef, reportData);
      
      setIsReportModalVisible(false);
      setReportReason('');
      Alert.alert('Report Submitted', 'Thank you. An admin will review this user.');
    } catch (error: any) {
      Alert.alert('Report Failed', error.message);
    } finally {
      setReportingUser(false);
    }
  };

  const handleDeleteItem = () => {
    Alert.alert(
      "Delete Report",
      "Are you sure you want to delete this report? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, type as string, id as string));
              
              // Cascade delete claims
              const claimsQ = query(collection(db, 'claims'), where('itemId', '==', id as string));
              const claimsSnap = await getDocs(claimsQ);
              claimsSnap.forEach(async (claimDoc) => {
                 await deleteDoc(doc(db, 'claims', claimDoc.id));
              });

              Alert.alert("Success", "Item deleted successfully.");
              router.replace(`/(tabs)/${type === 'lost_items' ? 'home' : 'found'}`);
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Could not delete the item.");
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const TimelineStep = ({ title, sub, date, active, completed, last }: any) => (
    <View className="flex-row min-h-[70px]">
      <View className="items-center mr-4">
        <View className={`w-6 h-6 rounded-full items-center justify-center ${completed ? 'bg-secondary' : active ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-800'}`}>
           {completed ? (
              <Ionicons name="checkmark" size={14} color="white" />
           ) : (
              <View className={`w-2 h-2 rounded-full ${active ? 'bg-white' : 'bg-gray-400'}`} />
           )}
        </View>
        {!last && <View className={`w-[2px] flex-1 ${completed ? 'bg-secondary' : 'bg-gray-200 dark:bg-gray-800'}`} />}
      </View>
      <View className="pb-6">
        <Text className={`text-base font-bold ${active || completed ? 'text-text dark:text-text-dark' : 'text-textLight dark:text-textLight-dark'}`}>{title}</Text>
        <Text className="text-textLight dark:text-textLight-dark text-xs">{sub}</Text>
        {date && <Text className="text-primary font-bold text-[10px] mt-1">{date}</Text>}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark justify-center items-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!item) return null;

  const isReporter = currentUser?.uid === item.userId;
  const isPending = item.status === 'pending_claim' || item.status === 'pending_handover' || item.status === 'pending_found';
  const isReturned = item.status === 'returned' || item.status === 'claimed';
  const catStyle = getCategoryStyle(item.category);

  // Timeline Logic
  const timeline = [
    { title: 'Reported', sub: `Item marked as ${type === 'lost_items' ? 'Lost' : 'Found'}`, date: item.dateLost || item.dateFound || 'Initially', completed: true },
    { title: 'Spotted', sub: 'Someone identified the match', active: isPending && !isReturned, completed: isReturned || claimStatus === 'approved' || item.status === 'pending_handover' },
    { title: 'Verified', sub: 'Owner confirmed ownership', active: (claimStatus === 'approved' || item.status === 'pending_handover') && !isReturned, completed: isReturned || item.status === 'pending_handover' },
    { title: 'Handed Over', sub: 'Item returned to owner', active: isReturned, completed: isReturned, last: true }
  ];

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark">
      <View className="h-80 bg-gray-100 dark:bg-gray-900 items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="items-center">
            <Ionicons name="camera-outline" size={64} color="#94A3AF" />
            <Text className="text-textLight mt-4 font-bold text-lg uppercase tracking-widest">No Image</Text>
          </View>
        )}
        <View className="absolute top-10 left-6">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="bg-black/20 p-2 rounded-full blur-md"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="p-8 -mt-8 bg-background dark:bg-background-dark rounded-t-[40px] shadow-2xl">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1">
             <Text className="text-3xl font-extrabold text-text dark:text-text-dark mb-2">{item.title}</Text>
             <View className={`self-start px-4 py-1.5 rounded-full ${catStyle.bg} dark:${catStyle.darkBg}`}>
                <Text className={`text-[10px] font-extrabold uppercase tracking-widest ${catStyle.color} dark:${catStyle.darkColor}`}>
                  {item.category}
                </Text>
             </View>
          </View>
          <View className="items-end">
             {isReporter && (
                <TouchableOpacity onPress={handleDeleteItem} className="mb-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-full border border-red-200 dark:border-red-800">
                   <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
             )}
             {!isReporter && currentUser && (
                <TouchableOpacity onPress={() => setIsReportModalVisible(true)} className="mb-2 bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                   <Ionicons name="flag-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
             )}
             {isPending && <View className="bg-accent/10 px-3 py-1 rounded-full border border-accent/20"><Text className="text-accent font-bold text-[10px] uppercase">Pending</Text></View>}
             {isReturned && <View className="bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20"><Text className="text-secondary font-bold text-[10px] uppercase">Returned</Text></View>}
          </View>
        </View>

        <View className="flex-row justify-between mb-8">
           <View className="flex-1 items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl mr-2">
              <Ionicons name="location" size={20} color="#6366F1" />
              <Text className="text-text dark:text-text-dark font-bold mt-2" numberOfLines={1}>{item.location}</Text>
              <Text className="text-textLight dark:text-textLight-dark text-[10px]">Location</Text>
           </View>
           <View className="flex-1 items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl ml-2">
              <Ionicons name="calendar" size={20} color="#6366F1" />
              <Text className="text-text dark:text-text-dark font-bold mt-2" numberOfLines={1}>{item.dateLost || item.dateFound || 'Recent'}</Text>
              <Text className="text-textLight dark:text-textLight-dark text-[10px]">Time</Text>
           </View>
        </View>

        <Text className="text-lg font-bold text-text dark:text-text-dark mb-4">Description</Text>
        <Text className="text-textLight dark:text-textLight-dark text-base leading-6 mb-8">
          {item.description || "The reporter didn't provide a detailed description yet."}
        </Text>

        {/* Journey Timeline */}
        <View className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 mb-8">
           <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-6">Item Journey Timeline</Text>
           {timeline.map((t, idx) => <TimelineStep key={idx} {...t} />)}
        </View>

        {item.reward && (
          <View className="bg-primary/5 p-6 rounded-[32px] border border-primary/10 mb-8 flex-row items-center">
            <View className="bg-primary/10 p-3 rounded-2xl mr-4">
              <Ionicons name="gift" size={24} color="#6366F1" />
            </View>
            <View>
              <Text className="text-[10px] text-primary font-bold uppercase tracking-widest">Reward Offered</Text>
              <Text className="text-xl font-bold text-text dark:text-text-dark">{item.reward}</Text>
            </View>
          </View>
        )}

        {!isReporter && !isReturned && type === 'found_items' && (
          <>
            {userClaimId ? (
              claimStatus === 'rejected' ? (
                 <View className="bg-red-50 dark:bg-red-900/30 py-5 rounded-2xl items-center shadow-xl border border-red-200 dark:border-red-800">
                    <Text className="text-red-500 font-extrabold text-lg">Claim Rejected</Text>
                 </View>
              ) : (
                <TouchableOpacity 
                  className="bg-primary py-5 rounded-2xl items-center flex-row justify-center shadow-xl shadow-primary/30"
                  onPress={() => router.push(`/chat/${userClaimId}`)}
                >
                  <Ionicons name="chatbubbles" size={22} color="white" />
                  <Text className="text-white font-extrabold text-lg ml-3">Message Finder</Text>
                </TouchableOpacity>
              )
            ) : !isPending && (
              <TouchableOpacity 
                className="bg-primary py-5 rounded-2xl items-center shadow-xl shadow-primary/30"
                onPress={handleClaimInitiate}
                disabled={claiming}
              >
                {claiming ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-lg">Proclaim: This is mine!</Text>}
              </TouchableOpacity>
            )}
          </>
        )}

        {!isReporter && !isReturned && type === 'lost_items' && (
          <>
            {userClaimId ? (
              claimStatus === 'rejected' ? (
                 <View className="bg-red-50 dark:bg-red-900/30 py-5 rounded-2xl items-center shadow-xl border border-red-200 dark:border-red-800">
                    <Text className="text-red-500 font-extrabold text-lg">Claim Rejected</Text>
                 </View>
              ) : (
                <TouchableOpacity 
                  className="bg-secondary py-5 rounded-2xl items-center flex-row justify-center shadow-xl shadow-secondary/30"
                  onPress={() => router.push(`/chat/${userClaimId}`)}
                >
                  <Ionicons name="chatbubbles" size={22} color="white" />
                  <Text className="text-white font-extrabold text-lg ml-3">Message Owner</Text>
                </TouchableOpacity>
              )
            ) : !isPending && (
              <TouchableOpacity 
                className="bg-secondary py-5 rounded-2xl items-center shadow-xl shadow-secondary/30"
                onPress={handleFoundInitiate}
                disabled={claiming}
              >
                {claiming ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-lg">I found this item</Text>}
              </TouchableOpacity>
            )}
          </>
        )}

        {isReporter && isPending && (
          <View className="bg-accent/5 p-6 rounded-[32px] border border-accent/20 flex-row items-center">
            <Ionicons name="alert-circle" size={24} color="#F59E0B" />
            <Text className="text-accent dark:text-accent-dark font-bold ml-3 flex-1">
              Someone has claimed this! Visit your profile to review proof.
            </Text>
          </View>
        )}

        {isReturned && (
          <View className="bg-secondary/5 p-6 rounded-[32px] border border-secondary/20 flex-row items-center">
            <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
            <Text className="text-secondary dark:text-secondary-dark font-bold ml-3 flex-1 text-center">
              Resolved & Returned! Case Closed.
            </Text>
          </View>
        )}
      </View>
      <View className="h-20" />

      <Modal animationType="slide" transparent={true} visible={isClaimModalVisible} onRequestClose={() => setIsClaimModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface dark:bg-surface-dark rounded-t-[40px] p-8 shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-text dark:text-text-dark">
                {type === 'lost_items' ? 'Contact Owner' : 'Verify Ownership'}
              </Text>
              <TouchableOpacity onPress={() => setIsClaimModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color="#9BA3AF" />
              </TouchableOpacity>
            </View>

            <Text className="text-textLight dark:text-textLight-dark mb-6 text-base">
              {type === 'lost_items' 
                ? "Let the owner know where and when you found their item. This will start a secure chat." 
                : "To prevent scams, please describe unique marks or specific details that only the true owner would know."}
            </Text>

            <TextInput
              className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-5 text-text dark:text-text-dark text-base mb-8 min-h-[140px]"
              placeholder={type === 'lost_items' ? "e.g. I found it near the library this morning. I left it with the front desk..." : "e.g. Broken corner on the left, name written in blue ink inside..."}
              placeholderTextColor="#9CA3AF"
              value={proofDescription}
              onChangeText={setProofDescription}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity className={`${type === 'lost_items' ? 'bg-secondary shadow-secondary/30' : 'bg-primary shadow-primary/30'} py-5 rounded-2xl items-center shadow-xl`} onPress={submitClaim} disabled={claiming}>
              {claiming ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-lg">{type === 'lost_items' ? 'Send Message' : 'Send Verification Request'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report User Modal */}
      <Modal animationType="fade" transparent={true} visible={isReportModalVisible} onRequestClose={() => setIsReportModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <View className="bg-surface dark:bg-surface-dark rounded-[32px] p-6 w-full shadow-2xl border border-red-100 dark:border-red-900/20">
            <View className="flex-row items-center mb-4">
              <View className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full mr-4">
                <Ionicons name="warning" size={24} color="#ef4444" />
              </View>
              <Text className="text-xl font-bold text-text dark:text-text-dark flex-1">Report User</Text>
              <TouchableOpacity onPress={() => setIsReportModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text className="text-textLight dark:text-textLight-dark mb-4 text-sm">
              Please let us know why you are reporting the user who posted this item. An admin will review it shortly.
            </Text>

            <TextInput
              className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-5 text-text dark:text-text-dark text-base mb-6 min-h-[100px]"
              placeholder="Reason for reporting (e.g., spam, scam, offensive content)"
              placeholderTextColor="#9CA3AF"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              textAlignVertical="top"
            />

            <View className="flex-row space-x-3 gap-3">
              <TouchableOpacity 
                className="bg-gray-100 dark:bg-gray-800 py-4 rounded-2xl flex-1 items-center" 
                onPress={() => setIsReportModalVisible(false)}
                disabled={reportingUser}
              >
                <Text className="text-text dark:text-text-dark font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-red-500 py-4 rounded-2xl flex-1 items-center shadow-lg shadow-red-500/30" 
                onPress={submitUserReport} 
                disabled={reportingUser}
              >
                {reportingUser ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

