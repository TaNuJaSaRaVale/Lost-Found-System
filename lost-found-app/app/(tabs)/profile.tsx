import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, TextInput, Switch } from 'react-native';
import { signOut, updateProfile } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { profile, isAdminMode, setIsAdminMode } = useAuth();
  
  const [claims, setClaims] = useState<any[]>([]);
  const [activeReturns, setActiveReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [resolvedClaims, setResolvedClaims] = useState<any[]>([]);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const fetchedName = data.name || auth.currentUser?.displayName || '';
          const fetchedClass = data.studentClass || '';
          const fetchedRole = data.role || 'user';
          setUserName(fetchedName);
          setStudentClass(fetchedClass);
          setUserRole(fetchedRole);
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
    }, (error) => console.log(error));

    // 2. Listen for Approved Claims (Need Handover)
    const qApproved = query(
      collection(db, 'claims'),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'approved')
    );

    const unsubscribeApproved = onSnapshot(qApproved, (snapshot) => {
      setActiveReturns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.log(error));

    // 3. Listen for Resolved (Returned) Claims
    const qResolved = query(
      collection(db, 'claims'),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'returned')
    );

    const unsubscribeResolved = onSnapshot(qResolved, (snapshot) => {
      setResolvedClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.log(error));

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

  const handleApprove = async (claim: any) => {
    try {
      await updateDoc(doc(db, 'claims', claim.id), { status: 'approved' });
      await updateDoc(doc(db, claim.itemType, claim.itemId), { status: 'pending_handover' });
      if (claim.sourceItemId && claim.sourceItemType) {
         await updateDoc(doc(db, claim.sourceItemType, claim.sourceItemId), { status: 'pending_handover' });
      }
      Alert.alert('Success', 'Claim approved! You can now chat to coordinate the return.');
    } catch (error) {
      console.error("Error approving claim:", error);
      Alert.alert('Error', 'Failed to approve claim.');
    }
  };

  const handleReject = async (claim: any) => {
    try {
      await updateDoc(doc(db, 'claims', claim.id), { status: 'rejected' });
      await updateDoc(doc(db, claim.itemType, claim.itemId), { status: 'open' });
      if (claim.sourceItemId && claim.sourceItemType) {
         await updateDoc(doc(db, claim.sourceItemType, claim.sourceItemId), { status: 'open' });
      }
      Alert.alert('Success', 'Claim rejected.');
    } catch (error) {
       console.error("Error rejecting claim:", error);
       Alert.alert('Error', 'Failed to reject claim.');
    }
  };

  const handleMarkReturned = async (claim: any) => {
    Alert.alert(
      "Confirm Return",
      "Has the item been physically returned? This will close the case.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Resolved", 
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'claims', claim.id), { status: 'returned' });
              await updateDoc(doc(db, claim.itemType, claim.itemId), { status: 'returned' });
              if (claim.sourceItemId && claim.sourceItemType) {
                 await updateDoc(doc(db, claim.sourceItemType, claim.sourceItemId), { status: 'returned' });
              }
              Alert.alert('Success', 'Item marked as returned and resolved!');
            } catch (error) {
              Alert.alert('Error', 'Failed to update status.');
            }
          }
        }
      ]
    );
  };

  const getRoleBadge = () => {
    switch(userRole) {
      case 'admin': return { label: 'Admin', color: 'bg-accent', icon: 'shield-checkmark' };
      default: return { label: 'Standard User', color: 'bg-primary', icon: 'person' };
    }
  };

  const handleAcknowledgeWarning = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { hasPendingWarning: false });
    }
  };

  const submitNewPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (auth.currentUser) {
      const { updatePassword } = require('firebase/auth');
      try {
        setSavingPassword(true);
        await updatePassword(auth.currentUser, newPassword);
        Alert.alert("Success", "Password updated successfully. Please log in again.");
        setIsChangingPassword(false);
        setNewPassword('');
        signOut(auth);
      } catch (error: any) {
        if (error.code === 'auth/requires-recent-login') {
          Alert.alert("Error", "For security reasons, please log out and log in again before changing your password.");
        } else {
          Alert.alert("Error", error.message);
        }
      } finally {
        setSavingPassword(false);
      }
    }
  };

  const roleInfo = getRoleBadge();

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
      {/* Warning Banner */}
      {(profile as any)?.hasPendingWarning && (
        <View className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl mb-6 flex-row items-center mt-6">
          <Ionicons name="warning" size={24} color="#ef4444" />
          <View className="ml-3 flex-1">
             <Text className="text-red-800 dark:text-red-400 font-bold mb-1">Official Warning</Text>
             <Text className="text-red-700 dark:text-red-300 text-xs mb-2">An admin has issued a warning regarding your account activity. Repeated violations may result in suspension.</Text>
             <TouchableOpacity onPress={handleAcknowledgeWarning} className="bg-red-100 dark:bg-red-800/50 self-start px-4 py-2 rounded-lg">
               <Text className="text-red-800 dark:text-red-200 font-bold text-xs">Acknowledge</Text>
             </TouchableOpacity>
          </View>
        </View>
      )}

      <View className={`bg-surface dark:bg-surface-dark w-full p-8 rounded-[32px] shadow-xl border border-gray-100 dark:border-gray-800 items-center mb-8 ${!(profile as any)?.hasPendingWarning ? 'mt-10' : ''}`}>
        <View className="relative mb-6">
          <View className="bg-primary/10 dark:bg-primary-dark/20 p-6 rounded-full">
            <Ionicons name="person" size={48} color={theme === 'dark' ? '#818CF8' : '#6366F1'} />
          </View>
          <View className={`absolute -bottom-2 -right-2 ${roleInfo.color} px-3 py-1 rounded-full border-2 border-white dark:border-gray-800 flex-row items-center`}>
            <Ionicons name={roleInfo.icon as any} size={12} color="white" />
            <Text className="text-white text-[10px] font-bold ml-1 uppercase">{roleInfo.label}</Text>
          </View>
        </View>
        
        {isEditingProfile ? (
          <View className="w-full mb-4">
            <TextInput
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 mb-3 text-text dark:text-text-dark text-base"
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 mb-4 text-text dark:text-text-dark text-base"
              placeholder="Class (e.g. 2nd Year AIML)"
              placeholderTextColor="#9CA3AF"
              value={newClass}
              onChangeText={setNewClass}
            />
            <View className="flex-row justify-end space-x-3 gap-2">
              <TouchableOpacity 
                className="bg-gray-100 dark:bg-gray-800 py-3 px-6 rounded-2xl"
                onPress={() => {
                  setIsEditingProfile(false);
                  setNewName(userName);
                  setNewClass(studentClass);
                }}
                disabled={savingProfile}
              >
                <Text className="text-text dark:text-text-dark font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-primary py-3 px-8 rounded-2xl shadow-lg shadow-primary/20"
                onPress={handleUpdateProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="items-center mb-6">
            <View className="flex-row items-center mb-1">
              <Text className="text-2xl font-bold text-text dark:text-text-dark mr-2">
                {userName || "Your Profile"}
              </Text>
              <TouchableOpacity onPress={() => setIsEditingProfile(true)} className="bg-primary/10 px-2 py-1 rounded-lg">
                <Text className="text-primary text-xs font-bold uppercase">Edit</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-primary font-semibold mb-2">{studentClass || "Add Your Class"}</Text>
            <View className="bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700">
               <Text className="text-textLight dark:text-textLight-dark text-sm">{auth.currentUser?.email}</Text>
            </View>
          </View>
        )}

        <View className="w-full h-[1px] bg-gray-100 dark:bg-gray-800 mb-6" />

        <View className="w-full mb-6 gap-2">
          <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-2">Preferences</Text>
          
          <View className="flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl">
            <View className="flex-row items-center">
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={20} color={theme === 'dark' ? '#818CF8' : '#F59E0B'} />
              <Text className="text-text dark:text-text-dark font-bold ml-3">Dark Mode</Text>
            </View>
            <Switch 
              value={theme === 'dark'}
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
              trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
            />
          </View>

          <View className="flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl">
            <View className="flex-row items-center">
              <Ionicons name="notifications" size={20} color="#10B981" />
              <Text className="text-text dark:text-text-dark font-bold ml-3">Allow Notifications</Text>
            </View>
            <Switch 
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            />
          </View>

          {profile?.role === 'admin' && (
            <View className="flex-row justify-between items-center bg-accent/5 dark:bg-accent/10 border border-accent/20 p-4 rounded-2xl">
              <View className="flex-row items-center flex-1">
                <Ionicons name="shield-half" size={20} color="#F59E0B" />
                <View className="ml-3 flex-1 pr-2">
                   <Text className="text-text dark:text-text-dark font-bold">Admin Mode</Text>
                   <Text className="text-[10px] text-textLight dark:text-textLight-dark">Toggle off to view the app normally</Text>
                </View>
              </View>
              <Switch 
                value={isAdminMode}
                onValueChange={setIsAdminMode}
                trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
              />
            </View>
          )}

          {!isChangingPassword ? (
            <TouchableOpacity 
              className="flex-row justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl mt-4 border border-gray-100 dark:border-gray-800"
              onPress={() => setIsChangingPassword(true)}
            >
              <View className="flex-row items-center">
                <Ionicons name="key" size={20} color="#6366F1" />
                <Text className="text-text dark:text-text-dark font-bold ml-3">Update Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <View className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl mt-4 border border-gray-100 dark:border-gray-800">
               <Text className="text-text dark:text-text-dark font-bold mb-3">Update Password</Text>
               <TextInput
                 className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-3 text-text dark:text-text-dark"
                 placeholder="New Password"
                 placeholderTextColor="#9CA3AF"
                 secureTextEntry
                 value={newPassword}
                 onChangeText={setNewPassword}
               />
               <View className="flex-row justify-end space-x-2 gap-2">
                 <TouchableOpacity 
                   className="py-2 px-4 rounded-xl"
                   onPress={() => { setIsChangingPassword(false); setNewPassword(''); }}
                   disabled={savingPassword}
                 >
                   <Text className="text-textLight dark:text-textLight-dark font-bold">Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   className="bg-primary py-2 px-6 rounded-xl"
                   onPress={submitNewPassword}
                   disabled={savingPassword}
                 >
                   {savingPassword ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold">Submit</Text>}
                 </TouchableOpacity>
               </View>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          className="bg-red-50 dark:bg-red-900/20 py-4 w-full rounded-2xl items-center flex-row justify-center border border-red-100 dark:border-red-900/30"
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text className="text-red-600 dark:text-red-400 font-extrabold text-lg ml-2">Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Approvals */}
      <Text className="text-xl font-bold text-text dark:text-text-dark mb-4">Pending Approvals</Text>
      
      {loading ? (
        <ActivityIndicator color="#6366F1" />
      ) : claims.length === 0 ? (
        <View className="items-center bg-surface dark:bg-surface-dark p-10 rounded-[32px] border border-gray-100 dark:border-gray-800 mb-8">
           <Ionicons name="mail-open-outline" size={48} color="#9CA3AF" />
           <Text className="text-textLight dark:text-textLight-dark text-center mt-4 font-medium">No pending claims to review.</Text>
        </View>
      ) : (
        claims.map(claim => (
          <View key={claim.id} className="bg-surface dark:bg-surface-dark p-6 rounded-[32px] shadow-lg border border-accent/20 mb-6">
            <View className="flex-row items-center mb-4">
              <View className="bg-accent/10 p-3 rounded-2xl mr-4">
                 <Ionicons name="person" size={24} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-text dark:text-text-dark">
                  {claim.claimantName || 'Someone'}
                </Text>
                <Text className="text-primary font-bold text-xs uppercase tracking-tight">
                  {claim.claimantClass || 'General'}
                </Text>
              </View>
            </View>
            
            <View className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl mb-4 border border-gray-100 dark:border-gray-800">
              <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-2">Item Context:</Text>
              <Text className="text-base font-medium text-text dark:text-text-dark mb-1">"{claim.itemTitle || 'Unknown Item'}"</Text>
              <Text className="text-sm text-textLight dark:text-textLight-dark italic">Proof: {claim.proofDescription || "No details."}</Text>
            </View>
            
            <View className="flex-row space-x-3 gap-3 mb-4">
              <TouchableOpacity 
                className="bg-gray-100 dark:bg-gray-800 py-4 px-6 rounded-2xl flex-1 items-center"
                onPress={() => handleReject(claim)}
              >
                <Text className="text-text dark:text-text-dark font-bold">Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="bg-secondary py-4 px-6 rounded-2xl flex-1 items-center shadow-lg shadow-secondary/20"
                onPress={() => handleApprove(claim)}
              >
                <Text className="text-white font-bold">Approve</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              className="bg-primary/10 py-4 rounded-2xl items-center flex-row justify-center border border-primary/20 relative"
              onPress={() => router.push(`/chat/${claim.id}`)}
            >
              <Ionicons name="chatbubbles" size={20} color="#6366F1" />
              <Text className="text-primary font-bold ml-2">Secure Chat with {claim.claimantName?.split(' ')[0]}</Text>
              {claim.hasUnread && claim.lastMessageSenderId !== auth.currentUser?.uid && (
                <View className="absolute top-2 right-2 bg-red-500 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900" />
              )}
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Ongoing Returns (Approved) */}
      {activeReturns.length > 0 && (
        <>
          <Text className="text-xl font-bold text-text dark:text-text-dark mb-4 mt-4">Handover in Progress</Text>
          {activeReturns.map(claim => (
            <View key={claim.id} className="bg-surface dark:bg-surface-dark p-6 rounded-[32px] shadow-lg border border-secondary/20 mb-6">
              <View className="flex-row items-center mb-4">
                <View className="bg-secondary/10 p-3 rounded-2xl mr-4">
                  <Ionicons name="hand-right" size={24} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-text dark:text-text-dark">Ready for Return</Text>
                  <Text className="text-textLight dark:text-textLight-dark text-xs">{claim.claimantName} • {claim.claimantClass}</Text>
                </View>
              </View>
              
              <Text className="text-base text-text dark:text-text-dark font-medium mb-5 px-1">"{claim.itemTitle}"</Text>

              <View className="flex-row space-x-3 gap-3">
                <TouchableOpacity 
                  className="bg-primary py-4 rounded-2xl items-center flex-row justify-center flex-1 shadow-lg shadow-primary/20 relative"
                  onPress={() => router.push(`/chat/${claim.id}`)}
                >
                  <Ionicons name="chatbubbles" size={20} color="white" />
                  <Text className="text-white font-bold ml-2">Chat</Text>
                  {claim.hasUnread && claim.lastMessageSenderId !== auth.currentUser?.uid && (
                    <View className="absolute top-2 right-2 bg-red-500 w-3 h-3 rounded-full border-2 border-white" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  className="bg-secondary/10 border-2 border-secondary py-4 rounded-2xl items-center flex-row justify-center flex-[1.5]"
                  onPress={() => handleMarkReturned(claim)}
                >
                  <Ionicons name="checkmark-done" size={20} color="#10B981" />
                  <Text className="text-secondary font-extrabold ml-2">Returned</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Resolved Section */}
      {resolvedClaims.length > 0 && (
        <>
          <Text className="text-xl font-bold text-text dark:text-text-dark mb-4 mt-4">Case History</Text>
          {resolvedClaims.map(claim => (
            <View key={claim.id} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[32px] border border-gray-200 dark:border-gray-800 mb-6 opacity-80">
              <View className="flex-row justify-between items-start mb-3">
                <View>
                  <Text className="text-base font-bold text-text dark:text-text-dark">Returned to {claim.claimantName}</Text>
                  <Text className="text-primary font-bold text-[10px] uppercase">{claim.itemTitle}</Text>
                </View>
                <View className="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full">
                  <Text className="text-textLight dark:text-textLight-dark text-[10px] font-bold uppercase">RESOLVED</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                className="bg-white dark:bg-gray-800 py-3 rounded-2xl items-center flex-row justify-center border border-gray-100 dark:border-gray-700"
                onPress={() => router.push(`/chat/${claim.id}`)}
              >
                <Ionicons name="reader-outline" size={18} color="#6B7280" />
                <Text className="text-textLight dark:text-textLight-dark font-bold ml-2">View Transcript</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
      <View className="h-20" />
    </ScrollView>
  );
}
