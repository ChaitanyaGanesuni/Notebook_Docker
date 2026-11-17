import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale } from './motion';
import { fonts, motion, radius, space, TOUCH, useTheme } from './theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({ children, scroll = true, edges = ['top'] }: {
  children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[];
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; color?: string };

export function Title({ children, style, color }: TextProps) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" style={[styles.title, { color: color ?? c.text }, style]}>{children}</Text>;
}
export function Heading({ children, style, color }: TextProps) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" style={[styles.heading, { color: color ?? c.text }, style]}>{children}</Text>;
}
/** Small spaced capitals used above titles and sections. */
export function Eyebrow({ children, style, color }: TextProps) {
  const { c } = useTheme();
  return <Text style={[styles.eyebrow, { color: color ?? c.muted }, style]}>{children}</Text>;
}
export function Body({ children, style, color }: TextProps) {
  const { c } = useTheme();
  return <Text style={[styles.body, { color: color ?? c.text }, style]}>{children}</Text>;
}
export function Muted({ children, style, color }: TextProps) {
  const { c } = useTheme();
  return <Text style={[styles.muted, { color: color ?? c.muted }, style]}>{children}</Text>;
}
/** Numerals: Barlow Condensed with tabular figures so columns line up. */
export function Num({ children, style, color, size = 28 }: TextProps & { size?: number }) {
  const { c } = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.headingBold, fontSize: size, lineHeight: size * 1.05, fontVariant: ['tabular-nums'], color: color ?? c.text }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, dark, lift } = useTheme();
  return (
    <View style={[styles.card, lift, { backgroundColor: c.surface, borderColor: dark ? c.hairline : 'transparent' }, style]}>{children}</View>
  );
}

/** A card title with a tinted icon chip. */
export function SectionHeader({ icon, title, tint, soft }: { icon: IconName; title: string; tint?: string; soft?: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <IconChip icon={icon} tint={tint ?? c.accent} soft={soft ?? c.accentSoft} />
      <Heading>{title}</Heading>
    </View>
  );
}

export function IconChip({ icon, tint, soft, size = 34 }: { icon: IconName; tint: string; soft: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.53} color={tint} />
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, accessibilityHint, icon }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean; loading?: boolean; accessibilityHint?: string; icon?: IconName;
}) {
  const { c } = useTheme();
  const off = disabled || loading;
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.sunken : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'secondary' ? c.text : c.accent;
  return (
    <PressableScale
      haptic={variant === 'primary'}
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off} onPress={onPress}
      style={[styles.button, { backgroundColor: bg, opacity: off ? 0.5 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        </>
      )}
    </PressableScale>
  );
}

export function Field({ label, value, onChangeText, error, hint, suffix, keyboardType, secure, autoCapitalize, multiline, placeholder, testID }: {
  label: string; value: string; onChangeText: (t: string) => void; error?: string; hint?: string; suffix?: string;
  keyboardType?: KeyboardTypeOptions; secure?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean; placeholder?: string; testID?: string;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: c.sunken, borderColor: error ? c.warning : focused ? c.accent : 'transparent' }]}>
        <TextInput
          testID={testID}
          accessibilityLabel={suffix ? `${label}, ${suffix}` : label}
          accessibilityHint={error ?? hint}
          value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secure}
          autoCapitalize={autoCapitalize ?? 'sentences'} autoCorrect={false} multiline={multiline}
          placeholder={placeholder} placeholderTextColor={c.muted}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={[styles.input, { color: c.text }, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        />
        {suffix ? <Text style={[styles.suffix, { color: c.muted }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.help, { color: c.warning }]}>{error}</Text>
        : hint ? <Text style={[styles.help, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Segmented control with a thumb that slides to the chosen option. */
export function Segmented<T extends string>({ label, options, value, onChange, hideLabel }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
  /** Keep the label for screen readers only. */
  hideLabel?: boolean;
}) {
  const { c, lift, dark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(index * segment, motion.spring));
  }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View style={{ gap: 6 }}>
      {hideLabel ? null : <Text style={[styles.label, { color: c.muted }]}>{label}</Text>}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.segmented, { backgroundColor: c.sunken }]}>
        {segment > 0 ? <Animated.View style={[styles.thumb, lift, { width: segment, backgroundColor: dark ? '#353D4A' : c.surface }, thumb]} /> : null}
        {options.map((o) => {
          const on = o.value === value;
          return (
            <PressableScale key={o.value} haptic accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
              onPress={() => onChange(o.value)} style={styles.segment}>
              <Text style={{ fontFamily: on ? fonts.bodySemiBold : fonts.bodyMedium, fontSize: 15, color: on ? c.text : c.muted }}>{o.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontFamily: fonts.bodyMedium }}>{label}</Body>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Switch accessibilityLabel={label} accessibilityHint={hint} value={value} onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.hairline }} thumbColor="#FFFFFF" ios_backgroundColor={c.hairline} />
    </View>
  );
}

export function Banner({ tone = 'info', children, action }: {
  tone?: 'info' | 'warning'; children: ReactNode; action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  const warn = tone === 'warning';
  return (
    <View accessibilityRole={warn ? 'alert' : 'text'}
      style={[styles.banner, { backgroundColor: warn ? c.warningSoft : c.sunken }]}>
      <Ionicons name={warn ? 'alert-circle' : 'cloud-upload-outline'} size={18} color={warn ? c.warning : c.muted} />
      <Text style={[styles.muted, { flex: 1, color: warn ? c.warning : c.text }]}>{children}</Text>
      {action ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.bannerAction}>
          <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: c.accent }}>{action.label}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Empty, loading and error states share one layout so every screen handles all three. */
export function StateView({ kind, title, message, action, icon }: {
  kind: 'loading' | 'empty' | 'error'; title: string; message?: string; action?: { label: string; onPress: () => void }; icon?: IconName;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.state} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {kind === 'loading' ? <ActivityIndicator color={c.accent} accessibilityLabel={title} />
        : <IconChip size={56} icon={icon ?? (kind === 'error' ? 'alert-circle-outline' : 'sparkles-outline')}
            tint={kind === 'error' ? c.warning : c.accent} soft={kind === 'error' ? c.warningSoft : c.accentSoft} />}
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? <Muted style={{ textAlign: 'center' }}>{message}</Muted> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderColor: c.hairline, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Muted style={{ flex: 1, fontSize: 14 }}>{label}</Muted>
      <Text style={{ fontFamily: fonts.heading, fontSize: 19, fontVariant: ['tabular-nums'], color: c.text, textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

/** A list line with a small check mark, for rules and tips. */
export function Bullet({ children, icon = 'checkmark', tint }: { children: ReactNode; icon?: IconName; tint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={16} color={tint ?? c.accent} style={{ marginTop: 3 }} />
      <Body style={{ flex: 1 }}>{children}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontFamily: fonts.headingBold, fontSize: 38, lineHeight: 40, letterSpacing: 0.2 },
  heading: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26, letterSpacing: 0.2 },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg + 2, gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  button: { minHeight: 54, borderRadius: radius.pill, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  buttonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 16, letterSpacing: 0.2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontFamily: fonts.bodyMedium, fontSize: 16, paddingVertical: space.sm, outlineStyle: 'none' } as object,
  suffix: { fontFamily: fonts.body, fontSize: 14, marginLeft: space.sm },
  help: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: radius.md - 3 },
  segment: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.lg, minHeight: TOUCH + 8 },
  bannerAction: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.sm },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingVertical: space.xs },
});
