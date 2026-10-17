// Shared building blocks so every screen looks and behaves the same.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryInfo, eventDateLabel, statusKind, timeAgo, ItemType } from '../utils/format';
import { useColors } from '../hooks/useTheme';

// Full class strings (not template-built) so NativeWind can compile the dark variants.
const CATEGORY_CLASSES: Record<string, { box: string; text: string; icon: string }> = {
  electronics: { box: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', icon: '#3B82F6' },
  wallet: { box: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', icon: '#10B981' },
  id_card: { box: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', icon: '#06B6D4' },
  documents: { box: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', icon: '#F43F5E' },
  keys: { box: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', icon: '#F59E0B' },
  bag: { box: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-300', icon: '#F97316' },
  books: { box: 'bg-lime-100 dark:bg-lime-500/15', text: 'text-lime-700 dark:text-lime-300', icon: '#84CC16' },
  clothing: { box: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', icon: '#A855F7' },
  accessories: { box: 'bg-pink-100 dark:bg-pink-500/15', text: 'text-pink-700 dark:text-pink-300', icon: '#EC4899' },
  bottle: { box: 'bg-sky-100 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', icon: '#0EA5E9' },
  others: { box: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', icon: '#64748B' },
};

export const categoryClasses = (category?: string) =>
  CATEGORY_CLASSES[categoryInfo(category).id] || CATEGORY_CLASSES.others;

export function CategoryBadge({ category }: { category?: string }) {
  const info = categoryInfo(category);
  const cls = categoryClasses(category);
  return (
    <View className={`flex-row items-center self-start px-2.5 py-1 rounded-full ${cls.box}`}>
      <Ionicons name={info.icon as any} size={11} color={cls.icon} />
      <Text className={`text-[11px] font-bold ml-1 ${cls.text}`}>{info.label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const kind = statusKind(status);
  if (kind === 'pending') {
    return (
      <View className="bg-amber-100 dark:bg-amber-500/15 px-2.5 py-1 rounded-full">
        <Text className="text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase">Handover</Text>
      </View>
    );
  }
  if (kind === 'returned') {
    return (
      <View className="bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-1 rounded-full">
        <Text className="text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold uppercase">Returned</Text>
      </View>
    );
  }
  return (
    <View className="bg-indigo-100 dark:bg-indigo-500/15 px-2.5 py-1 rounded-full">
      <Text className="text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold uppercase">Open</Text>
    </View>
  );
}

export function ItemCard({ item, type, onPress }: { item: any; type: ItemType; onPress: () => void }) {
  const colors = useColors();
  const cls = categoryClasses(item.category);
  const thumb = item.thumbnail || item.imageUrl;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-surface dark:bg-surface-dark rounded-3xl mb-3 border border-line dark:border-line-dark p-3 flex-row"
    >
      <View className={`w-20 h-20 rounded-2xl overflow-hidden items-center justify-center ${cls.box}`}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name={categoryInfo(item.category).icon as any} size={30} color={cls.icon} />
        )}
      </View>
      <View className="flex-1 ml-3 justify-between">
        <View>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-text dark:text-text-dark flex-1 mr-2" numberOfLines={1}>
              {item.title}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="location-outline" size={13} color={colors.textLight} />
            <Text className="text-textLight dark:text-textLight-dark text-xs ml-1 flex-1" numberOfLines={1}>
              {item.location || 'Unknown location'}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <CategoryBadge category={item.category} />
          <Text className="text-textLight dark:text-textLight-dark text-[11px]">
            {type === 'lost_items' ? 'Lost ' : 'Found '}
            {item.eventDate ? eventDateLabel(item).split(',')[0] : timeAgo(item.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function EmptyState({ icon, title, subtitle, children }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; children?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View className="items-center justify-center px-10 py-16">
      <View className="bg-primary/10 dark:bg-primary-dark/15 p-6 rounded-full mb-5">
        <Ionicons name={icon} size={44} color={colors.primary} />
      </View>
      <Text className="text-text dark:text-text-dark font-bold text-lg text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-textLight dark:text-textLight-dark text-center mt-2 leading-5">{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

export const inputClass =
  'bg-muted dark:bg-muted-dark border border-line dark:border-line-dark rounded-2xl px-4 py-3.5 text-text dark:text-text-dark text-base';

export function Field({ label, maxLength, value, hint, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const colors = useColors();
  return (
    <View className="mb-4">
      {label ? (
        <View className="flex-row justify-between mb-2">
          <Text className="text-xs font-bold text-textLight dark:text-textLight-dark uppercase tracking-wider">{label}</Text>
          {maxLength && value ? (
            <Text className="text-[11px] text-textLight dark:text-textLight-dark">{value.length}/{maxLength}</Text>
          ) : null}
        </View>
      ) : null}
      <TextInput
        className={inputClass}
        placeholderTextColor={colors.placeholder}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      {hint ? <Text className="text-[11px] text-textLight dark:text-textLight-dark mt-1.5 ml-1">{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: {
  label: string; active: boolean; onPress: () => void; icon?: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-3.5 py-2 rounded-full border mr-2 mb-2 ${
        active ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark' : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark'
      }`}
    >
      {icon ? <Ionicons name={icon as any} size={14} color={active ? '#fff' : colors.textLight} style={{ marginRight: 5 }} /> : null}
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-text dark:text-text-dark'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const styles = {
    primary: 'bg-primary dark:bg-primary-dark',
    secondary: 'bg-secondary dark:bg-secondary-dark',
    danger: 'bg-danger dark:bg-danger-dark',
    ghost: 'bg-muted dark:bg-muted-dark border border-line dark:border-line-dark',
  }[variant];
  const textColor = variant === 'ghost' ? 'text-text dark:text-text-dark' : 'text-white';
  const iconColor = variant === 'ghost' ? colors.text : '#fff';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
      className={`py-4 rounded-2xl items-center justify-center flex-row ${styles} ${loading || disabled ? 'opacity-60' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 8 }} /> : null}
          <Text className={`font-bold text-base ${textColor}`}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
