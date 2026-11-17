import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '../../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline' },
  { name: 'train', title: 'Train', icon: 'barbell-outline' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline' },
  { name: 'coach', title: 'Coach', icon: 'chatbubble-ellipses-outline' },
  { name: 'plan', title: 'Plan', icon: 'list-outline' },
];

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.accent,
      tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.hairline },
      tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
    }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarAccessibilityLabel: `${t.title} tab`,
          tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color as string} size={size} />,
        }} />
      ))}
    </Tabs>
  );
}
