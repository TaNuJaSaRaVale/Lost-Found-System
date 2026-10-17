import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useTheme';
import { deleteItemCascade } from '../../services/items';
import { StatusBadge } from '../../components/ui';
import { statusKind, timeAgo, ItemType } from '../../utils/format';

type Tab = 'overview' | 'reports' | 'users' | 'items';

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const colors = useColors();

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [usersSnap, lostSnap, foundSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'lost_items')),
        getDocs(collection(db, 'found_items')),
        getDocs(collection(db, 'user_reports')),
      ]);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setItems([
        ...lostSnap.docs.map(d => ({ id: d.id, _type: 'lost_items', ...d.data() })),
        ...foundSnap.docs.map(d => ({ id: d.id, _type: 'found_items', ...d.data() })),
      ].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (error: any) {
      Alert.alert('Could not load dashboard', error?.code === 'permission-denied'
        ? 'Your account lacks admin permissions on the server. Deploy the latest firestore.rules.'
        : error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/(tabs)/home');
      return;
    }
    if (profile) fetchData();
  }, [profile?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const returned = items.filter(i => statusKind(i.status) === 'returned').length;
    return {
      users: users.length,
      blocked: users.filter(u => u.status === 'blocked').length,
      lostOpen: items.filter(i => i._type === 'lost_items' && statusKind(i.status) === 'open').length,
      foundOpen: items.filter(i => i._type === 'found_items' && statusKind(i.status) === 'open').length,
      returned,
      rate: items.length ? Math.round((returned / items.length) * 100) : 0,
      reports: reports.length,
    };
  }, [users, items, reports]);

  const updateUser = async (userId: string, data: Record<string, any>, success?: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), data);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data } : u)));
      if (success) Alert.alert('Done', success);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const confirm = (title: string, message: string, action: () => void, destructive = false) =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: action }]);

  const toggleBlock = (u: any) => {
    const blocking = u.status !== 'blocked';
    confirm(blocking ? 'Suspend user?' : 'Restore user?',
      blocking ? `${u.name} will be signed out and unable to use the app.` : `${u.name} will regain access.`,
      () => updateUser(u.id, { status: blocking ? 'blocked' : 'active' }), blocking);
  };

  const warnUser = (userId: string) => {
    const u = users.find(x => x.id === userId);
    confirm('Send warning?', `${u?.name || 'This user'} will see a warning banner.`,
      () => updateUser(userId, { warnings: (u?.warnings || 0) + 1, hasPendingWarning: true }, 'Warning sent.'));
  };

  const setRole = (u: any, role: 'admin' | 'user') =>
    confirm(role === 'admin' ? 'Make admin?' : 'Remove admin?',
      role === 'admin' ? `${u.name} will get full moderation access.` : `${u.name} will become a standard user.`,
      () => updateUser(u.id, { role }), role === 'user');

  const removeItem = (item: any) =>
    confirm('Delete this post?', `"${item.title}" and its claims will be removed.`, async () => {
      try {
        await deleteItemCascade(item._type as ItemType, item.id);
        setItems(prev => prev.filter(i => i.id !== item.id));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }, true);

  const dismissReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'user_reports', reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const term = search.trim().toLowerCase();
  const visibleUsers = users.filter(u => !term || `${u.name} ${u.email} ${u.prn || ''}`.toLowerCase().includes(term));
  const visibleItems = items.filter(i => !term || `${i.title} ${i.location} ${i.userName || ''}`.toLowerCase().includes(term));

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'reports', label: 'Reports', count: reports.length },
    { id: 'users', label: 'Users' },
    { id: 'items', label: 'Posts' },
  ];

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <View className="flex-row bg-surface dark:bg-surface-dark border-b border-line dark:border-line-dark px-2">
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
            className={`flex-1 py-3 items-center border-b-2 ${tab === t.id ? 'border-primary dark:border-primary-dark' : 'border-transparent'}`}>
            <Text className={`font-bold text-sm ${tab === t.id ? 'text-primary dark:text-primary-dark' : 'text-textLight dark:text-textLight-dark'}`}>
              {t.label}{t.count ? ` (${t.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}>

        {(tab === 'users' || tab === 'items') && (
          <View className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl flex-row items-center px-4 mb-3">
            <Ionicons name="search" size={18} color={colors.textLight} />
            <TextInput className="flex-1 py-3 ml-2 text-text dark:text-text-dark" placeholder={tab === 'users' ? 'Search name, email, PRN' : 'Search posts'}
              placeholderTextColor={colors.placeholder} value={search} onChangeText={setSearch} />
          </View>
        )}

        {tab === 'overview' && (
          <View className="flex-row flex-wrap -mx-1.5">
            <StatTile icon="people" label="Users" value={stats.users} sub={`${stats.blocked} suspended`} color={colors.primary} />
            <StatTile icon="flag" label="Open reports" value={stats.reports} sub="Need review" color={colors.danger} />
            <StatTile icon="search" label="Open lost" value={stats.lostOpen} color={colors.primary} />
            <StatTile icon="sparkles" label="Open found" value={stats.foundOpen} color={colors.secondary} />
            <StatTile icon="checkmark-done-circle" label="Returned" value={stats.returned} sub={`${stats.rate}% of all posts`} color={colors.secondary} />
            <StatTile icon="albums" label="All posts" value={items.length} color={colors.accent} />
          </View>
        )}

        {tab === 'reports' && (reports.length === 0 ? (
          <Text className="text-textLight dark:text-textLight-dark text-center mt-10">No reports to review. 🎉</Text>
        ) : reports.map(r => {
          const reported = users.find(u => u.id === r.reportedUserId);
          const reporter = users.find(u => u.id === r.reportedBy);
          return (
            <View key={r.id} className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-line dark:border-line-dark mb-3">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                  <Text className="text-text dark:text-text-dark font-bold">{reported?.name || 'Unknown user'}</Text>
                  <Text className="text-textLight dark:text-textLight-dark text-xs">
                    Reported by {reporter?.name || 'someone'} · {timeAgo(r.createdAt)}
                  </Text>
                </View>
                {reported?.status === 'blocked' && (
                  <Text className="text-[10px] font-bold text-danger uppercase">Suspended</Text>
                )}
              </View>
              {!!r.itemTitle && (
                <TouchableOpacity onPress={() => router.push({ pathname: '/item/[id]', params: { id: r.itemId, type: r.itemType || 'found_items' } })}>
                  <Text className="text-primary dark:text-primary-dark text-sm mb-2">Post: {r.itemTitle} ›</Text>
                </TouchableOpacity>
              )}
              <View className="bg-rose-50 dark:bg-rose-500/10 p-3 rounded-xl mb-3">
                <Text className="text-rose-800 dark:text-rose-200">{r.reason}</Text>
              </View>
              <View className="flex-row gap-2">
                <SmallButton label="Dismiss" onPress={() => dismissReport(r.id)} />
                <SmallButton label="Warn" tone="amber" onPress={() => warnUser(r.reportedUserId)} />
                {reported && reported.id !== profile?.uid && (
                  <SmallButton label={reported.status === 'blocked' ? 'Restore' : 'Suspend'} tone="red" onPress={() => toggleBlock(reported)} />
                )}
              </View>
            </View>
          );
        }))}

        {tab === 'users' && visibleUsers.map(u => {
          const isSelf = u.id === profile?.uid;
          return (
            <View key={u.id} className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-line dark:border-line-dark mb-3">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-text dark:text-text-dark font-bold">{u.name || 'No name'}{isSelf ? ' (you)' : ''}</Text>
                  <Text className="text-textLight dark:text-textLight-dark text-xs">{u.email}</Text>
                  <Text className="text-xs mt-1">
                    <Text className={u.role === 'admin' ? 'text-amber-600 font-bold' : 'text-textLight dark:text-textLight-dark'}>{u.role}</Text>
                    <Text className="text-textLight dark:text-textLight-dark"> · </Text>
                    <Text className={u.status === 'blocked' ? 'text-danger font-bold' : 'text-secondary'}>{u.status || 'active'}</Text>
                    {u.warnings > 0 ? <Text className="text-amber-600"> · {u.warnings} warning(s)</Text> : null}
                  </Text>
                </View>
              </View>
              {!isSelf && (
                <View className="flex-row gap-2 mt-3">
                  {u.role === 'admin' ? (
                    <>
                      <SmallButton label="Message" onPress={() => {
                        const [a, b] = [profile!.uid, u.id].sort();
                        router.push(`/chat/admin_${a}_${b}`);
                      }} />
                      <SmallButton label="Remove admin" tone="amber" onPress={() => setRole(u, 'user')} />
                    </>
                  ) : (
                    <SmallButton label="Make admin" onPress={() => setRole(u, 'admin')} />
                  )}
                  <SmallButton label={u.status === 'blocked' ? 'Restore' : 'Suspend'} tone="red" onPress={() => toggleBlock(u)} />
                </View>
              )}
            </View>
          );
        })}

        {tab === 'items' && visibleItems.map(item => (
          <TouchableOpacity key={item.id} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, type: item._type } })}
            className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-line dark:border-line-dark mb-3 flex-row items-center">
            <View className="flex-1 mr-2">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className={`text-[10px] font-extrabold uppercase ${item._type === 'lost_items' ? 'text-primary dark:text-primary-dark' : 'text-secondary dark:text-secondary-dark'}`}>
                  {item._type === 'lost_items' ? 'Lost' : 'Found'}
                </Text>
                <StatusBadge status={item.status} />
                <Text className="text-[11px] text-textLight dark:text-textLight-dark ml-auto">{timeAgo(item.createdAt)}</Text>
              </View>
              <Text className="text-text dark:text-text-dark font-bold" numberOfLines={1}>{item.title}</Text>
              <Text className="text-textLight dark:text-textLight-dark text-xs" numberOfLines={1}>
                {item.userName || 'Unknown'} · {item.location}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item)} className="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl" hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, label, value, sub, color }: { icon: any; label: string; value: number; sub?: string; color: string }) {
  return (
    <View className="w-1/2 p-1.5">
      <View className="bg-surface dark:bg-surface-dark p-4 rounded-2xl border border-line dark:border-line-dark">
        <Ionicons name={icon} size={22} color={color} />
        <Text className="text-2xl font-extrabold text-text dark:text-text-dark mt-2">{value}</Text>
        <Text className="text-textLight dark:text-textLight-dark text-xs font-semibold">{label}</Text>
        {sub ? <Text className="text-textLight dark:text-textLight-dark text-[11px] mt-0.5">{sub}</Text> : null}
      </View>
    </View>
  );
}

function SmallButton({ label, onPress, tone = 'default' }: { label: string; onPress: () => void; tone?: 'default' | 'amber' | 'red' }) {
  const cls = {
    default: 'bg-muted dark:bg-muted-dark border-line dark:border-line-dark',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    red: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
  }[tone];
  const text = {
    default: 'text-text dark:text-text-dark',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-rose-700 dark:text-rose-300',
  }[tone];
  return (
    <TouchableOpacity onPress={onPress} className={`px-3 py-2 rounded-xl border ${cls}`}>
      <Text className={`text-xs font-bold ${text}`}>{label}</Text>
    </TouchableOpacity>
  );
}
