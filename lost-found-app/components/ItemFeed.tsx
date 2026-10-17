import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, RefreshControl } from 'react-native';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../hooks/useTheme';
import { CATEGORIES, FEED_PAGE_SIZE } from '../constants/config';
import { normalizeCategory, statusKind, ItemType } from '../utils/format';
import { Chip, EmptyState, ItemCard } from './ui';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Handover' },
  { id: 'returned', label: 'Returned' },
] as const;

export default function ItemFeed({ type }: { type: ItemType }) {
  const router = useRouter();
  const colors = useColors();
  const { profile, user } = useAuth();
  const isLost = type === 'lost_items';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageSize, setPageSize] = useState(FEED_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    const q = query(collection(db, type), orderBy('createdAt', 'desc'), limit(pageSize));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setHasMore(snapshot.size >= pageSize);
      setError(false);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.log(`Feed ${type} error:`, err.message);
      setError(true);
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  }, [type, pageSize, refreshKey]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(item => {
      if (onlyMine && item.userId !== user?.uid) return false;
      if (statusFilter !== 'all' && statusKind(item.status) !== statusFilter) return false;
      if (categoryFilter && normalizeCategory(item.category) !== categoryFilter) return false;
      if (!term) return true;
      return [item.title, item.description, item.location, item.category]
        .some(v => typeof v === 'string' && v.toLowerCase().includes(term));
    });
  }, [items, search, statusFilter, categoryFilter, onlyMine, user?.uid]);

  const filtersActive = !!search.trim() || statusFilter !== 'all' || !!categoryFilter || onlyMine;
  const loadMore = () => { if (hasMore) setPageSize(p => p + FEED_PAGE_SIZE); };

  const firstName = profile?.name?.split(' ')[0] || 'there';

  const header = (
    <View>
      <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-textLight dark:text-textLight-dark text-sm">Hi {firstName} 👋</Text>
          <Text className="text-text dark:text-text-dark text-2xl font-extrabold">
            {isLost ? 'Lost on campus' : 'Found on campus'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setOnlyMine(v => !v)}
          className={`px-3 py-2 rounded-xl border ${onlyMine ? 'bg-primary/10 border-primary dark:border-primary-dark' : 'border-line dark:border-line-dark'}`}
        >
          <Text className={`text-xs font-bold ${onlyMine ? 'text-primary dark:text-primary-dark' : 'text-textLight dark:text-textLight-dark'}`}>
            {onlyMine ? 'Only mine ✓' : 'Only mine'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mx-5 mb-3 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl flex-row items-center px-4">
        <Ionicons name="search" size={18} color={colors.textLight} />
        <TextInput
          className="flex-1 py-3.5 ml-2 text-text dark:text-text-dark text-base"
          placeholder={isLost ? 'Search lost items, places…' : 'Search found items, places…'}
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {STATUS_FILTERS.map(s => (
          <Chip key={s.id} label={s.label} active={statusFilter === s.id} onPress={() => setStatusFilter(s.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        {CATEGORIES.map(c => (
          <Chip
            key={c.id}
            label={c.label}
            icon={c.icon}
            active={categoryFilter === c.id}
            onPress={() => setCategoryFilter(prev => (prev === c.id ? null : c.id))}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      {loading ? (
        <>
          {header}
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 110 }}
          renderItem={({ item }) => (
            <View className="px-5">
              <ItemCard item={item} type={type} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, type } })} />
            </View>
          )}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); setRefreshKey(k => k + 1); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (!filtersActive) loadMore(); }}
          ListFooterComponent={!hasMore ? null : filtersActive ? (
            <TouchableOpacity onPress={loadMore} className="mx-5 my-3 py-3 rounded-2xl border border-line dark:border-line-dark items-center">
              <Text className="text-primary dark:text-primary-dark font-semibold">Search older posts</Text>
            </TouchableOpacity>
          ) : filtered.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          ) : null}
          ListEmptyComponent={
            error ? (
              <EmptyState icon="cloud-offline-outline" title="Can't reach the server" subtitle="Check your internet connection and pull down to retry." />
            ) : items.length === 0 ? (
              <EmptyState
                icon={isLost ? 'search-outline' : 'sparkles-outline'}
                title={isLost ? 'No lost reports yet' : 'No found reports yet'}
                subtitle={isLost ? 'Lost something? Post it and let the campus help you find it.' : 'Found something? Post it and help it get home.'}
              />
            ) : (
              <EmptyState icon="funnel-outline" title="Nothing matches" subtitle="Try a different search or clear the filters." />
            )
          }
        />
      )}

      <TouchableOpacity
        className={`absolute bottom-6 right-5 flex-row items-center px-5 h-14 rounded-full shadow-lg ${isLost ? 'bg-primary dark:bg-primary-dark' : 'bg-secondary dark:bg-secondary-dark'}`}
        style={{ elevation: 6 }}
        onPress={() => router.push({ pathname: '/report-item', params: { type: isLost ? 'lost' : 'found' } })}
      >
        <Ionicons name="add" size={24} color="white" />
        <Text className="text-white font-bold ml-1">{isLost ? 'Report lost' : 'Report found'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
