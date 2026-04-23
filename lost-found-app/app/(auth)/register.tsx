import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, testFirebaseConnection } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    
    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name.trim() });

      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'user',
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      if (error.message.includes('network-request-failed')) {
        const diagnostic = await testFirebaseConnection();
        if (!diagnostic.success) {
          Alert.alert('Connection Failed', `The app can't reach Firebase. This is usually caused by a restricted campus network or emulator Wi-Fi issues.\n\nDetails: ${diagnostic.error}`);
        } else {
          Alert.alert('Network Error', "Local network is okay, but registration failed. Please try again.");
        }
      } else {
        Alert.alert('Registration Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View className="items-center mb-8">
        <Text className="text-4xl font-bold text-primary mb-2">Join Platform</Text>
        <Text className="text-textLight text-lg text-center">Help keep the campus connected.</Text>
      </View>

      <View className="bg-surface p-6 rounded-3xl shadow-sm border border-gray-100">
        <Text className="text-2xl font-bold text-text mb-6">Create Account</Text>
        
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text text-base"
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text text-base"
          placeholder="Campus Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text text-base"
          placeholder="Phone Number (Optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        
        <View className="relative mb-6">
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-text text-base"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-3.5"
          >
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          className="bg-primary py-4 rounded-xl items-center flex-row justify-center mb-6"
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text className="text-white font-bold text-lg">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-textLight">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary font-bold">Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

