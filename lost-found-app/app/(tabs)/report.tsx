import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function ReportScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background p-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View className="items-center mb-8">
        <Text className="text-3xl font-bold text-text mb-2">Report an Item</Text>
        <Text className="text-textLight text-center">Did you lose something or find something? Let the campus know.</Text>
      </View>

      <View className="space-y-6 flex-col gap-6">
        <TouchableOpacity 
          className="bg-primary p-6 rounded-3xl items-center shadow-sm"
          onPress={() => router.push({ pathname: '/report-item', params: { type: 'lost' } })}
        >
          <Text className="text-5xl mb-4">🔍</Text>
          <Text className="text-white text-xl font-bold">I Lost Something</Text>
          <Text className="text-primary-100 text-center mt-2 text-gray-200">Post details about your lost item to find a match.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="bg-secondary p-6 rounded-3xl items-center shadow-sm"
          onPress={() => router.push({ pathname: '/report-item', params: { type: 'found' } })}
        >
          <Text className="text-5xl mb-4">✨</Text>
          <Text className="text-white text-xl font-bold">I Found Something</Text>
          <Text className="text-secondary-100 text-center mt-2 text-gray-200">Help return an item to its rightful owner.</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
