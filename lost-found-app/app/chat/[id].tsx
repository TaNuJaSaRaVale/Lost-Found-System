import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useTheme';
import { LIMITS } from '../../constants/config';
import type { Claim } from '../../services/claims';

interface Message {
  id: string;
  senderId: string;
  text: string;
  participants: string[];
  createdAt: Timestamp | null;
}

const LOCKED_STATUSES = ['rejected', 'withdrawn'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // claimId, or admin_<uidA>_<uidB>
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const isAdminChat = !!id?.startsWith('admin_');

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<Partial<Claim> | null>(null);
  const [showTips, setShowTips] = useState(true);
  const listRef = useRef<FlatList>(null);

  // Conversation context (live, so a rejection locks the chat immediately)
  useEffect(() => {
    if (!id || !user) return;
    if (isAdminChat) {
      const [a, b] = id.replace('admin_', '').split('_');
      setClaim({ claimantId: a, ownerId: b, status: 'admin_direct', claimantName: 'Admin', ownerName: 'Admin', itemTitle: 'Admin direct message' });
      return;
    }
    return onSnapshot(doc(db, 'claims', id), snap => {
      if (snap.exists()) setClaim({ id: snap.id, ...snap.data() } as Claim);
      else if (!snap.metadata.fromCache) setError('This conversation no longer exists.');
    }, () => setError('You do not have access to this conversation.'));
  }, [id, user, isAdminChat]);

  // Messages. The participants filter is required by the security rules.
  useEffect(() => {
    if (!id || !user) return;
    const q = query(
      collection(db, 'messages'),
      where('claimId', '==', id),
      where('participants', 'array-contains', user.uid),
    );
    return onSnapshot(q, snapshot => {
      const fetched = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }) as Message)
        .sort((a, b) => (a.createdAt?.toMillis() ?? Date.now()) - (b.createdAt?.toMillis() ?? Date.now()));
      setMessages(fetched);
      setLoading(false);
    }, err => {
      console.log('Chat error:', err.message);
      setError(err.message.includes('index')
        ? 'Chat is being set up. Deploy firestore.indexes.json (see README) and try again.'
        : 'Could not load messages. Check your connection.');
      setLoading(false);
    });
  }, [id, user]);

  // Mark as read when the latest message is from the other person
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (!isAdminChat && last && user && last.senderId !== user.uid && claim?.hasUnread) {
      updateDoc(doc(db, 'claims', id), { hasUnread: false }).catch(() => {});
    }
  }, [last?.id, claim?.hasUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!claim?.status && LOCKED_STATUSES.includes(claim.status);
  const otherName = !claim ? 'Chat' : user?.uid === claim.ownerId ? claim.claimantName || 'Claimant' : claim.ownerName || 'Reporter';

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !claim || !user || locked) return;
    setNewMessage('');
    try {
      await addDoc(collection(db, 'messages'), {
        claimId: id,
        senderId: user.uid,
        participants: [claim.claimantId, claim.ownerId],
        text,
        createdAt: serverTimestamp(),
      });
      if (!isAdminChat) {
        await updateDoc(doc(db, 'claims', id), {
          lastMessageText: text.slice(0, 120),
          lastMessageSenderId: user.uid,
          lastMessageAt: serverTimestamp(),
          hasUnread: true,
        });
      }
    } catch (e: any) {
      setNewMessage(text); // Don't lose what the user typed
      Alert.alert('Not sent', e?.code === 'permission-denied' ? 'This chat is closed.' : 'Check your connection and try again.');
    }
  };

  const header = (
    <SafeAreaView edges={['top']} className="bg-surface dark:bg-surface-dark border-b border-line dark:border-line-dark">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1" hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="bg-primary/10 w-10 h-10 rounded-full items-center justify-center mr-3">
          <Text className="text-primary dark:text-primary-dark font-bold">{otherName[0]?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          className="flex-1"
          disabled={isAdminChat || !claim?.itemId}
          onPress={() => router.push({ pathname: '/item/[id]', params: { id: claim!.itemId!, type: claim!.itemType! } })}
        >
          <Text className="text-base font-bold text-text dark:text-text-dark" numberOfLines={1}>{otherName}</Text>
          <Text className="text-xs text-textLight dark:text-textLight-dark" numberOfLines={1}>
            {claim?.itemTitle || 'Lost & Found item'}{!isAdminChat ? ' · View item' : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (error) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        {header}
        <View className="flex-1 items-center justify-center px-10">
          <Ionicons name="alert-circle-outline" size={44} color={colors.textLight} />
          <Text className="text-textLight dark:text-textLight-dark text-center mt-3">{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background dark:bg-background-dark">
      {header}

      {showTips && !isAdminChat && (
        <View className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-3 flex-row">
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text className="text-amber-900 dark:text-amber-100 text-xs flex-1 mx-2 leading-4">
            Stay safe: meet in a public campus spot (library desk, security office). Never share OTPs or pay anyone to get an item back.
          </Text>
          <TouchableOpacity onPress={() => setShowTips(false)} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            const time = item.createdAt
              ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Sending…';
            return (
              <View className={`mb-2 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
                <View className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-primary dark:bg-primary-dark rounded-br-md' : 'bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-bl-md'}`}>
                  <Text className={`${isMe ? 'text-white' : 'text-text dark:text-text-dark'} text-base`}>{item.text}</Text>
                  <Text className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-textLight dark:text-textLight-dark'}`}>{time}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textLight} />
              <Text className="text-textLight dark:text-textLight-dark text-center mt-3">No messages yet. Say hello 👋</Text>
            </View>
          }
        />
      )}

      {locked ? (
        <SafeAreaView edges={['bottom']} className="p-4 bg-rose-50 dark:bg-rose-500/10 border-t border-rose-200 dark:border-rose-500/20 items-center">
          <Text className="text-rose-700 dark:text-rose-300 font-bold">
            This chat is closed ({claim?.status === 'withdrawn' ? 'claim withdrawn' : 'claim declined'})
          </Text>
        </SafeAreaView>
      ) : (
        <SafeAreaView edges={['bottom']} className="px-3 py-2 bg-surface dark:bg-surface-dark border-t border-line dark:border-line-dark flex-row items-end">
          <TextInput
            className="flex-1 bg-muted dark:bg-muted-dark border border-line dark:border-line-dark rounded-3xl px-4 py-3 mr-2 text-text dark:text-text-dark text-base"
            style={{ maxHeight: 120 }}
            placeholder="Type a message…"
            placeholderTextColor={colors.placeholder}
            value={newMessage}
            onChangeText={setNewMessage}
            maxLength={LIMITS.message}
            multiline
          />
          <TouchableOpacity
            className={`w-12 h-12 rounded-full items-center justify-center ${newMessage.trim() ? 'bg-primary dark:bg-primary-dark' : 'bg-muted dark:bg-muted-dark'}`}
            onPress={sendMessage}
            disabled={!newMessage.trim() || !claim}
          >
            <Ionicons name="send" size={20} color={newMessage.trim() ? 'white' : colors.textLight} />
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </KeyboardAvoidingView>
  );
}
