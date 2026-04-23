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
        // Compress and Convert to Base64 (Resize to 600px width for efficiency)
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 600 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        // Use the base64 string as the image URI
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
      Alert.alert('Error', 'Please fill the required fields (Title, Category, Location, Date/Time).');
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
        // Backward compatibility for old components
        itemData.dateLost = dateTime.trim();
      } else {
        itemData.dateFound = dateTime.trim();
      }
      
      await addDoc(collection(db, collectionName), itemData);

      Alert.alert('Success', `Your ${type} item has been reported successfully!`);
      router.replace(`/(tabs)/${type === 'lost' ? 'home' : 'found'}`);

    } catch (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background p-6">
      <TouchableOpacity onPress={() => router.back()} className="mb-6">
        <Text className="text-primary font-bold">← Back</Text>
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-text mb-6">
        Report {type === 'lost' ? 'Lost' : 'Found'} Item
      </Text>

      <View className="bg-surface p-6 rounded-3xl border border-gray-100 mb-8">
        <Text className="text-text font-semibold mb-2">Item Name *</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text"
          placeholder="e.g., Blue Hydroflask"
          value={title}
          onChangeText={setTitle}
        />

        <Text className="text-text font-semibold mb-2">Category *</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text"
          placeholder="e.g., Electronics, Keys, Accessories"
          value={category}
          onChangeText={setCategory}
        />

        <Text className="text-text font-semibold mb-2">Location *</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text"
          placeholder={type === 'lost' ? 'Where did you last see it?' : 'Where did you find it?'}
          value={location}
          onChangeText={setLocation}
        />

        <View className="flex-row justify-between mb-4">
          <View className="flex-1 mr-2">
            <Text className="text-text font-semibold mb-2">Date & Time *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-text"
              placeholder="e.g. 10:30 AM"
              value={dateTime}
              onChangeText={setDateTime}
            />
          </View>
          
          {type === 'lost' && (
            <View className="flex-1 ml-2">
              <Text className="text-text font-semibold mb-2">Reward (Optional)</Text>
              <TextInput 
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-text"
                placeholder="e.g. $20 or Treat"
                value={reward}
                onChangeText={setReward}
              />
            </View>
          )}
        </View>

        <Text className="text-text font-semibold mb-2">Description</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 min-h-[100px] text-text"
          placeholder="Any distinguishing features?"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />


        <Text className="text-text font-semibold mb-2">Item Photo</Text>
        <TouchableOpacity 
          onPress={pickImage}
          className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl h-48 mb-6 overflow-hidden items-center justify-center"
        >
          {image ? (
            <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="items-center">
              <Ionicons name="camera" size={40} color="#94a3b8" />
              <Text className="text-textLight mt-2">Tap to Select Photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          className={`py-4 rounded-xl items-center flex-row justify-center ${type === 'lost' ? 'bg-primary' : 'bg-secondary'}`}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text className="text-white font-bold text-lg">Submit Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
