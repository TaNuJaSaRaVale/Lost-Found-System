import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useTheme';
import { calculateMatchScore } from '../../utils/matching';
import { statusKind } from '../../utils/format';
import { MATCH_THRESHOLD } from '../../constants/config';
import { CategoryBadge, EmptyState } from '../../components/ui';

// How many recent open reports of the other kind to compare against.
const CANDIDATE_LIMIT = 300;

export default function MatchesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();

  const [myLost, setMyLost] = useState<any[] | null>(null);
  const [myFound, setMyFound] = useState<any[] | null>(null);
  const [openFound, setOpenFound] = useState<any[]>([]);
  const [openLost, setOpenLost] = useState<any[]>([]);

  // My own open reports
  useEffect(() => {
    if (!user) return;
    const mine = (type: string, set: (v: any[]) => void) =>
      onSnapshot(query(collection(db, type), where('userId', '==', user.uid)), snap => {
        set(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => statusKind((i as any).status) === 'open'));
      }, () => set([]));
    const a = mine('lost_items', setMyLost);
    const b = mine('found_items', setMyFound);
    return () => { a(); b(); };
  }, [user]);

  // Only subscribe to the other side when I actually have something to match
  const needFound = !!myLost?.length;
  const needLost = !!myFound?.length;

  useEffect(() => {
    if (!needFound) { setOpenFound([]); return; }
    const q = query(collection(db, 'found_items'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(CANDIDATE_LIMIT));
    return onSnapshot(q, snap => setOpenFound(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, [needFound]);

  useEffect(() => {
    if (!needLost) { setOpenLost([]); return; }
    const q = query(collection(db, 'lost_items'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(CANDIDATE_LIMIT));
    return onSnapshot(q, snap => setOpenLost(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
  }, [needLost]);

  const matches = useMemo(() => {
    const result: any[] = [];
    (myLost || []).forEach(mine => {
      openFound.forEach(other => {
        if (other.userId === user?.uid) return;
        const score = calculateMatchScore(mine, other);
        if (score >= MATCH_THRESHOLD) result.push({ key: `${mine.id}_${other.id}`, score, mine, other, mineType: 'lost_items', otherType: 'found_items' });
      });
    });
    (myFound || []).forEach(mine => {
      openLost.forEach(other => {
        if (other.userId === user?.uid) return;
        const score = calculateMatchScore(other, mine);
        if (score >= MATCH_THRESHOLD) result.push({ key: `${mine.id}_${other.id}`, score, mine, other, mineType: 'found_items', otherType: 'lost_items' });
      });
    });
    return result.sort((a, b) => b.score - a.score);
  }, [myLost, myFound, openFound, openLost, user?.uid]);

  if (myLost === null || myFound === null) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasReports = myLost.length + myFound.length > 0;

  return (
    <FlatList
      className="flex-1 bg-background dark:bg-background-dark"
      data={matches}
      keyExtractor={m => m.key}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
      ListHeaderComponent={matches.length ? (
        <Text className="text-textLight dark:text-textLight-dark mb-3">
          Reports that look similar to yours, best matches first. We also send a notification when a new one appears.
        </Text>
      ) : null}
      ListEmptyComponent={hasReports ? (
        <EmptyState icon="telescope-outline" title="No matches yet"
          subtitle="We're comparing your open reports with everything new on campus. You'll get a notification when something similar is posted." />
      ) : (
        <EmptyState icon="git-compare-outline" title="Nothing to match yet"
          subtitle="Post a lost or found report and we'll automatically look for similar items here.">
          <TouchableOpacity onPress={() => router.push('/(tabs)/report')} className="mt-5 bg-primary dark:bg-primary-dark px-6 py-3 rounded-2xl">
            <Text className="text-white font-bold">Post a report</Text>
          </TouchableOpacity>
        </EmptyState>
      )}
      renderItem={({ item: m }) => {
        const pct = Math.round(m.score * 100);
        const strong = pct >= 70;
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: m.other.id, type: m.otherType, sourceItemId: m.mine.id, sourceItemType: m.mineType } })}
            className="bg-surface dark:bg-surface-dark rounded-3xl p-4 mb-3 border border-line dark:border-line-dark"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className={`flex-row items-center px-2.5 py-1 rounded-full ${strong ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-indigo-100 dark:bg-indigo-500/15'}`}>
                <Ionicons name="sparkles" size={12} color={strong ? colors.secondary : colors.primary} />
                <Text className={`text-xs font-bold ml-1 ${strong ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                  {pct}% match
                </Text>
              </View>
              <Text className="text-xs text-textLight dark:text-textLight-dark">
                Your {m.mineType === 'lost_items' ? 'lost' : 'found'} report: <Text className="font-bold">{m.mine.title}</Text>
              </Text>
            </View>
            <View className="flex-row">
              <View className="w-16 h-16 rounded-2xl overflow-hidden bg-muted dark:bg-muted-dark items-center justify-center">
                {m.other.thumbnail || m.other.imageUrl ? (
                  <Image source={{ uri: m.other.thumbnail || m.other.imageUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Ionicons name="image-outline" size={24} color={colors.textLight} />
                )}
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-base font-bold text-text dark:text-text-dark" numberOfLines={1}>{m.other.title}</Text>
                <Text className="text-xs text-textLight dark:text-textLight-dark mb-1.5" numberOfLines={1}>
                  {m.otherType === 'found_items' ? 'Found at' : 'Lost at'} {m.other.location}
                </Text>
                <CategoryBadge category={m.other.category} />
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} style={{ alignSelf: 'center' }} />
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
