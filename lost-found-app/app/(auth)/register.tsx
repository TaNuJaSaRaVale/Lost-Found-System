import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Image, Switch, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebase';
import { signInWithGoogle, GoogleSignInCancelled } from '../../services/googleAuth';
import { VisualCaptcha } from '../../components/Captcha';
import { Button, Field } from '../../components/ui';
import { useColors } from '../../hooks/useTheme';
import { friendlyAuthError, isAllowedEmail } from '../../utils/format';
import { ALLOWED_EMAIL_DOMAINS, PRIVACY_POLICY_URL } from '../../constants/config';

// Admin accounts are never self-assigned. Promote users from the Admin dashboard,
// or set role: "admin" on the very first account in the Firebase console.

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [prn, setPrn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    if (!name.trim() || !studentClass.trim() || !trimmedEmail || !password) {
      return Alert.alert('Missing details', 'Please fill in your name, class, email and password.');
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return Alert.alert('Invalid email', 'Please enter a valid email address.');
    if (!isAllowedEmail(trimmedEmail, ALLOWED_EMAIL_DOMAINS)) {
      return Alert.alert('Campus email required', `Please sign up with your campus email (${ALLOWED_EMAIL_DOMAINS.join(', ')}).`);
    }
    if (password.length < 8) return Alert.alert('Weak password', 'Use at least 8 characters.');
    if (password !== confirmPassword) return Alert.alert('Passwords differ', 'The two passwords do not match.');
    if (!acceptedTerms) return Alert.alert('Terms', 'Please accept the Terms & Privacy Policy.');
    if (!isVerified) return Alert.alert('Verification', 'Please complete the human check.');

    setLoading('email');
    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        email: trimmedEmail,
        studentClass: studentClass.trim(),
        ...(prn.trim() ? { prn: prn.trim() } : {}),
        role: 'user',
        status: 'active',
        createdAt: serverTimestamp(),
      });
      sendEmailVerification(user).catch(() => {});
    } catch (error) {
      Alert.alert('Sign-up failed', friendlyAuthError(error));
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    if (!acceptedTerms) return Alert.alert('Terms', 'Please accept the Terms & Privacy Policy first.');
    setLoading('google');
    try {
      await signInWithGoogle({
        ...(studentClass.trim() ? { studentClass: studentClass.trim() } : {}),
        ...(prn.trim() ? { prn: prn.trim() } : {}),
      });
    } catch (error: any) {
      if (!(error instanceof GoogleSignInCancelled)) Alert.alert('Google sign-in failed', friendlyAuthError(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="items-center mb-6 pt-6">
          <Image source={require('../../assets/images/logo.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
          <Text className="text-3xl font-extrabold text-text dark:text-text-dark mt-3">Join your campus</Text>
          <Text className="text-textLight dark:text-textLight-dark text-center mt-1 px-4">
            Lost something? Found something? Your campus has your back.
          </Text>
        </View>

        <View className="bg-surface dark:bg-surface-dark p-6 rounded-3xl border border-line dark:border-line-dark">
          <Field placeholder="Full name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
          <Field placeholder="Class / Department (e.g. TY AIML)" value={studentClass} onChangeText={setStudentClass} maxLength={60} />
          <Field placeholder="PRN / Employee ID (optional)" value={prn} onChangeText={setPrn} maxLength={30} autoCapitalize="characters" />
          <Field
            placeholder="Campus email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            hint={ALLOWED_EMAIL_DOMAINS.length ? `Must end with @${ALLOWED_EMAIL_DOMAINS[0]}` : undefined}
          />
          <View>
            <Field placeholder="Password (min 8 characters)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} style={{ paddingRight: 48 }} />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5" hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>
          <Field placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />

          <View className="flex-row items-center mb-4">
            <Switch value={acceptedTerms} onValueChange={setAcceptedTerms} trackColor={{ false: colors.line, true: colors.primary }} thumbColor="#fff" />
            <Text className="text-textLight dark:text-textLight-dark ml-2 text-sm flex-1">
              I agree to the{' '}
              <Text className="text-primary dark:text-primary-dark font-bold" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Terms & Privacy Policy</Text>
            </Text>
          </View>

          <View className="mb-5">
            <VisualCaptcha onVerify={setIsVerified} />
          </View>

          <Button title="Create account" icon="arrow-forward" onPress={handleRegister} loading={loading === 'email'} disabled={!!loading} />

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-line dark:bg-line-dark" />
            <Text className="mx-3 text-textLight dark:text-textLight-dark text-xs font-bold">OR</Text>
            <View className="flex-1 h-px bg-line dark:bg-line-dark" />
          </View>

          <TouchableOpacity
            className={`bg-surface dark:bg-muted-dark border border-line dark:border-line-dark py-4 rounded-2xl items-center flex-row justify-center ${loading ? 'opacity-60' : ''}`}
            onPress={handleGoogle}
            disabled={!!loading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text className="text-text dark:text-text-dark font-bold ml-3 text-base">
              {loading === 'google' ? 'Signing in…' : 'Sign up with Google'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-textLight dark:text-textLight-dark">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary dark:text-primary-dark font-bold">Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
