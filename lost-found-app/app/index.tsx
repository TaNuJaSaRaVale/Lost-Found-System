import { View, ActivityIndicator } from 'react-native';
import { useColors } from '../hooks/useTheme';

// Matches the root "/" route; the root layout redirects to login or home.
export default function Index() {
  const colors = useColors();
  return (
    <View className="flex-1 justify-center items-center bg-background dark:bg-background-dark">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
