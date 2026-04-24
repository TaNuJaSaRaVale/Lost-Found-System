import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const FILTER_STATUSES = ['All', 'Open', 'Pending', 'Returned'];

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  'electronics': { color: 'text-blue-700', bg: 'bg-blue-50' },
  'wallet': { color: 'text-green-700', bg: 'bg-green-50' },
  'documents': { color: 'text-red-700', bg: 'bg-red-50' },
  'keys': { color: 'text-yellow-700', bg: 'bg-yellow-50' },
  'clothing': { color: 'text-purple-700', bg: 'bg-purple-50' },
  'others': { color: 'text-slate-700', bg: 'bg-slate-50' },
};

const getCategoryStyle = (category: string) => {
  const cat = category?.toLowerCase() || 'others';
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES['others'];
};

export default function LostItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    <View className="flex-1 bg-background">
      {/* Search Header */}
      <View className="px-4 pt-4 pb-2 bg-background">
        <View className="bg-surface border border-gray-100 rounded-2xl flex-row items-center px-4 py-1 shadow-sm">
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            className="flex-1 py-3 ml-2 text-text text-base"
            placeholder="Search lost items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View className="mb-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          {FILTER_STATUSES.map((status) => {
            const isActive = statusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setStatusFilter(status)}
                className={`mr-3 px-5 py-2 rounded-full border ${
                  isActive ? 'bg-primary border-primary' : 'bg-surface border-gray-100'
                }`}
              >
                <Text className={`font-bold capitalize ${isActive ? 'text-white' : 'text-textLight'}`}>
                  {status.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="search-outline" size={64} color="#e2e8f0" />
          <Text className="text-textLight font-bold text-lg mt-4">No matching items</Text>
          <Text className="text-textLight text-center mt-2">Try a different search or filter category.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              onPress={() => router.push(`/item/${item.id}?type=lost_items`)}
              className="bg-surface p-4 rounded-3xl shadow-sm mb-4 border border-gray-100 flex-row items-center"
            >
              {/* Optional: Add small thumbnail in future Phase */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-lg font-bold text-text flex-1 mr-2" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-textLight text-[10px] uppercase font-bold tracking-widest">
                    {item.dateLost || 'Unknown'}
                  </Text>
                </View>
                
                <View className={`self-start px-2 py-0.5 rounded-lg mb-3 ${getCategoryStyle(item.category).bg}`}>
                  <Text className={`text-[10px] font-bold uppercase tracking-wider ${getCategoryStyle(item.category).color}`}>
                    {item.category}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons name="location-outline" size={12} color="#94a3b8" />
                    <Text className="text-textLight text-xs ml-1 max-w-[150px]" numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                  
                  {item.status === 'pending_claim' || item.status === 'pending_handover' ? (
                    <View className="bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                      <Text className="text-yellow-700 text-[10px] font-bold">PENDING</Text>
                    </View>
                  ) : item.status === 'returned' || item.status === 'claimed' ? (
                    <View className="bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                      <Text className="text-green-700 text-[10px] font-bold">RETURNED</Text>
                    </View>
                  ) : (
                    <View className="bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                      <Text className="text-blue-700 text-[10px] font-bold">OPEN</Text>
                    </View>
                  )}

                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

