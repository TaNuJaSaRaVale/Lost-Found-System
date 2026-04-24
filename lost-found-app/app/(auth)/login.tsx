import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, testFirebaseConnection } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      if (error.message.includes('network-request-failed')) {
        const diagnostic = await testFirebaseConnection();
        if (!diagnostic.success) {
          Alert.alert('Connection Failed', `The app can't reach Firebase. This is usually caused by a restricted campus network or emulator Wi-Fi issues.\n\nDetails: ${diagnostic.error}`);
        } else {
          Alert.alert('Network Error', "Local network is okay, but login failed. Please try again.");
        }
      } else {
        Alert.alert('Login Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-background">
      <View className="items-center mb-10">
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={{ width: 180, height: 180 }}
          resizeMode="contain"
        />
      </View>

      <View className="bg-surface p-6 rounded-3xl shadow-sm border border-gray-100">
        <Text className="text-2xl font-bold text-text mb-6">Welcome Back</Text>
        
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-text text-base"
          placeholder="Campus Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text className="text-white font-bold text-lg">Log In</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-textLight">New here? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary font-bold">Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

