import { Tabs } from 'expo-router';
import { TabBar } from '../../ui/TabBar';
import { useTheme } from '../../ui/theme';

const TABS = [
  { name: 'index', title: 'Today' },
  { name: 'train', title: 'Train' },
  { name: 'progress', title: 'Progress' },
  { name: 'coach', title: 'Coach' },
  { name: 'plan', title: 'Plan' },
];

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
    </Tabs>
  );
}
