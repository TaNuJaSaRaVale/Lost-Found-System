import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Image, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, addDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../services/firebase';
import { notifyUser } from '../../services/push';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useTheme';
import { deleteItemCascade, getItemImage, markItemResolved } from '../../services/items';
import { approveClaim, rejectClaim, withdrawClaim, markClaimReturned, claimIdFor, Claim } from '../../services/claims';
import { CategoryBadge, StatusBadge, Button, inputClass } from '../../components/ui';
import { eventDateLabel, normalizeCategory, statusKind, timeAgo, ItemType } from '../../utils/format';
import { LIMITS } from '../../constants/config';

export default function ItemDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ id: string; type: ItemType; sourceItemId?: string; sourceItemType?: string; justPosted?: string }>();
  const { id, type, sourceItemId, sourceItemType } = params;
  const isLostItem = type === 'lost_items';

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [myClaim, setMyClaim] = useState<Claim | null>(null);
  const [incomingClaims, setIncomingClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [claimModal, setClaimModal] = useState(false);
  const [proof, setProof] = useState('');
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  // Live item document
  useEffect(() => {
    if (!id || !type) return;
    return onSnapshot(doc(db, type, id), snap => {
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() });
      } else if (!snap.metadata.fromCache) {
        setItem(null);
      }
      setLoading(false);
    }, () => setLoading(false));
  }, [id, type]);

  // Full-size photo (loaded once)
  const itemLoaded = !!item;
  useEffect(() => {
    if (itemLoaded) getItemImage(item).then(setImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemLoaded]);

  const isReporter = !!user && item?.userId === user.uid;

  // My own claim on this item (as claimant)
  useEffect(() => {
    if (!user || !id || isReporter) return;
    const q = query(collection(db, 'claims'), where('claimantId', '==', user.uid), where('itemId', '==', id));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Claim));
      setMyClaim(docs[0] || null);
    }, () => {});
  }, [user, id, isReporter]);

  // Claims I received on my item (as reporter)
  useEffect(() => {
    if (!user || !id || !isReporter) return;
    const q = query(collection(db, 'claims'), where('ownerId', '==', user.uid), where('itemId', '==', id));
    return onSnapshot(q, snap => {
      setIncomingClaims(snap.docs.map(d => ({ id: d.id, ...d.data() } as Claim)));
    }, () => {});
  }, [user, id, isReporter]);

  const run = async (key: string, fn: () => Promise<void>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) Alert.alert('Done', success);
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.code === 'unavailable' ? 'You appear to be offline.' : e?.message);
    } finally {
      setBusy(null);
    }
  };

  // Link the claim to the claimant's own matching report (so both close together).
  const findMySourceItem = async () => {
    if (sourceItemId && sourceItemType) return { id: sourceItemId, type: sourceItemType };
    const otherType = isLostItem ? 'found_items' : 'lost_items';
    const snap = await getDocs(query(collection(db, otherType), where('userId', '==', user!.uid)));
    const open = snap.docs.filter(d => statusKind(d.data().status) === 'open');
    const best = open.find(d => normalizeCategory(d.data().category) === normalizeCategory(item.category));
    return best ? { id: best.id, type: otherType } : null;
  };

  const submitClaim = () => run('claim', async () => {
    if (!proof.trim()) throw new Error(isLostItem ? 'Tell the owner where and when you found it.' : 'Describe a detail only the owner would know.');
    if (!user || !item) return;

    if (myClaim?.status === 'withdrawn') {
      await updateDoc(doc(db, 'claims', myClaim.id), { status: 'pending', proofDescription: proof.trim(), updatedAt: serverTimestamp() });
    } else {
      const source = await findMySourceItem();
      await setDoc(doc(db, 'claims', claimIdFor(id, user.uid)), {
        itemId: id,
        itemType: type,
        sourceItemId: source?.id || null,
        sourceItemType: source?.type || null,
        itemTitle: item.title,
        claimantId: user.uid,
        claimantName: profile?.name || user.displayName || 'Student',
        claimantClass: profile?.studentClass || '',
        ownerId: item.userId,
        ownerName: item.userName || 'Reporter',
        status: 'pending',
        proofDescription: proof.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    notifyUser(item.userId,
      isLostItem ? '🙌 Someone found your item!' : '📩 New claim on your found item',
      `${profile?.name || 'Someone'} responded to "${item.title}". Review it now.`,
      { itemId: id, itemType: type });
    setClaimModal(false);
    setProof('');
  }, isLostItem ? 'Sent! The owner has been notified and can chat with you.' : 'Claim sent! The finder will review your proof and reply in chat.');

  const submitReport = () => run('report', async () => {
    if (!reportReason.trim()) throw new Error('Please tell us what is wrong.');
    await addDoc(collection(db, 'user_reports'), {
      reportedUserId: item.userId,
      reportedBy: user!.uid,
      reason: reportReason.trim(),
      itemId: id,
      itemType: type,
      itemTitle: item.title,
      createdAt: serverTimestamp(),
    });
    setReportModal(false);
    setReportReason('');
  }, 'Thanks. An admin will review this report.');

  const handleDelete = () => {
    Alert.alert('Delete report?', 'This removes the report and all claims on it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => run('delete', async () => {
          await deleteItemCascade(type, id, user!.uid);
          router.back();
        }),
      },
    ]);
  };

  const handleResolve = () => {
    Alert.alert('Mark as resolved?', isLostItem ? 'Got it back? This closes the report.' : 'Returned to the owner? This closes the report.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, resolved', onPress: () => run('resolve', () => markItemResolved(type, id), 'Great news! The report is now closed. 🎉') },
    ]);
  };

  const handleShare = () => {
    Share.share({
      message:
        `${isLostItem ? '🔍 LOST' : '✨ FOUND'}: ${item.title}\n` +
        `📍 ${item.location}\n🗓 ${eventDateLabel(item)}\n` +
        (item.reward ? `🎁 Reward: ${item.reward}\n` : '') +
        `\nOpen in Campus Lost & Found: lostfoundapp://item/${id}?type=${type}`,
    });
  };

  const confirmApprove = (claim: Claim) => {
    Alert.alert('Approve this claim?', `${claim.claimantName} will be marked as the owner/finder. Other pending claims will be declined.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => run(`approve-${claim.id}`, () => approveClaim(claim), 'Approved! Use the chat to arrange the handover.') },
    ]);
  };

  const confirmReturned = (claim: Claim) => {
    Alert.alert('Handover complete?', 'Confirm the item was physically handed over. This closes the case.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes, done', onPress: () => run('returned', () => markClaimReturned(claim), 'Case closed. Thanks for helping! 🎉') },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-background-dark items-center justify-center px-10">
        <Ionicons name="trash-bin-outline" size={48} color={colors.textLight} />
        <Text className="text-text dark:text-text-dark font-bold text-lg mt-4">This report no longer exists</Text>
        <Text className="text-textLight dark:text-textLight-dark text-center mt-2">It may have been resolved and removed by its owner.</Text>
        <View className="mt-6 w-full"><Button title="Go back" variant="ghost" onPress={() => router.back()} /></View>
      </SafeAreaView>
    );
  }

  const kind = statusKind(item.status);
  const isOpen = kind === 'open';
  const pendingIncoming = incomingClaims.filter(c => c.status === 'pending');
  const approvedIncoming = incomingClaims.find(c => c.status === 'approved');

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero image */}
        <View className="h-72 bg-muted dark:bg-muted-dark items-center justify-center">
          {image ? (
            <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={56} color={colors.textLight} />
          )}
          <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 flex-row justify-between px-4 pt-2">
            <TouchableOpacity onPress={() => router.back()} className="bg-black/40 p-2.5 rounded-full">
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={handleShare} className="bg-black/40 p-2.5 rounded-full">
                <Ionicons name="share-social-outline" size={22} color="white" />
              </TouchableOpacity>
              {!isReporter && (
                <TouchableOpacity onPress={() => setReportModal(true)} className="bg-black/40 p-2.5 rounded-full">
                  <Ionicons name="flag-outline" size={22} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>

        <View className="px-5 pt-5 -mt-6 bg-background dark:bg-background-dark rounded-t-3xl">
          {params.justPosted === '1' && (
            <View className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 mb-4 flex-row items-center">
              <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
              <Text className="text-emerald-800 dark:text-emerald-200 ml-3 flex-1">
                {"Published! We'll notify you when someone responds or a match appears."}
              </Text>
            </View>
          )}

          <View className="flex-row items-center mb-2 gap-2">
            <View className={`px-2.5 py-1 rounded-full ${isLostItem ? 'bg-primary/10' : 'bg-secondary/10'}`}>
              <Text className={`text-[10px] font-extrabold uppercase ${isLostItem ? 'text-primary dark:text-primary-dark' : 'text-secondary dark:text-secondary-dark'}`}>
                {isLostItem ? 'Lost' : 'Found'}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
          <Text className="text-2xl font-extrabold text-text dark:text-text-dark mb-2">{item.title}</Text>
          <CategoryBadge category={item.category} />

          <View className="flex-row mt-5 gap-3">
            <InfoTile icon="location" label={isLostItem ? 'Last seen' : 'Found at'} value={item.location} color={colors.primary} />
            <InfoTile icon="calendar" label="When" value={eventDateLabel(item)} color={colors.primary} />
          </View>
          {!!item.currentlyAt && (
            <View className="mt-3"><InfoTile icon="business" label="Currently kept at" value={item.currentlyAt} color={colors.secondary} /></View>
          )}
          {!!item.reward && (
            <View className="mt-3"><InfoTile icon="gift" label="Reward offered" value={item.reward} color={colors.accent} /></View>
          )}

          <Text className="text-base font-bold text-text dark:text-text-dark mt-6 mb-2">Details</Text>
          <Text className="text-textLight dark:text-textLight-dark text-base leading-6">
            {item.description || 'No extra details were provided.'}
          </Text>
          <Text className="text-textLight dark:text-textLight-dark text-xs mt-4">
            Posted {timeAgo(item.createdAt)}{item.userName ? ` by ${isReporter ? 'you' : item.userName}` : ''}
          </Text>

          {/* ---------- Reporter view ---------- */}
          {isReporter && (
            <View className="mt-6">
              {approvedIncoming && kind === 'pending' && (
                <ClaimCard claim={approvedIncoming} colors={colors} router={router} highlight>
                  <Text className="text-textLight dark:text-textLight-dark text-sm mb-3">
                    Approved. Meet in a public place to hand it over, then confirm below.
                  </Text>
                  <Button title="Confirm handover done" icon="checkmark-done" variant="secondary"
                    loading={busy === 'returned'} onPress={() => confirmReturned(approvedIncoming)} />
                </ClaimCard>
              )}

              {pendingIncoming.length > 0 && (
                <Text className="text-base font-bold text-text dark:text-text-dark mb-3">
                  {pendingIncoming.length} {pendingIncoming.length === 1 ? 'response' : 'responses'} to review
                </Text>
              )}
              {pendingIncoming.map(claim => (
                <ClaimCard key={claim.id} claim={claim} colors={colors} router={router}>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button title="Decline" variant="ghost" loading={busy === `reject-${claim.id}`}
                        onPress={() => run(`reject-${claim.id}`, () => rejectClaim(claim))} />
                    </View>
                    <View className="flex-1">
                      <Button title="Approve" variant="secondary" loading={busy === `approve-${claim.id}`} onPress={() => confirmApprove(claim)} />
                    </View>
                  </View>
                </ClaimCard>
              ))}

              <View className="flex-row gap-3 mt-2">
                {isOpen && (
                  <View className="flex-1">
                    <Button title="Mark resolved" icon="checkmark-done" variant="secondary" loading={busy === 'resolve'} onPress={handleResolve} />
                  </View>
                )}
                <View className="flex-1">
                  <Button title="Delete" icon="trash-outline" variant="ghost" loading={busy === 'delete'} onPress={handleDelete} />
                </View>
              </View>
            </View>
          )}

          {/* ---------- Visitor view ---------- */}
          {!isReporter && (
            <View className="mt-6">
              {myClaim && myClaim.status !== 'withdrawn' ? (
                <MyClaimPanel claim={myClaim} isLostItem={isLostItem} router={router}
                  busy={busy === 'withdraw'} onWithdraw={() => run('withdraw', () => withdrawClaim(myClaim))} />
              ) : isOpen ? (
                <Button
                  title={isLostItem ? 'I found this item' : 'This is mine — claim it'}
                  icon={isLostItem ? 'hand-left-outline' : 'shield-checkmark-outline'}
                  variant={isLostItem ? 'secondary' : 'primary'}
                  onPress={() => { setProof(''); setClaimModal(true); }}
                />
              ) : (
                <View className="bg-muted dark:bg-muted-dark rounded-2xl p-4 items-center">
                  <Text className="text-textLight dark:text-textLight-dark font-semibold">
                    {kind === 'returned' ? 'This case is closed — the item was returned. 🎉' : 'A handover is already in progress for this item.'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Claim / respond modal */}
      <Modal animationType="slide" transparent visible={claimModal} onRequestClose={() => setClaimModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/60">
          <View className="bg-surface dark:bg-surface-dark rounded-t-3xl p-6 pb-10">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xl font-bold text-text dark:text-text-dark">{isLostItem ? 'Tell the owner' : 'Prove it\'s yours'}</Text>
              <TouchableOpacity onPress={() => setClaimModal(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            <Text className="text-textLight dark:text-textLight-dark mb-4">
              {isLostItem
                ? 'Where and when did you find it? Where is it now? This starts a private chat with the owner.'
                : 'Describe something only the owner would know — a scratch, sticker, lock-screen photo, contents, etc.'}
            </Text>
            <TextInput
              className={inputClass}
              style={{ minHeight: 120 }}
              placeholder={isLostItem ? 'e.g. Found it in Lab 3 this morning, handed it to the security desk.' : 'e.g. Has a cracked corner and a Naruto sticker on the back.'}
              placeholderTextColor={colors.placeholder}
              value={proof}
              onChangeText={setProof}
              maxLength={LIMITS.proof}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <View className="mt-4">
              <Button title={isLostItem ? 'Send to owner' : 'Send claim'} variant={isLostItem ? 'secondary' : 'primary'} loading={busy === 'claim'} onPress={submitClaim} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report modal */}
      <Modal animationType="fade" transparent visible={reportModal} onRequestClose={() => setReportModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center bg-black/60 px-5">
          <View className="bg-surface dark:bg-surface-dark rounded-3xl p-6">
            <Text className="text-xl font-bold text-text dark:text-text-dark mb-2">Report this post</Text>
            <Text className="text-textLight dark:text-textLight-dark mb-4">Spam, scam, fake claim or offensive content? Admins will review it.</Text>
            <TextInput
              className={inputClass}
              style={{ minHeight: 90 }}
              placeholder="What's wrong?"
              placeholderTextColor={colors.placeholder}
              value={reportReason}
              onChangeText={setReportReason}
              maxLength={LIMITS.reportReason}
              multiline
              textAlignVertical="top"
            />
            <View className="flex-row gap-3 mt-4">
              <View className="flex-1"><Button title="Cancel" variant="ghost" onPress={() => setReportModal(false)} /></View>
              <View className="flex-1"><Button title="Report" variant="danger" loading={busy === 'report'} onPress={submitReport} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InfoTile({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View className="flex-1 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-3.5 flex-row items-center">
      <Ionicons name={icon} size={18} color={color} />
      <View className="ml-2.5 flex-1">
        <Text className="text-[10px] uppercase font-bold text-textLight dark:text-textLight-dark">{label}</Text>
        <Text className="text-text dark:text-text-dark font-semibold" numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function ClaimCard({ claim, colors, router, highlight, children }: any) {
  const unread = claim.hasUnread && claim.lastMessageSenderId === claim.claimantId;
  return (
    <View className={`bg-surface dark:bg-surface-dark rounded-2xl p-4 mb-3 border ${highlight ? 'border-secondary' : 'border-line dark:border-line-dark'}`}>
      <View className="flex-row items-center mb-2">
        <View className="bg-primary/10 w-10 h-10 rounded-full items-center justify-center mr-3">
          <Text className="text-primary dark:text-primary-dark font-bold">{(claim.claimantName || '?')[0].toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-text dark:text-text-dark font-bold">{claim.claimantName}</Text>
          {!!claim.claimantClass && <Text className="text-textLight dark:text-textLight-dark text-xs">{claim.claimantClass}</Text>}
        </View>
        <TouchableOpacity onPress={() => router.push(`/chat/${claim.id}`)} className="bg-primary/10 p-2.5 rounded-full">
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
          {unread && <View className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-danger" />}
        </TouchableOpacity>
      </View>
      <View className="bg-muted dark:bg-muted-dark rounded-xl p-3 mb-3">
        <Text className="text-text dark:text-text-dark">{claim.proofDescription}</Text>
      </View>
      {children}
    </View>
  );
}

function MyClaimPanel({ claim, isLostItem, router, busy, onWithdraw }: any) {
  const status: string = claim.status;
  const info: Record<string, { text: string; box: string; label: string }> = {
    pending: {
      text: isLostItem ? 'Sent. Waiting for the owner to respond.' : 'Claim sent. Waiting for the finder to verify.',
      box: 'bg-amber-50 dark:bg-amber-500/10', label: 'text-amber-800 dark:text-amber-200',
    },
    approved: {
      text: 'Approved! Chat to arrange a safe handover in a public place.',
      box: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'text-emerald-800 dark:text-emerald-200',
    },
    returned: {
      text: 'Handover complete. Case closed. 🎉',
      box: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'text-emerald-800 dark:text-emerald-200',
    },
    rejected: {
      text: 'Your claim was declined by the reporter.',
      box: 'bg-rose-50 dark:bg-rose-500/10', label: 'text-rose-800 dark:text-rose-200',
    },
  };
  const current = info[status] || info.pending;
  return (
    <View>
      <View className={`rounded-2xl p-4 mb-3 ${current.box}`}>
        <Text className={`font-semibold ${current.label}`}>{current.text}</Text>
      </View>
      {status !== 'rejected' && (
        <Button title="Open chat" icon="chatbubbles-outline" onPress={() => router.push(`/chat/${claim.id}`)} />
      )}
      {status === 'pending' && (
        <View className="mt-3"><Button title="Withdraw claim" variant="ghost" loading={busy} onPress={onWithdraw} /></View>
      )}
    </View>
  );
}
