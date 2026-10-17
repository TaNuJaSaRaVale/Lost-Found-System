import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Switch, Linking } from 'react-native';
import { signOut, updateProfile, updatePassword, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme, useColors, ThemePreference } from '../../hooks/useTheme';
import { registerForPushNotificationsAsync, disablePushNotifications } from '../../services/notification';
import { deleteItemCascade } from '../../services/items';
import { Claim } from '../../services/claims';
import { Button, Field, StatusBadge } from '../../components/ui';
import { friendlyAuthError, timeAgo, ItemType } from '../../utils/format';
import { PRIVACY_POLICY_URL } from '../../constants/config';

const CLAIM_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting review', approved: 'Approved — arrange handover', rejected: 'Declined',
  returned: 'Completed', withdrawn: 'Withdrawn',
};

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { preference, setTheme } = useTheme();
  const { user, profile, isAdminMode, setIsAdminMode } = useAuth();

  const [received, setReceived] = useState<Claim[]>([]);
  const [sent, setSent] = useState<Claim[]>([]);
  const [myLost, setMyLost] = useState<any[]>([]);
  const [myFound, setMyFound] = useState<any[]>([]);

  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isPasswordUser = !!user?.providerData.some(p => p.providerId === 'password');
  const notificationsOn = profile?.notificationsEnabled !== false && !!profile?.expoPushToken;

  useEffect(() => {
    if (!user) return;
    const listen = (q: any, set: (v: any[]) => void) =>
      onSnapshot(q, (snap: any) => set(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))), () => {});
    const subs = [
      listen(query(collection(db, 'claims'), where('ownerId', '==', user.uid)), setReceived),
      listen(query(collection(db, 'claims'), where('claimantId', '==', user.uid)), setSent),
      listen(query(collection(db, 'lost_items'), where('userId', '==', user.uid)), setMyLost),
      listen(query(collection(db, 'found_items'), where('userId', '==', user.uid)), setMyFound),
    ];
    return () => subs.forEach(u => u());
  }, [user]);

  const toReview = received.filter(c => c.status === 'pending');
  const handovers = received.filter(c => c.status === 'approved');
  const activeSent = sent.filter(c => c.status !== 'withdrawn');
  const myReports = useMemo(() => [
    ...myLost.map(i => ({ ...i, _type: 'lost_items' as ItemType })),
    ...myFound.map(i => ({ ...i, _type: 'found_items' as ItemType })),
  ].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [myLost, myFound]);
  const helpedCount = [...received, ...sent].filter(c => c.status === 'returned').length;

  const startEditing = () => {
    setNewName(profile?.name || '');
    setNewClass(profile?.studentClass || '');
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!newName.trim()) return Alert.alert('Name required', 'Please enter your name.');
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: newName.trim() });
      await updateDoc(doc(db, 'users', user.uid), { name: newName.trim(), studentClass: newClass.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', friendlyAuthError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    try {
      if (enabled) {
        const token = await registerForPushNotificationsAsync();
        if (!token) {
          Alert.alert('Notifications unavailable', 'Allow notifications for this app in your phone settings. (They do not work in Expo Go or on emulators.)', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]);
        }
      } else {
        await disablePushNotifications();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const submitNewPassword = async () => {
    if (newPassword.length < 6) return Alert.alert('Too short', 'Password must be at least 6 characters.');
    if (!user) return;
    setSaving(true);
    try {
      await updatePassword(user, newPassword);
      setChangingPassword(false);
      setNewPassword('');
      Alert.alert('Password updated', 'Use your new password next time you log in.');
    } catch (e) {
      Alert.alert('Could not update password', friendlyAuthError(e));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert('Email sent', `We sent a password reset link to ${user.email}.`);
    } catch (e) {
      Alert.alert('Error', friendlyAuthError(e));
    }
  };

  const handleAcknowledgeWarning = () => {
    if (user) updateDoc(doc(db, 'users', user.uid), { hasPendingWarning: false }).catch(() => {});
  };

  // Required by Google Play: users must be able to delete their account and data in-app.
  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, all your reports and claims. This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: deleteAccount }],
    );
  };

  const deleteAccount = async () => {
    if (!user) return;
    const lastSignIn = new Date(user.metadata.lastSignInTime || 0).getTime();
    if (Date.now() - lastSignIn > 4 * 60 * 1000) {
      Alert.alert('Please log in again', 'For your security, log out and log back in, then delete your account within a few minutes.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out now', onPress: () => signOut(auth) },
      ]);
      return;
    }
    setDeleting(true);
    try {
      for (const item of myReports) await deleteItemCascade(item._type, item.id, user.uid);
      const myClaims = await getDocs(query(collection(db, 'claims'), where('claimantId', '==', user.uid)));
      const batch = writeBatch(db);
      myClaims.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
    } catch (e) {
      setDeleting(false);
      Alert.alert('Could not delete account', friendlyAuthError(e));
    }
  };

  const initials = (profile?.name || user?.email || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {profile?.hasPendingWarning && (
        <View className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 rounded-2xl mb-4 flex-row">
          <Ionicons name="warning" size={22} color={colors.danger} />
          <View className="ml-3 flex-1">
            <Text className="text-rose-800 dark:text-rose-200 font-bold mb-1">Warning from an admin</Text>
            <Text className="text-rose-700 dark:text-rose-300 text-xs mb-2">
              Your recent activity was reported. Repeated violations may lead to suspension.
            </Text>
            <TouchableOpacity onPress={handleAcknowledgeWarning} className="bg-rose-100 dark:bg-rose-500/20 self-start px-3 py-1.5 rounded-lg">
              <Text className="text-rose-800 dark:text-rose-200 font-bold text-xs">I understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Identity card */}
      <View className="bg-surface dark:bg-surface-dark rounded-3xl p-5 border border-line dark:border-line-dark mb-4">
        {editing ? (
          <>
            <Field label="Full name" value={newName} onChangeText={setNewName} maxLength={60} />
            <Field label="Class / Department" value={newClass} onChangeText={setNewClass} maxLength={60} />
            <View className="flex-row gap-3">
              <View className="flex-1"><Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} /></View>
              <View className="flex-1"><Button title="Save" loading={saving} onPress={saveProfile} /></View>
            </View>
          </>
        ) : (
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-primary dark:bg-primary-dark items-center justify-center">
              <Text className="text-white text-xl font-extrabold">{initials}</Text>
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-xl font-bold text-text dark:text-text-dark" numberOfLines={1}>{profile?.name || 'Your profile'}</Text>
              <Text className="text-textLight dark:text-textLight-dark text-sm" numberOfLines={1}>{user?.email}</Text>
              <View className="flex-row items-center mt-1 gap-2">
                {!!profile?.studentClass && <Text className="text-primary dark:text-primary-dark text-xs font-semibold">{profile.studentClass}</Text>}
                {profile?.role === 'admin' && (
                  <View className="bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
                    <Text className="text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">Admin</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={startEditing} className="p-2" hitSlop={10}>
              <Ionicons name="create-outline" size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        )}

        {!editing && (
          <View className="flex-row mt-5 pt-4 border-t border-line dark:border-line-dark">
            <Stat value={myReports.length} label="Reports" />
            <Stat value={activeSent.length} label="Claims" />
            <Stat value={helpedCount} label="Returned 🎉" />
          </View>
        )}
      </View>

      {/* Needs attention */}
      {(toReview.length > 0 || handovers.length > 0) && (
        <Section title="Needs your attention">
          {toReview.map(c => (
            <Row key={c.id} icon="mail-unread-outline" iconColor={colors.accent}
              title={`${c.claimantName} responded`} subtitle={`On "${c.itemTitle}" · tap to review`}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: c.itemId, type: c.itemType } })} />
          ))}
          {handovers.map(c => (
            <Row key={c.id} icon="hand-right-outline" iconColor={colors.secondary}
              title={`Hand over "${c.itemTitle}"`} subtitle={`With ${c.claimantName} · confirm when done`}
              dot={c.hasUnread && c.lastMessageSenderId !== user?.uid}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: c.itemId, type: c.itemType } })} />
          ))}
        </Section>
      )}

      {activeSent.length > 0 && (
        <Section title="My claims & responses">
          {activeSent.map(c => (
            <Row key={c.id} icon="chatbubbles-outline" iconColor={colors.primary}
              title={c.itemTitle} subtitle={`${CLAIM_STATUS_LABEL[c.status] || c.status} · ${timeAgo(c.updatedAt || c.createdAt)}`}
              dot={c.hasUnread && c.lastMessageSenderId !== user?.uid}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: c.itemId, type: c.itemType } })} />
          ))}
        </Section>
      )}

      <Section title="My reports">
        {myReports.length === 0 ? (
          <Text className="text-textLight dark:text-textLight-dark p-4">{"You haven't posted anything yet."}</Text>
        ) : myReports.map(item => (
          <Row key={item.id} icon={item._type === 'lost_items' ? 'search-outline' : 'sparkles-outline'}
            iconColor={item._type === 'lost_items' ? colors.primary : colors.secondary}
            title={item.title} subtitle={`${item._type === 'lost_items' ? 'Lost' : 'Found'} · ${timeAgo(item.createdAt)}`}
            right={<StatusBadge status={item.status} />}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id, type: item._type } })} />
        ))}
      </Section>

      {/* Settings */}
      <Section title="Settings">
        <View className="p-4 border-b border-line dark:border-line-dark">
          <Text className="text-text dark:text-text-dark font-semibold mb-3">Appearance</Text>
          <View className="flex-row bg-muted dark:bg-muted-dark rounded-xl p-1">
            {(['light', 'dark', 'system'] as ThemePreference[]).map(p => (
              <TouchableOpacity key={p} onPress={() => setTheme(p)}
                className={`flex-1 py-2 rounded-lg items-center ${preference === p ? 'bg-surface dark:bg-surface-dark' : ''}`}>
                <Text className={`text-sm font-semibold capitalize ${preference === p ? 'text-text dark:text-text-dark' : 'text-textLight dark:text-textLight-dark'}`}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <ToggleRow icon="notifications-outline" label="Push notifications" sub="Matches, claims and new messages"
          value={notificationsOn} onChange={toggleNotifications} color={colors.secondary} />
        {profile?.role === 'admin' && (
          <ToggleRow icon="shield-half-outline" label="Admin mode" sub="Show the moderation dashboard"
            value={isAdminMode} onChange={setIsAdminMode} color={colors.accent} />
        )}
        {isPasswordUser && (changingPassword ? (
          <View className="p-4 border-b border-line dark:border-line-dark">
            <Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} autoFocus />
            <View className="flex-row gap-3">
              <View className="flex-1"><Button title="Cancel" variant="ghost" onPress={() => { setChangingPassword(false); setNewPassword(''); }} /></View>
              <View className="flex-1"><Button title="Update" loading={saving} onPress={submitNewPassword} /></View>
            </View>
            <TouchableOpacity onPress={sendReset} className="mt-3 items-center">
              <Text className="text-primary dark:text-primary-dark text-sm font-semibold">Email me a reset link instead</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Row icon="key-outline" iconColor={colors.textLight} title="Change password" onPress={() => setChangingPassword(true)} />
        ))}
        <Row icon="document-text-outline" iconColor={colors.textLight} title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        <Row icon="log-out-outline" iconColor={colors.danger} title="Log out" onPress={() => signOut(auth)} />
      </Section>

      <TouchableOpacity onPress={confirmDeleteAccount} disabled={deleting} className="items-center py-4">
        <Text className="text-danger dark:text-danger-dark font-semibold">{deleting ? 'Deleting account…' : 'Delete my account'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xl font-extrabold text-text dark:text-text-dark">{value}</Text>
      <Text className="text-xs text-textLight dark:text-textLight-dark">{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-wider mb-2 ml-1">{title}</Text>
      <View className="bg-surface dark:bg-surface-dark rounded-3xl border border-line dark:border-line-dark overflow-hidden">{children}</View>
    </View>
  );
}

function Row({ icon, iconColor, title, subtitle, onPress, right, dot }: {
  icon: any; iconColor: string; title: string; subtitle?: string; onPress: () => void; right?: React.ReactNode; dot?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center p-4 border-b border-line dark:border-line-dark">
      <Ionicons name={icon} size={20} color={iconColor} />
      <View className="flex-1 ml-3">
        <Text className="text-text dark:text-text-dark font-semibold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="text-textLight dark:text-textLight-dark text-xs mt-0.5" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {dot && <View className="w-2.5 h-2.5 rounded-full bg-danger mr-2" />}
      {right || <Ionicons name="chevron-forward" size={18} color={colors.textLight} />}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, sub, value, onChange, color }: {
  icon: any; label: string; sub: string; value: boolean; onChange: (v: boolean) => void; color: string;
}) {
  const colors = useColors();
  return (
    <View className="flex-row items-center p-4 border-b border-line dark:border-line-dark">
      <Ionicons name={icon} size={20} color={colors.textLight} />
      <View className="flex-1 ml-3">
        <Text className="text-text dark:text-text-dark font-semibold">{label}</Text>
        <Text className="text-textLight dark:text-textLight-dark text-xs">{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.line, true: color }} thumbColor="#fff" />
    </View>
  );
}
