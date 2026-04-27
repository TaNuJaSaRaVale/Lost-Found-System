import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const FILTER_STATUSES = ['All', 'Open', 'Pending', 'Returned'];

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

export default function LostItemsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const userName = profile?.name || '';
  const userRole = profile?.role || '';

  useEffect(() => {
    const q = query(collection(db, 'lost_items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(fetched);
      setLoading(false);
    }, (error) => {
      console.log(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Firesotre onSnapshot will update automatically, so we just wait a bit for feel
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = statusFilter === 'All';
    if (!matchesStatus) {
      const status = item.status?.toLowerCase();
      if (statusFilter === 'Open') matchesStatus = status === 'open';
      if (statusFilter === 'Pending') matchesStatus = (status === 'pending_claim' || status === 'pending_handover');
      if (statusFilter === 'Returned') matchesStatus = (status === 'returned' || status === 'claimed');
    }
    
    return matchesSearch && matchesStatus;
  });

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* Header Section */}
      <View className="px-6 pt-10 pb-4">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-textLight dark:text-textLight-dark text-base font-medium">Hello,</Text>
            <Text className="text-text dark:text-text-dark text-3xl font-extrabold">{userName?.split(' ')[0] || 'Member'} 👋</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/profile')}
            className="bg-primary/10 p-3 rounded-2xl"
          >
            <Ionicons name="person-circle-outline" size={24} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View className="bg-surface dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-3xl flex-row items-center px-4 py-1 shadow-sm">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-4 ml-2 text-text dark:text-text-dark text-base"
            placeholder="Search lost items..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
        >
          {FILTER_STATUSES.map((status) => {
            const isActive = statusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status)}
                className={`mr-3 px-6 py-2.5 rounded-2xl border ${
                  isActive ? 'bg-primary border-primary' : 'bg-surface dark:bg-surface-dark border-gray-100 dark:border-gray-800'
                }`}
              >
                <Text className={`font-bold capitalize ${isActive ? 'text-white' : 'text-textLight dark:text-textLight-dark'}`}>
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : filteredItems.length === 0 ? (
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        >
          <View className="bg-primary/5 p-10 rounded-full">
            <Ionicons name="search-outline" size={80} color="#9CA3AF" />
          </View>
          <Text className="text-text dark:text-text-dark font-bold text-2xl mt-6">No matches found</Text>
          <Text className="text-textLight dark:text-textLight-dark text-center mt-3 text-base">
            We couldn't find anything matching your request. Try adjusting your filters.
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
          renderItem={({ item }) => {
            const catStyle = getCategoryStyle(item.category);
            return (
              <TouchableOpacity 
                onPress={() => router.push(`/item/${item.id}?type=lost_items`)}
                className="bg-surface dark:bg-surface-dark p-5 rounded-[32px] shadow-sm mb-6 border border-gray-100 dark:border-gray-800"
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className={`px-4 py-1.5 rounded-full ${catStyle.bg} dark:${catStyle.darkBg}`}>
                    <Text className={`text-[11px] font-extrabold uppercase tracking-widest ${catStyle.color} dark:${catStyle.darkColor}`}>
                      {item.category}
                    </Text>
                  </View>
                  <Text className="text-textLight dark:text-textLight-dark text-[11px] font-bold">
                    {item.dateLost || 'Recently'}
                  </Text>
                </View>

                <Text className="text-xl font-bold text-text dark:text-text-dark mb-2" numberOfLines={1}>
                  {item.title}
                </Text>
                
                <Text className="text-textLight dark:text-textLight-dark text-sm mb-5" numberOfLines={2}>
                  {item.description}
                </Text>

                <View className="flex-row items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-4">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl mr-3">
                      <Ionicons name="location" size={16} color="#6366F1" />
                    </View>
                    <Text className="text-text dark:text-text-dark text-xs font-medium" numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                  
                  {item.status === 'pending_claim' || item.status === 'pending_handover' ? (
                    <View className="bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/20">
                      <Text className="text-accent dark:text-accent-dark text-[11px] font-bold uppercase">Pending</Text>
                    </View>
                  ) : item.status === 'returned' || item.status === 'claimed' ? (
                    <View className="bg-secondary/10 px-3 py-1.5 rounded-xl border border-secondary/20">
                      <Text className="text-secondary dark:text-secondary-dark text-[11px] font-bold uppercase">Returned</Text>
                    </View>
                  ) : (
                    <View className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20">
                      <Text className="text-primary dark:text-primary-dark text-[11px] font-bold uppercase">Open</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      
      {/* Floating Action Button for Role-Based Reporting */}
      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-primary w-16 h-16 rounded-full items-center justify-center shadow-2xl shadow-primary/50"
        onPress={() => router.push('/report-item?type=lost')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}

