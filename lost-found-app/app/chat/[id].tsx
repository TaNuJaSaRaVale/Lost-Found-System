import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  senderId: string;
  text: string;
  participants: string[];
  createdAt: Timestamp | null;
}

interface ClaimData {
  claimantId: string;
  ownerId: string;
  itemId: string;
  status: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // claimId
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!id || !auth.currentUser) {
      console.log("Chat aborted: Missing ID or User", { id, user: auth.currentUser?.uid });
      return;
    }

    const currentUserId = auth.currentUser.uid;

    // 1. Fetch Claim Details for participant context
    const fetchClaim = async () => {
      try {
        const claimSnap = await getDoc(doc(db, 'claims', id));
        if (claimSnap.exists()) {
          setClaim(claimSnap.data() as ClaimData);
        } else {
          Alert.alert("Chat Error", "Conversation context not found.");
          router.back();
        }
      } catch (err) {
        console.error("Error fetching claim for chat:", err);
      }
    };
    fetchClaim();

    // 2. Listen for Messages
    const q = query(
      collection(db, 'messages'),
      where('claimId', '==', id)
    );


    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      const sortedMessages = fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeA - timeB;
      });

      setMessages(sortedMessages);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, (error: any) => {
      console.error("CRITICAL CHAT ERROR:", error);

      // Look for the Index Creation Link in the error
      const errorMessage = error.message || "";
      if (errorMessage.includes('index')) {
        const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        const url = urlMatch ? urlMatch[0] : null;

        Alert.alert(
          "Index Required",
          "This chat requires a special Firestore Index. " +
          (url ? "Please click the link below to create it automatically." : "Please create a Composite Index for 'messages' (claimId: Asc, participants: Array) in your console."),
          url ? [
            { text: "Copy Link", onPress: () => Alert.alert("Link copied (check console)", url) },
            { text: "OK" }
          ] : [{ text: "OK" }]
        );
        console.log("👉 CREATE INDEX HERE:", url || "Manual creation required");
      } else if (errorMessage.includes('permissions')) {
        Alert.alert("Permission Error", "Could not load messages. If you haven't sent a message yet, this is normal. Otherwise, clear old data.");
      }

      setLoading(false);
    });


    return () => unsubscribe();
  }, [id, retryCount]);

  const handleRetry = () => {
    setLoading(true);
    setRetryCount(prev => prev + 1);
  };


  const sendMessage = async () => {
    if (!newMessage.trim() || !claim || !auth.currentUser) return;

    const textToSend = newMessage.trim();
    const currentUserId = auth.currentUser.uid;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        claimId: id,
        senderId: currentUserId,
        participants: [claim.claimantId, claim.ownerId], // Matches security rules
        text: textToSend,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Send Error", "Your message could not be sent.");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-textLight mt-4">Connecting to chat...</Text>
        <TouchableOpacity 
          onPress={handleRetry}
          className="mt-6 bg-gray-100 px-6 py-2 rounded-full"
        >
          <Text className="text-primary font-medium">Retry Connection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View className="bg-surface p-4 border-b border-gray-100 flex-row items-center pt-12">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#4F46E5" />
        </TouchableOpacity>
        <View>
          <Text className="text-lg font-bold text-text">Item Chat</Text>
          <Text className="text-xs text-textLight">Claim ID: {id?.slice(0, 8)}...</Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === auth.currentUser?.uid;
          const timeString = item.createdAt
            ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Sending...';

          return (
            <View className={`mb-4 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
              <View
                className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-primary rounded-tr-none' : 'bg-gray-200 rounded-tl-none'
                  }`}
              >
                <Text className={`${isMe ? 'text-white' : 'text-text'} text-base`}>
                  {item.text}
                </Text>
                <Text className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-textLight'}`}>
                  {timeString}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-10">
            <Text className="text-textLight italic">No messages yet. Say hello!</Text>
          </View>
        }
      />

      {/* Input Area */}
      <View className="p-4 bg-surface border-t border-gray-100 flex-row items-center">
        <TextInput
          className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mr-3 text-text text-base"
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity
          className={`p-3 rounded-full ${newMessage.trim() ? 'bg-primary' : 'bg-gray-300'}`}
          onPress={sendMessage}
          disabled={!newMessage.trim() || !claim}
        >
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

