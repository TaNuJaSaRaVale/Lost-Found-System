import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import { db, auth } from './firebase';

// Show notifications as banners even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync({ prompt = true } = {}) {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  // Expo Go on Android cannot obtain push tokens since SDK 53.
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return null;
  if (!Device.isDevice) return null;

  let token = null;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted' && prompt) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (e) {
    console.log('Push token unavailable:', e?.message);
    return null;
  }

  if (token && auth.currentUser) {
    try {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { expoPushToken: token, notificationsEnabled: true },
        { merge: true },
      );
    } catch (error) {
      console.log('Could not save push token:', error?.message);
    }
  }

  return token;
}

export async function disablePushNotifications() {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, 'users', auth.currentUser.uid),
    { expoPushToken: deleteField(), notificationsEnabled: false },
    { merge: true },
  );
}
