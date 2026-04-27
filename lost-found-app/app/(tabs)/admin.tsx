import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'items' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Analytics
  const [stats, setStats] = useState({ totalUsers: 0, totalItems: 0, resolvedItems: 0 });

  useEffect(() => {
    if (profile?.role !== 'admin') {
      router.replace('/(tabs)/home'); // Kick out if not admin
      return;
    }
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(fetchedUsers);

      // Fetch Items (Lost and Found)
      const lostSnap = await getDocs(collection(db, 'lost_items'));
      const foundSnap = await getDocs(collection(db, 'found_items'));
      const fetchedLost = lostSnap.docs.map(doc => ({ id: doc.id, type: 'lost', ...doc.data() }));
      const fetchedFound = foundSnap.docs.map(doc => ({ id: doc.id, type: 'found', ...doc.data() }));
      const allItems = [...fetchedLost, ...fetchedFound].sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(allItems);

      // Fetch Reports
      const reportsSnap = await getDocs(collection(db, 'user_reports'));
      const fetchedReports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(fetchedReports);

      // Calc stats
      setStats({
        totalUsers: fetchedUsers.length,
        totalItems: allItems.length,
        resolvedItems: allItems.filter(i => i.status === 'resolved' || i.status === 'returned' || i.status === 'claimed').length
      });

    } catch (error) {
      console.error("Error fetching admin data", error);
      Alert.alert("Error", "Could not fetch dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      Alert.alert('Error', 'Could not update user status.');
    }
  };

  const issueWarning = async (userId: string) => {
    try {
      const userToWarn = users.find(u => u.id === userId);
      const warnings = (userToWarn?.warnings || 0) + 1;
      await updateDoc(doc(db, 'users', userId), { warnings, hasPendingWarning: true });
      setUsers(users.map(u => u.id === userId ? { ...u, warnings, hasPendingWarning: true } : u));
      Alert.alert("Success", "User has been issued a warning.");
    } catch (error) {
      Alert.alert("Error", "Could not issue warning.");
    }
  };

  const promoteUserToAdmin = async (userId: string) => {
    Alert.alert(
      "Promote User",
      "Are you sure you want to promote this user to Admin? They will have full access to this dashboard.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Promote", 
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), { role: 'admin' });
              setUsers(users.map(u => u.id === userId ? { ...u, role: 'admin' } : u));
              Alert.alert("Success", "User promoted to Admin.");
            } catch (error) {
              Alert.alert('Error', 'Could not promote user.');
            }
          }
        }
      ]
    );
  };

  const demoteUserFromAdmin = async (userId: string) => {
    Alert.alert(
      "Demote User",
      "Are you sure you want to demote this user from Admin to Standard User?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Demote", 
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', userId), { role: 'user' });
              setUsers(users.map(u => u.id === userId ? { ...u, role: 'user' } : u));
              Alert.alert("Success", "User demoted to Standard User.");
            } catch (error) {
              Alert.alert('Error', 'Could not demote user.');
            }
          }
        }
      ]
    );
  };

  const deleteItem = async (itemId: string, itemType: string) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, itemType === 'lost' ? 'lost_items' : 'found_items', itemId));
              setItems(items.filter(i => i.id !== itemId));
            } catch (error) {
              Alert.alert('Error', 'Could not delete item.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const renderTabHeader = () => (
    <View className="border-b border-gray-200 dark:border-gray-800">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row px-4 pt-4 pb-2">
        <TouchableOpacity 
          className={`mr-6 pb-2 ${activeTab === 'overview' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setActiveTab('overview')}
        >
          <Text className={`font-bold ${activeTab === 'overview' ? 'text-primary' : 'text-textLight dark:text-textLight-dark'}`}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`mr-6 pb-2 ${activeTab === 'users' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setActiveTab('users')}
        >
          <Text className={`font-bold ${activeTab === 'users' ? 'text-primary' : 'text-textLight dark:text-textLight-dark'}`}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`mr-6 pb-2 ${activeTab === 'reports' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setActiveTab('reports')}
        >
          <Text className={`font-bold ${activeTab === 'reports' ? 'text-primary' : 'text-textLight dark:text-textLight-dark'}`}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className={`pr-8 pb-2 ${activeTab === 'items' ? 'border-b-2 border-primary' : ''}`}
          onPress={() => setActiveTab('items')}
        >
          <Text className={`font-bold ${activeTab === 'items' ? 'text-primary' : 'text-textLight dark:text-textLight-dark'}`}>Items Moderation</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {renderTabHeader()}

      <ScrollView className="flex-1 p-4">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <View className="space-y-4 gap-4">
            <View className="bg-surface dark:bg-surface-dark p-6 rounded-2xl shadow-sm flex-row items-center border border-gray-100 dark:border-gray-800">
               <View className="bg-primary/20 p-4 rounded-full mr-4">
                 <Ionicons name="people" size={32} color="#4F46E5" />
               </View>
               <View>
                 <Text className="text-textLight dark:text-textLight-dark mb-1">Total Users</Text>
                 <Text className="text-text dark:text-text-dark text-3xl font-extrabold">{stats.totalUsers}</Text>
               </View>
            </View>

            <View className="bg-surface dark:bg-surface-dark p-6 rounded-2xl shadow-sm flex-row items-center border border-gray-100 dark:border-gray-800">
               <View className="bg-amber-500/20 p-4 rounded-full mr-4">
                 <Ionicons name="albums" size={32} color="#F59E0B" />
               </View>
               <View>
                 <Text className="text-textLight dark:text-textLight-dark mb-1">Total Items Posted</Text>
                 <Text className="text-text dark:text-text-dark text-3xl font-extrabold">{stats.totalItems}</Text>
               </View>
            </View>

            <View className="bg-surface dark:bg-surface-dark p-6 rounded-2xl shadow-sm flex-row items-center border border-gray-100 dark:border-gray-800">
               <View className="bg-emerald-500/20 p-4 rounded-full mr-4">
                 <Ionicons name="checkmark-done-circle" size={32} color="#10B981" />
               </View>
               <View>
                 <Text className="text-textLight dark:text-textLight-dark mb-1">Resolved Items</Text>
                 <Text className="text-text dark:text-text-dark text-3xl font-extrabold">{stats.resolvedItems}</Text>
               </View>
            </View>

            <TouchableOpacity 
              className="bg-primary p-4 rounded-xl flex-row justify-center items-center mt-4"
              onPress={fetchData}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text className="text-white font-bold ml-2">Refresh Data</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <View className="space-y-3 pb-10 gap-3">
            {users.map(u => (
              <View key={u.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex-row justify-between items-center">
                <View className="flex-1 mr-2">
                  <Text className="text-text dark:text-text-dark font-bold text-lg">{u.name}</Text>
                  <Text className="text-textLight dark:text-textLight-dark text-xs">{u.email}</Text>
                  <View className="flex-row items-center mt-1">
                    <Text className="text-xs text-textLight dark:text-textLight-dark mr-2">Role: <Text className={u.role==='admin'?'text-primary font-bold':''}>{u.role}</Text></Text>
                    <Text className={`mr-2 text-xs font-bold ${u.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>{u.status || 'active'}</Text>
                    {u.warnings > 0 && <Text className="text-xs text-amber-500 font-bold">Warnings: {u.warnings}</Text>}
                  </View>
                </View>
                
                <View className="flex-row items-center gap-2">
                  {u.role === 'admin' && u.id !== profile?.uid && (
                    <TouchableOpacity 
                      onPress={() => {
                         const participants = [profile?.uid, u.id].sort();
                         router.push(`/chat/admin_${participants[0]}_${participants[1]}`);
                      }}
                      className="bg-primary/10 p-2 rounded-lg border border-primary/30"
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color="#4F46E5" />
                    </TouchableOpacity>
                  )}
                  {u.role !== 'admin' && (
                    <TouchableOpacity 
                      onPress={() => promoteUserToAdmin(u.id)}
                      className="bg-primary/10 p-2 rounded-lg border border-primary/30"
                    >
                      <Ionicons name="shield-checkmark" size={20} color="#4F46E5" />
                    </TouchableOpacity>
                  )}
                  {u.role === 'admin' && u.id !== profile?.uid && (
                    <TouchableOpacity 
                      onPress={() => demoteUserFromAdmin(u.id)}
                      className="bg-amber-100 p-2 rounded-lg border border-amber-300"
                    >
                      <Ionicons name="shield-half" size={20} color="#F59E0B" />
                    </TouchableOpacity>
                  )}
                  {u.id !== profile?.uid && ( // Don't block self
                    <TouchableOpacity 
                      onPress={() => toggleUserStatus(u.id, u.status || 'active')}
                      className={`p-2 rounded-lg ${u.status === 'active' || !u.status ? 'bg-red-100 border-red-200' : 'bg-emerald-100 border-emerald-200'} border`}
                    >
                      <Ionicons name={u.status === 'active' || !u.status ? 'ban' : 'checkmark-circle'} size={20} color={u.status === 'active' || !u.status ? '#EF4444' : '#10B981'} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <View className="space-y-3 pb-10 gap-3">
            {reports.map(report => {
              const reportedUser = users.find(u => u.id === report.reportedUserId);
              const reporterUser = users.find(u => u.id === report.reportedBy);
              
              return (
                <View key={report.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex-col">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-shrink">
                      <Text className="text-text dark:text-text-dark font-bold text-base mb-1 cursor-text">Reported User: <Text className="text-red-500">{reportedUser?.name || report.reportedUserId}</Text></Text>
                      <Text className="text-textLight dark:text-textLight-dark text-xs mb-1 cursor-text">Reported By: {reporterUser?.name || report.reportedBy}</Text>
                      <Text className="text-textLight dark:text-textLight-dark text-[10px]">{new Date(report.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</Text>
                    </View>
                    {reportedUser?.status === 'blocked' ? (
                      <View className="bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
                        <Text className="text-[10px] font-bold text-red-500 uppercase">Suspended</Text>
                      </View>
                    ) : (
                      <View className="bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                        <Text className="text-[10px] font-bold text-emerald-500 uppercase">Active</Text>
                      </View>
                    )}
                  </View>
                  
                  <View className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg mb-4">
                    <Text className="text-red-800 dark:text-red-400 font-medium">Reason: {report.reason}</Text>
                  </View>

                  <View className="flex-row justify-end space-x-2 gap-2 mt-auto border-t border-gray-100 dark:border-gray-800 pt-3">
                    <TouchableOpacity 
                      onPress={() => issueWarning(report.reportedUserId)}
                      className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-900/50"
                    >
                      <Text className="text-amber-700 dark:text-amber-400 font-bold text-xs uppercase">Send Warning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => toggleUserStatus(report.reportedUserId, reportedUser?.status || 'active')}
                      className={`px-4 py-2 rounded-lg border ${reportedUser?.status === 'blocked' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-900/50' : 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-900/50'}`}
                    >
                      <Text className={`font-bold text-xs uppercase ${reportedUser?.status === 'blocked' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {reportedUser?.status === 'blocked' ? 'Unsuspend' : 'Suspend'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {reports.length === 0 && (
              <Text className="text-textLight dark:text-textLight-dark text-center mt-10">No reports to review.</Text>
            )}
          </View>
        )}

        {/* ITEMS TAB */}
        {activeTab === 'items' && (
          <View className="space-y-3 pb-10 gap-3">
            {items.map(item => (
              <View key={item.id} className="bg-surface dark:bg-surface-dark p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex-row justify-between items-center">
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center mb-1">
                    <Text className={`text-xs font-bold px-2 py-0.5 rounded-md text-white mr-2 ${item.type === 'lost' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                      {item.type.toUpperCase()}
                    </Text>
                    <Text className="text-xs text-textLight dark:text-textLight-dark ml-auto">{new Date(item.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</Text>
                  </View>
                  <Text className="text-text dark:text-text-dark font-bold text-base" numberOfLines={1}>{item.title}</Text>
                  <Text className="text-textLight dark:text-textLight-dark text-xs mt-1" numberOfLines={2}>{item.description}</Text>
                </View>

                <View className="flex-col gap-2">
                  <TouchableOpacity 
                    onPress={() => deleteItem(item.id, item.type)}
                    className="bg-red-50 dark:bg-red-900/30 p-2 rounded-lg border border-red-200 dark:border-red-900"
                  >
                    <Ionicons name="trash" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {items.length === 0 && (
              <Text className="text-textLight dark:text-textLight-dark text-center mt-10">No items available.</Text>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}
