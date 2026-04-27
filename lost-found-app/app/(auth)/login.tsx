import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { VisualCaptcha } from '../../components/Captcha';
let GoogleSignin: any = null;
let statusCodes: any = null;

try {
  const gSignIn = require('@react-native-google-signin/google-signin');
  GoogleSignin = gSignIn.GoogleSignin;
  statusCodes = gSignIn.statusCodes;
  
  GoogleSignin.configure({
    webClientId: '145937489025-r4uuaugq8pj9md58s9ppqthq4sin7vv0.apps.googleusercontent.com',
  });
} catch (e) {
  console.warn("Google Signin Native Module not found. Running in Expo Go?");
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Error', 'Please accept the Terms and Conditions.');
      return;
    }

    if (!isVerified) {
      Alert.alert('Error', 'Please complete the verification slide.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!GoogleSignin) {
      Alert.alert('Development Mode', 'Google Sign-In requires a custom dev client. Please run using eas build or npx expo run:android, as it leverages native OS modules unavailable in Expo Go.');
      return;
    }

    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      
      if (!idToken) {
         throw new Error("No ID Token found");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      // Ensure profile exists in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          name: userCredential.user.displayName || 'Google User',
          email: userCredential.user.email || '',
          studentClass: 'Student', // Default for Google Sign In
          role: 'user',
          status: 'active',
          createdAt: serverTimestamp()
        });
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
        return;
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation already in progress
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated.');
      } else {
        console.error("Google Signin Error: ", error);
        Alert.alert('Google Sign-In Failed', error.message || 'An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      className="flex-1 bg-background dark:bg-background-dark" 
      contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
    >
      <View className="items-center mb-10">
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <Text className="text-3xl font-extrabold text-text dark:text-text-dark mt-6">Welcome Back</Text>
        <Text className="text-textLight dark:text-textLight-dark text-center mt-2">
          Securely access your campus lost & found account.
        </Text>
      </View>

      <View className="bg-surface dark:bg-surface-dark p-8 rounded-[32px] shadow-xl border border-gray-100 dark:border-gray-800">
        <TextInput
          className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 mb-4 text-text dark:text-text-dark text-base"
          placeholder="Campus Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <View className="relative mb-6">
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-5 top-4"
          >
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center px-1 mb-6">
          <Switch
            value={acceptedTerms}
            onValueChange={setAcceptedTerms}
            trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
            thumbColor={acceptedTerms ? '#fff' : '#f4f3f4'}
          />
          <Text className="text-textLight dark:text-textLight-dark ml-2 text-sm">
            Keep me logged in & accept <Text className="text-primary font-bold">Terms</Text>
          </Text>
        </View>

        <View className="items-center mb-6">
           <VisualCaptcha onVerify={setIsVerified} />
        </View>

        <TouchableOpacity 
          className={`py-4 rounded-2xl items-center flex-row justify-center mb-6 shadow-lg shadow-primary/30 ${loading ? 'bg-primary/70' : 'bg-primary'}`}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <>
              <Text className="text-white font-extrabold text-lg mr-2">Log In</Text>
              <Ionicons name="log-in-outline" size={20} color="white" />
             </>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
          <Text className="mx-4 text-textLight dark:text-textLight-dark font-bold text-xs uppercase">OR</Text>
          <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
        </View>

        <TouchableOpacity 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-4 rounded-2xl items-center flex-row justify-center mb-8"
          onPress={handleGoogleLogin}
        >
          <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={{ width: 20, height: 20 }} />
          <Text className="text-text dark:text-text-dark font-bold ml-3 text-base">Continue with Google</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-textLight dark:text-textLight-dark">New here? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary font-bold">Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

