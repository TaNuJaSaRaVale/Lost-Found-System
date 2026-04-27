import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function ReportScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark p-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View className="items-center mb-8">
        <Text className="text-3xl font-bold text-text dark:text-text-dark mb-2">Report an Item</Text>
        <Text className="text-textLight dark:text-textLight-dark text-center">Did you lose something or find something? Let the campus know.</Text>
      </View>

      <View className="space-y-6 flex-col gap-6">
        <TouchableOpacity 
          className="bg-primary dark:bg-[#1e1b4b]/80 p-6 rounded-3xl items-center shadow-lg dark:border dark:border-indigo-400/80"
          onPress={() => router.push({ pathname: '/report-item', params: { type: 'lost' } })}
        >
          <Text className="text-5xl mb-4">🔍</Text>
          <Text className="text-white dark:text-indigo-100 text-xl font-extrabold tracking-wide">I Lost Something</Text>
          <Text className="text-gray-200 dark:text-indigo-200/70 text-center mt-2 font-medium">Post details about your lost item to find a match.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-secondary dark:bg-[#022c22]/80 p-6 rounded-3xl items-center shadow-lg dark:border dark:border-emerald-400/80"
          onPress={() => router.push({ pathname: '/report-item', params: { type: 'found' } })}
        >
          <Text className="text-5xl mb-4">✨</Text>
          <Text className="text-white dark:text-emerald-100 text-xl font-extrabold tracking-wide">I Found Something</Text>
          <Text className="text-gray-200 dark:text-emerald-200/70 text-center mt-2 font-medium">Help return an item to its rightful owner.</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
