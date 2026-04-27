import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  // This file exists to provide a match for the root "/" route.
  // We show a loading spinner while the root layout handles the redirect.
  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}
