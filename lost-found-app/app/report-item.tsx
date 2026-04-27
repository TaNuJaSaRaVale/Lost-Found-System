import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

export default function ReportItemScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams(); 
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [reward, setReward] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setLoading(true);
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 600 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const base64Image = `data:image/jpeg;base64,${manipResult.base64}`;
        setImage(base64Image);
      } catch (error) {
        Alert.alert('Error', 'Failed to process image.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title || !category || !location || !dateTime) {
      Alert.alert('Error', 'Please fill the required fields.');
      return;
    }

    try {
      setLoading(true);
      const collectionName = type === 'lost' ? 'lost_items' : 'found_items';
      
      const itemData: any = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        dateTime: dateTime.trim(),
        imageUrl: image || '', 
        userId: auth.currentUser?.uid,
        status: 'open',
        dateReported: new Date().toISOString(),
        createdAt: serverTimestamp()
      };

      if (type === 'lost') {
        itemData.reward = reward.trim();
        itemData.dateLost = dateTime.trim();
      } else {
        itemData.dateFound = dateTime.trim();
      }
      
      await addDoc(collection(db, collectionName), itemData);
      Alert.alert('Success 🎉', `Your ${type} report has been published.`);
      router.replace(`/(tabs)/${type === 'lost' ? 'home' : 'found'}`);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" showsVerticalScrollIndicator={false}>
      <View className="p-8 pt-12">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="bg-gray-100 dark:bg-gray-800 self-start p-3 rounded-2xl mb-8"
        >
          <Ionicons name="arrow-back" size={24} color="#6366F1" />
        </TouchableOpacity>

        <Text className="text-4xl font-extrabold text-text dark:text-text-dark mb-2">
          New {type === 'lost' ? 'Lost' : 'Found'} Report
        </Text>
        <Text className="text-textLight dark:text-textLight-dark text-base mb-8">
          Provide as much detail as possible to help the community.
        </Text>

        <View className="bg-surface dark:bg-surface-dark p-8 rounded-[40px] shadow-2xl border border-gray-100 dark:border-gray-800 mb-20">
          <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-3">Core Information</Text>
          
          <TextInput 
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 mb-4 text-text dark:text-text-dark text-base font-medium"
            placeholder="Item Title (e.g. Red Backpack)"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput 
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 mb-4 text-text dark:text-text-dark text-base"
            placeholder="Category (e.g. Wallet, Electronics)"
            placeholderTextColor="#9CA3AF"
            value={category}
            onChangeText={setCategory}
          />

          <TextInput 
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 mb-6 text-text dark:text-text-dark text-base"
            placeholder={type === 'lost' ? 'Last known location?' : 'Where was it found?'}
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />

          <View className="flex-row justify-between mb-6">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-3">When</Text>
              <TextInput 
                className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
                placeholder="Time/Date"
                placeholderTextColor="#9CA3AF"
                value={dateTime}
                onChangeText={setDateTime}
              />
            </View>
            
            {type === 'lost' && (
              <View className="flex-1 ml-2">
                <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-3">Gratitude</Text>
                <TextInput 
                  className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
                  placeholder="Reward?"
                  placeholderTextColor="#9CA3AF"
                  value={reward}
                  onChangeText={setReward}
                />
              </View>
            )}
          </View>

          <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-3">Distinguishing Features</Text>
          <TextInput 
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4 mb-8 min-h-[140px] text-text dark:text-text-dark text-base"
            placeholder="Describe unique marks, contents, or condition..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-widest mb-3">Visual Evidence</Text>
          <TouchableOpacity 
            onPress={pickImage}
            className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[32px] h-56 mb-10 overflow-hidden items-center justify-center shadow-inner"
          >
            {image ? (
              <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <View className="bg-primary/10 p-5 rounded-full mb-3">
                  <Ionicons name="camera" size={32} color="#6366F1" />
                </View>
                <Text className="text-textLight dark:text-textLight-dark font-bold">Pick a Clear Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            className={`py-5 rounded-[24px] items-center flex-row justify-center shadow-2xl shadow-primary/40 ${type === 'lost' ? 'bg-primary' : 'bg-secondary'}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
               <ActivityIndicator color="#fff" />
            ) : (
               <>
                <Text className="text-white font-extrabold text-xl mr-3">Publish Report</Text>
                <Ionicons name="rocket-outline" size={24} color="white" />
               </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
