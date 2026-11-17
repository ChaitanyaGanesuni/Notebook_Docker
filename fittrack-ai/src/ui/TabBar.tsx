import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from './components';
import { PressableScale } from './motion';
import { fonts, motion, radius, space, useTheme } from './theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'today', off: 'today-outline' },
  train: { on: 'barbell', off: 'barbell-outline' },
  progress: { on: 'stats-chart', off: 'stats-chart-outline' },
  coach: { on: 'chatbubble-ellipses', off: 'chatbubble-ellipses-outline' },
  plan: { on: 'list', off: 'list-outline' },
};

/** Floating tab bar. The highlight slides between tabs on a spring. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { c, lift, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const tab = width > 0 ? (width - PAD * 2) / count : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(state.index * tab, motion.spring));
  }, [state.index, tab, x]);
  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View style={{ backgroundColor: c.background, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md) }}>
      <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, lift, { backgroundColor: c.surface, borderColor: dark ? c.hairline : 'transparent' }]}>
        {tab > 0 ? <Animated.View style={[styles.highlight, { width: tab, backgroundColor: c.primary }, highlight]} /> : null}
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const title = String(descriptors[route.key]?.options.title ?? route.name);
          const icons = TAB_ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };
          const color = focused ? c.onPrimary : c.muted;
          return (
            <PressableScale key={route.key} haptic accessibilityRole="tab" accessibilityLabel={`${title} tab`}
              accessibilityState={{ selected: focused }} style={styles.tab}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}>
              <Ionicons name={focused ? icons.on : icons.off} size={21} color={color} />
              <Text numberOfLines={1} style={{ fontFamily: focused ? fonts.bodySemiBold : fonts.bodyMedium, fontSize: 10.5, color }}>{title}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const PAD = 6;
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderRadius: radius.pill, padding: PAD, borderWidth: StyleSheet.hairlineWidth },
  highlight: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.pill },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
});
