import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Handle the SDK 53+ restriction where Expo Go cannot get push tokens on Android
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
    console.log('Skipping push token generation: Not supported in Expo Go on Android since SDK 53.');
    return null;
  }

  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      if (!projectId) {
         // Using basic getExpoPushTokenAsync if EAS isn't set up yet
         token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
         token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      
      console.log("Expo Push Token:", token);
    } catch (e) {
      console.log("Error getting token (Expected in some Expo Go environments):", e);
    }
  } else {
    // Cannot use push notifications in simulator
    console.log('Must use physical device for Push Notifications');
  }

  // If we got a token and we are logged in, save it to Firestore
  if (token && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        expoPushToken: token,
      });
    } catch (error) {
       console.error("Error saving token to firestore", error);
    }
  }

  return token;
}

