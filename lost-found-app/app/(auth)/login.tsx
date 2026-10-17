import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebase';
import { signInWithGoogle, GoogleSignInCancelled } from '../../services/googleAuth';
import { VisualCaptcha } from '../../components/Captcha';
import { Button, Field, inputClass } from '../../components/ui';
import { useColors } from '../../hooks/useTheme';
import { friendlyAuthError } from '../../utils/format';
import { PRIVACY_POLICY_URL } from '../../constants/config';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert('Missing details', 'Please enter your email and password.');
    if (!isVerified) return Alert.alert('Verification', 'Please complete the human check below.');
    setLoading('email');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      Alert.alert('Login failed', friendlyAuthError(error));
    } finally {
      setLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) return Alert.alert('Enter your email', 'Type your account email above, then tap "Forgot password?" again.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Check your inbox', `If an account exists for ${email.trim()}, a reset link is on its way.`);
    } catch (error) {
      Alert.alert('Could not send email', friendlyAuthError(error));
    }
  };

  const handleGoogleLogin = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (!(error instanceof GoogleSignInCancelled)) Alert.alert('Google sign-in failed', friendlyAuthError(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-8">
          <Image source={require('../../assets/images/logo.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
          <Text className="text-3xl font-extrabold text-text dark:text-text-dark mt-4">Welcome back</Text>
          <Text className="text-textLight dark:text-textLight-dark text-center mt-1">{"Find what's lost. Return what's found."}</Text>
        </View>

        <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-line dark:border-line-dark">
          <Field placeholder="Campus email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />

          <View className="mb-2">
            <TextInput
              className={inputClass}
              style={{ paddingRight: 48 }}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5" hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleForgotPassword} className="self-end mb-5" hitSlop={8}>
            <Text className="text-primary dark:text-primary-dark font-semibold text-sm">Forgot password?</Text>
          </TouchableOpacity>

          <View className="mb-5">
            <VisualCaptcha onVerify={setIsVerified} />
          </View>

          <Button title="Log in" icon="log-in-outline" onPress={handleLogin} loading={loading === 'email'} disabled={!!loading} />

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-line dark:bg-line-dark" />
            <Text className="mx-3 text-textLight dark:text-textLight-dark text-xs font-bold">OR</Text>
            <View className="flex-1 h-px bg-line dark:bg-line-dark" />
          </View>

          <TouchableOpacity
            className={`bg-surface dark:bg-muted-dark border border-line dark:border-line-dark py-4 rounded-2xl items-center flex-row justify-center ${loading ? 'opacity-60' : ''}`}
            onPress={handleGoogleLogin}
            disabled={!!loading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text className="text-text dark:text-text-dark font-bold ml-3 text-base">
              {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-textLight dark:text-textLight-dark">New here? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-primary dark:text-primary-dark font-bold">Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-textLight dark:text-textLight-dark text-xs text-center mt-6 px-6">
          By continuing you agree to our{' '}
          <Text className="text-primary dark:text-primary-dark font-semibold" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            Terms & Privacy Policy
          </Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
