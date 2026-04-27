import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, testFirebaseConnection } from '../../services/firebase';
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

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prn, setPrn] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || (role === 'user' && !studentClass) || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
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
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name.trim() });

      const userData: any = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: role,
        status: 'active',
        createdAt: serverTimestamp()
      };
      
      if (role === 'user') {
        userData.studentClass = studentClass.trim();
        if (prn) userData.prn = prn.trim();
      }

      await setDoc(doc(db, 'users', user.uid), userData);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      Alert.alert('Required', 'Please agree to the Terms & Conditions before registering with Google.');
      return;
    }

    if (!GoogleSignin) {
      Alert.alert('Development Mode', 'Google Sign-In requires a custom dev client. Please run using eas build or npx expo run:android, as it leverages native OS modules unavailable in Expo Go.');
      return;
    }

    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      
      if (!idToken) throw new Error("No ID Token found");

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        const newUserData: any = {
          name: userCredential.user.displayName || 'Google User',
          email: userCredential.user.email || '',
          role: role, 
          status: 'active',
          createdAt: serverTimestamp()
        };
        
        if (role === 'user') {
          newUserData.studentClass = studentClass.trim() || 'Student'; 
          if (prn) newUserData.prn = prn.trim();
        }

        await setDoc(userDocRef, newUserData);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
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
      contentContainerStyle={{ flexGrow: 1, padding: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center mb-8 pt-6">
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={{ width: 100, height: 100 }}
          resizeMode="contain"
        />
        <Text className="text-3xl font-extrabold text-text dark:text-text-dark mt-4">Join Us</Text>
        <Text className="text-textLight dark:text-textLight-dark text-center mt-2 px-4">
          The most reliable way to find what you've lost on campus.
        </Text>
      </View>

      <View className="bg-surface dark:bg-surface-dark p-6 rounded-[32px] shadow-xl border border-gray-100 dark:border-gray-800">
        <Text className="text-xl font-bold text-text dark:text-text-dark mb-6">Create your account</Text>
        
        <View className="space-y-4 gap-4">
          <TextInput
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
            placeholder="Full Name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />

          {role === 'user' && (
            <>
              <TextInput
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
                placeholder="Class or Department (e.g. AIML / Faculty)"
                placeholderTextColor="#9CA3AF"
                value={studentClass}
                onChangeText={setStudentClass}
              />
              <TextInput
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
                placeholder="PRN / Employee ID (Optional)"
                placeholderTextColor="#9CA3AF"
                value={prn}
                onChangeText={setPrn}
              />
            </>
          )}

          <TextInput
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
            placeholder="Campus Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View className="relative">
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

          <TextInput
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-text dark:text-text-dark text-base"
            placeholder="Confirm Password"
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />

          <View className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-bold text-textLight dark:text-textLight-dark mb-3 uppercase tracking-wider">Account Type</Text>
            <View className="flex-row">
              <TouchableOpacity 
                onPress={() => setRole('user')}
                className={`flex-1 py-3 items-center rounded-xl mr-2 ${role === 'user' ? 'bg-primary' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}
              >
                <Text className={`font-bold py-1 ${role === 'user' ? 'text-white' : 'text-textLight dark:text-textLight-dark'}`}>Standard User</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setRole('admin')}
                className={`flex-1 py-3 items-center rounded-xl ml-2 ${role === 'admin' ? 'bg-accent' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}
              >
                <Text className={`font-bold py-1 ${role === 'admin' ? 'text-white' : 'text-textLight dark:text-textLight-dark'}`}>Administrator</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row items-center px-1 my-2">
            <Switch
              value={acceptedTerms}
              onValueChange={setAcceptedTerms}
              trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
              thumbColor={acceptedTerms ? '#fff' : '#f4f3f4'}
            />
            <Text className="text-textLight dark:text-textLight-dark ml-2 text-sm flex-1">
              I agree to the <Text className="text-primary font-bold">Terms & Conditions</Text>
            </Text>
          </View>

          <View className="items-center my-2">
            <VisualCaptcha onVerify={setIsVerified} />
          </View>

          <TouchableOpacity 
            className={`py-4 rounded-2xl items-center flex-row justify-center mt-2 shadow-lg shadow-primary/30 ${loading ? 'bg-primary/70' : 'bg-primary'}`}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
               <ActivityIndicator color="#fff" />
            ) : (
               <>
                <Text className="text-white font-extrabold text-lg mr-2">Create Account</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
               </>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
            <Text className="mx-4 text-textLight dark:text-textLight-dark font-bold text-xs uppercase">OR</Text>
            <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
          </View>

          <TouchableOpacity 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-4 rounded-2xl items-center flex-row justify-center"
            onPress={handleGoogleLogin}
          >
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={{ width: 20, height: 20 }} />
            <Text className="text-text dark:text-text-dark font-bold ml-3 text-base">Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-8">
          <Text className="text-textLight dark:text-textLight-dark">Already part of the community? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary font-bold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View className="h-10" />
    </ScrollView>
  );
}

