import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { signOut, updateProfile } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<any[]>([]);
  const [activeReturns, setActiveReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [resolvedClaims, setResolvedClaims] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const fetchedName = data.name || auth.currentUser?.displayName || '';
          const fetchedClass = data.studentClass || '';
          setUserName(fetchedName);
          setStudentClass(fetchedClass);
          setNewName(fetchedName);
          setNewClass(fetchedClass);
        }
      } catch (error) {
         console.error("Error fetching user profile:", error);
      }
    };
    fetchProfile();

    // 1. Listen for Pending Claims (Need Approval)
    const qPending = query(
      collection(db, 'claims'),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
      setClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 2. Listen for Approved Claims (Need Handover)
    const qApproved = query(
      collection(db, 'claims'),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'approved')
    );

    const unsubscribeApproved = onSnapshot(qApproved, (snapshot) => {
      setActiveReturns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Listen for Resolved (Returned) Claims
    const qResolved = query(
      collection(db, 'claims'),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'returned')
    );

    const unsubscribeResolved = onSnapshot(qResolved, (snapshot) => {
      setResolvedClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribePending();
      unsubscribeApproved();
      unsubscribeResolved();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Logout Error', (error as Error).message);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim() || !newClass.trim()) {
      Alert.alert('Error', 'Name and Class cannot be empty.');
      return;
    }
    try {
      setSavingProfile(true);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName.trim() });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          name: newName.trim(),
          studentClass: newClass.trim()
        });
        setUserName(newName.trim());
        setStudentClass(newClass.trim());
        setIsEditingProfile(false);
        Alert.alert('Success', 'Profile updated successfully.');
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleApprove = async (claimId: string, itemId: string, itemType: string) => {
    try {
      await updateDoc(doc(db, 'claims', claimId), { status: 'approved' });
      await updateDoc(doc(db, itemType, itemId), { status: 'pending_handover' });
      Alert.alert('Success', 'Claim approved! You can now chat to coordinate the return.');
    } catch (error) {
      console.error("Error approving claim:", error);
      Alert.alert('Error', 'Failed to approve claim.');
    }
  };

  const handleReject = async (claimId: string, itemId: string, itemType: string) => {
    try {
      await updateDoc(doc(db, 'claims', claimId), { status: 'rejected' });
      await updateDoc(doc(db, itemType, itemId), { status: 'open' });
      Alert.alert('Success', 'Claim rejected.');
    } catch (error) {
       console.error("Error rejecting claim:", error);
       Alert.alert('Error', 'Failed to reject claim.');
    }
  };

  const handleMarkReturned = async (claimId: string, itemId: string, itemType: string) => {
    Alert.alert(
      "Confirm Return",
      "Has the item been physically returned? This will close the case.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Resolved", 
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'claims', claimId), { status: 'returned' });
              await updateDoc(doc(db, itemType, itemId), { status: 'returned' });
              Alert.alert('Success', 'Item marked as returned and resolved!');
            } catch (error) {
              Alert.alert('Error', 'Failed to update status.');
            }
          }
        }
      ]
    );
  };


  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      <View className="bg-surface w-full p-6 rounded-3xl shadow-sm border border-gray-100 items-center mb-8 mt-10">
        <View className="bg-primary/20 p-4 rounded-full mb-4">
           <Text className="text-3xl font-bold text-primary">👤</Text>
        </View>
        
        {isEditingProfile ? (
          <View className="w-full mb-4">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3 text-text text-base"
              placeholder="Full Name"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3 text-text text-base"
              placeholder="Class (e.g. 2nd Year AIML)"
              value={newClass}
              onChangeText={setNewClass}
            />
            <View className="flex-row justify-end space-x-2 gap-2">
              <TouchableOpacity 
                className="bg-gray-200 py-2 px-4 rounded-xl"
                onPress={() => {
                  setIsEditingProfile(false);
                  setNewName(userName);
                  setNewClass(studentClass);
                }}
                disabled={savingProfile}
              >
                <Text className="text-text font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-primary py-2 px-4 rounded-xl"
                onPress={handleUpdateProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="items-center mb-4">
            <View className="flex-row items-center mb-1">
              <Text className="text-2xl font-bold text-text mr-2">
                {userName || "Your Profile"}
              </Text>
              <TouchableOpacity onPress={() => setIsEditingProfile(true)}>
                <Text className="text-primary text-sm font-bold">Edit</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-primary font-medium mb-1">{studentClass || "Add Your Class"}</Text>
            <Text className="text-textLight">{auth.currentUser?.email}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          className="bg-error py-4 w-full rounded-xl items-center flex-row justify-center"
          onPress={handleLogout}
        >
          <Text className="text-white font-bold text-lg">Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Approvals */}
      <Text className="text-xl font-bold text-text mb-4 mt-4">Pending Approvals</Text>
      
      {loading ? (
        <ActivityIndicator color="#4F46E5" />
      ) : claims.length === 0 ? (
        <View className="items-center bg-surface p-6 rounded-3xl border border-gray-100 mb-8">
           <Text className="text-textLight text-center">No pending claims to review.</Text>
        </View>
      ) : (
        claims.map(claim => (
          <View key={claim.id} className="bg-surface p-5 rounded-3xl shadow-sm border border-yellow-200 mb-4">
            <View className="flex-row items-center mb-2">
              <View className="bg-yellow-100 p-2 rounded-full mr-2">
                <Ionicons name="person-circle" size={18} color="#b45309" />
              </View>
              <Text className="text-lg font-bold text-text">
                {claim.claimantName || 'Someone'} has claimed
              </Text>
            </View>
            
            <View className="flex-row items-center mb-3">
               <Text className="text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded-lg">
                 {claim.claimantClass || 'General'}
               </Text>
            </View>

            <Text className="text-sm text-textLight mb-4 italic">"{claim.itemTitle || 'Unknown Item'}"</Text>

            <View className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
              <Text className="text-xs font-bold text-textLight uppercase tracking-widest mb-1">Proof Provided:</Text>
              <Text className="text-base text-text">{claim.proofDescription || "No details provided."}</Text>
            </View>
            
            <View className="flex-row justify-between mb-4">
              <TouchableOpacity 
                className="bg-red-50 py-4 px-6 rounded-2xl border border-red-100 flex-1 mr-2 items-center"
                onPress={() => handleReject(claim.id, claim.itemId, claim.itemType)}
              >
                <Text className="text-red-700 font-bold">Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="bg-green-600 py-4 px-6 rounded-2xl flex-1 ml-2 items-center shadow-sm"
                onPress={() => handleApprove(claim.id, claim.itemId, claim.itemType)}
              >
                <Text className="text-white font-bold">Approve</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              className="bg-primary/10 py-4 rounded-2xl items-center flex-row justify-center"
              onPress={() => router.push(`/chat/${claim.id}`)}
            >
              <Ionicons name="chatbubbles-outline" size={18} color="#4F46E5" />
              <Text className="text-primary font-bold ml-2">Chat with {claim.claimantName || 'Claimant'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Ongoing Returns (Approved) */}
      {activeReturns.length > 0 && (
        <>
          <Text className="text-xl font-bold text-text mb-4 mt-6">Ongoing Returns</Text>
          {activeReturns.map(claim => (
            <View key={claim.id} className="bg-surface p-5 rounded-3xl shadow-sm border border-green-100 mb-4">
              <View className="flex-row items-center mb-1">
                <View className="bg-green-100 p-2 rounded-full mr-2">
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                </View>
                <Text className="text-lg font-bold text-text">Return to {claim.claimantName || 'Claimant'}</Text>
              </View>
              
              <Text className="text-primary font-medium text-xs mb-3 ml-10">
                Class: {claim.claimantClass || 'N/A'}
              </Text>

              <Text className="text-sm text-textLight mb-4 italic">"{claim.itemTitle || 'Unknown Item'}"</Text>

              <TouchableOpacity 
                className="bg-primary py-4 rounded-2xl items-center flex-row justify-center mb-3 shadow-sm"
                onPress={() => router.push(`/chat/${claim.id}`)}
              >
                <Ionicons name="chatbubbles" size={18} color="white" />
                <Text className="text-white font-bold ml-2">Open Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="bg-white border-2 border-green-600 py-4 rounded-2xl items-center flex-row justify-center"
                onPress={() => handleMarkReturned(claim.id, claim.itemId, claim.itemType)}
              >
                <Ionicons name="bag-check" size={18} color="#059669" />
                <Text className="text-green-700 font-extrabold ml-2">Mark as Returned</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Resolved Section */}
      {resolvedClaims.length > 0 && (
        <>
          <Text className="text-xl font-bold text-text mb-4 mt-6">Recently Resolved</Text>
          {resolvedClaims.map(claim => (
            <View key={claim.id} className="bg-gray-50 p-5 rounded-3xl border border-gray-200 mb-4 opacity-80">
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className="text-base font-bold text-text">Returned to {claim.claimantName}</Text>
                  <Text className="text-xs text-textLight">{claim.claimantClass}</Text>
                </View>
                <View className="bg-gray-200 px-2 py-1 rounded-lg">
                  <Text className="text-gray-600 text-[10px] font-bold uppercase">Resolved</Text>
                </View>
              </View>
              
              <Text className="text-xs text-textLight mb-4 italic">Item: "{claim.itemTitle}"</Text>

              <TouchableOpacity 
                className="bg-gray-200 py-4 rounded-2xl items-center flex-row justify-center"
                onPress={() => router.push(`/chat/${claim.id}`)}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#4b5563" />
                <Text className="text-gray-700 font-bold ml-2">Contact Claimant (Fraud Check)</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

    </ScrollView>
  );
}
