import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../hooks/useTheme';
import { createItem, processImage, ProcessedImage } from '../services/items';
import { CAMPUS_LOCATIONS, CATEGORIES, LIMITS } from '../constants/config';
import { Button, Chip, Field } from '../components/ui';

const DAY_OPTIONS = [
  { label: 'Today', daysAgo: 0 },
  { label: 'Yesterday', daysAgo: 1 },
  { label: '2–3 days ago', daysAgo: 2 },
  { label: 'This week', daysAgo: 5 },
  { label: 'Earlier', daysAgo: 14 },
];

function dateForDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export default function ReportItemScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, profile } = useAuth();
  const { type } = useLocalSearchParams<{ type: string }>();
  const isLost = type !== 'found';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [daysAgo, setDaysAgo] = useState<number | null>(0);
  const [eventTime, setEventTime] = useState('');
  const [reward, setReward] = useState('');
  const [currentlyAt, setCurrentlyAt] = useState('');
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePicked = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    setProcessingImage(true);
    try {
      setImage(await processImage(result.assets[0].uri));
    } catch {
      Alert.alert('Photo error', 'We could not process that photo. Please try another one.');
    } finally {
      setProcessingImage(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return;
    }
    handlePicked(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 }));
  };

  const pickFromGallery = async () => {
    handlePicked(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 }));
  };

  const handleSubmit = async () => {
    const missing = [
      !title.trim() && 'a title',
      !category && 'a category',
      !location.trim() && 'a location',
      daysAgo === null && 'when it happened',
    ].filter(Boolean);
    if (missing.length) {
      Alert.alert('Almost there', `Please add ${missing.join(', ')}.`);
      return;
    }
    if (!user) return;
    if (profile?.status === 'blocked') {
      Alert.alert('Account suspended', 'Your account cannot post new reports.');
      return;
    }

    setSubmitting(true);
    try {
      const data: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        eventDate: dateForDaysAgo(daysAgo!),
        eventTime: eventTime.trim(),
        userId: user.uid,
        userName: profile?.name || user.displayName || 'Student',
      };
      if (isLost) data.reward = reward.trim();
      else data.currentlyAt = currentlyAt.trim();

      const id = await createItem(isLost ? 'lost_items' : 'found_items', data, image);
      router.replace({ pathname: '/item/[id]', params: { id, type: isLost ? 'lost_items' : 'found_items', justPosted: '1' } });
    } catch (error: any) {
      const offline = error?.code === 'unavailable';
      Alert.alert('Could not publish', offline ? 'You appear to be offline. Please try again when connected.' : error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background dark:bg-background-dark">
      <Stack.Screen options={{ title: isLost ? 'Report lost item' : 'Report found item' }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <View className="mb-6">
          <View className="bg-muted dark:bg-muted-dark border-2 border-dashed border-line dark:border-line-dark rounded-3xl h-52 overflow-hidden items-center justify-center">
            {processingImage ? (
              <ActivityIndicator color={colors.primary} />
            ) : image ? (
              <>
                <Image source={{ uri: image.full }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <TouchableOpacity onPress={() => setImage(null)} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full">
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              </>
            ) : (
              <View className="items-center px-6">
                <Ionicons name="image-outline" size={36} color={colors.textLight} />
                <Text className="text-textLight dark:text-textLight-dark mt-2 text-center">
                  Add a clear photo so people can recognise it at a glance
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row mt-3 gap-3">
            <View className="flex-1"><Button title="Camera" icon="camera-outline" variant="ghost" onPress={takePhoto} /></View>
            <View className="flex-1"><Button title="Gallery" icon="images-outline" variant="ghost" onPress={pickFromGallery} /></View>
          </View>
        </View>

        <Field
          label="What is it? *"
          placeholder={isLost ? 'e.g. Black HP laptop charger' : 'e.g. Blue water bottle with stickers'}
          value={title}
          onChangeText={setTitle}
          maxLength={LIMITS.title}
        />

        <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-wider mb-2">Category *</Text>
        <View className="flex-row flex-wrap mb-4">
          {CATEGORIES.map(c => (
            <Chip key={c.id} label={c.label} icon={c.icon} active={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </View>

        <Field
          label={isLost ? 'Where did you lose it? *' : 'Where did you find it? *'}
          placeholder="e.g. 2nd floor, Library reading hall"
          value={location}
          onChangeText={setLocation}
          maxLength={LIMITS.location}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mt-2 mb-4" keyboardShouldPersistTaps="handled">
          {CAMPUS_LOCATIONS.map(l => (
            <Chip key={l} label={l} active={location === l} onPress={() => setLocation(l)} />
          ))}
        </ScrollView>

        <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-wider mb-2">When? *</Text>
        <View className="flex-row flex-wrap mb-2">
          {DAY_OPTIONS.map(o => (
            <Chip key={o.label} label={o.label} active={daysAgo === o.daysAgo} onPress={() => setDaysAgo(o.daysAgo)} />
          ))}
        </View>
        <Field placeholder="Approx. time (optional), e.g. around 2 PM" value={eventTime} onChangeText={setEventTime} maxLength={30} />

        <Field
          label="Details"
          placeholder={isLost
            ? 'Colour, brand, stickers, contents… (keep one secret detail to verify finders)'
            : 'Condition, brand, anything notable… (don\'t reveal everything — let the owner prove it)'}
          value={description}
          onChangeText={setDescription}
          maxLength={LIMITS.description}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 110 }}
        />

        {isLost ? (
          <Field label="Reward (optional)" placeholder="e.g. ₹200 or a treat at the canteen" value={reward} onChangeText={setReward} maxLength={LIMITS.reward} />
        ) : (
          <Field
            label="Currently kept at (optional)"
            placeholder="e.g. Security desk, Main gate"
            value={currentlyAt}
            onChangeText={setCurrentlyAt}
            maxLength={LIMITS.location}
            hint="Handing valuables to security keeps everyone safe."
          />
        )}

        <View className="mt-2">
          <Button
            title="Publish report"
            icon="paper-plane-outline"
            variant={isLost ? 'primary' : 'secondary'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={processingImage}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
