import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TIPS = [
  'Add a clear photo — reports with photos get matched far more often.',
  'Mention unique marks (stickers, scratches, initials) but keep one secret detail to verify the real owner.',
  'Found something valuable? Hand it to the security desk and mention it in "Currently kept at".',
];

export default function ReportScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text className="text-2xl font-extrabold text-text dark:text-text-dark mb-1">What happened?</Text>
      <Text className="text-textLight dark:text-textLight-dark mb-6">{"Post a report and we'll alert matching students automatically."}</Text>

      <TouchableOpacity
        activeOpacity={0.85}
        className="bg-primary dark:bg-primary-dark p-6 rounded-3xl mb-4 flex-row items-center"
        onPress={() => router.push({ pathname: '/report-item', params: { type: 'lost' } })}
      >
        <View className="bg-white/20 p-4 rounded-2xl mr-4">
          <Ionicons name="search" size={30} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-white text-xl font-extrabold">I lost something</Text>
          <Text className="text-white/80 mt-1">Describe it so finders can recognise it.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        className="bg-secondary dark:bg-secondary-dark p-6 rounded-3xl mb-8 flex-row items-center"
        onPress={() => router.push({ pathname: '/report-item', params: { type: 'found' } })}
      >
        <View className="bg-white/20 p-4 rounded-2xl mr-4">
          <Ionicons name="hand-left" size={30} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-white text-xl font-extrabold">I found something</Text>
          <Text className="text-white/80 mt-1">Help it get back to its owner.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="white" />
      </TouchableOpacity>

      <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-wider mb-3">Tips for a quick recovery</Text>
      {TIPS.map(tip => (
        <View key={tip} className="flex-row bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-4 mb-2">
          <Ionicons name="bulb-outline" size={18} color="#D97706" />
          <Text className="text-text dark:text-text-dark ml-3 flex-1 leading-5">{tip}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
