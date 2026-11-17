import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, space, TOUCH, useTheme } from './theme';

export function Screen({ children, scroll = true, edges = ['top'] }: {
  children: ReactNode; scroll?: boolean; edges?: ('top' | 'bottom')[];
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
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
    <Text style={[{ fontFamily: fonts.headingBold, fontSize: size, lineHeight: size * 1.1, fontVariant: ['tabular-nums'], color: color ?? c.text }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, accessibilityHint }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean; loading?: boolean; accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const off = disabled || loading;
  const bg = variant === 'primary' ? c.accent : variant === 'secondary' ? c.sunken : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : variant === 'secondary' ? c.text : c.accent;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, error, hint, suffix, keyboardType, secure, autoCapitalize, multiline, placeholder, testID }: {
  label: string; value: string; onChangeText: (t: string) => void; error?: string; hint?: string; suffix?: string;
  keyboardType?: KeyboardTypeOptions; secure?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean; placeholder?: string; testID?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: c.sunken, borderColor: error ? c.warning : c.hairline }]}>
        <TextInput
          testID={testID}
          accessibilityLabel={suffix ? `${label}, ${suffix}` : label}
          accessibilityHint={error ?? hint}
          value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secure}
          autoCapitalize={autoCapitalize ?? 'sentences'} autoCorrect={false} multiline={multiline}
          placeholder={placeholder} placeholderTextColor={c.muted}
          style={[styles.input, { color: c.text }, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        />
        {suffix ? <Text style={[styles.suffix, { color: c.muted }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.help, { color: c.warning }]}>{error}</Text>
        : hint ? <Text style={[styles.help, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.sunken }]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, on && { backgroundColor: c.surface, borderColor: c.hairline }]}
            >
              <Text style={{ fontFamily: on ? fonts.bodySemiBold : fonts.body, fontSize: 15, color: on ? c.text : c.muted }}>{o.label}</Text>
            </Pressable>
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
        <Body>{label}</Body>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Switch accessibilityLabel={label} accessibilityHint={hint} value={value} onValueChange={onChange}
        trackColor={{ true: c.accent, false: c.hairline }} />
    </View>
  );
}

export function Banner({ tone = 'info', children, action }: {
  tone?: 'info' | 'warning'; children: ReactNode; action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole={tone === 'warning' ? 'alert' : 'text'}
      style={[styles.banner, { backgroundColor: c.sunken, borderColor: tone === 'warning' ? c.warning : c.hairline }]}>
      <Text style={[styles.muted, { flex: 1, color: tone === 'warning' ? c.warning : c.muted }]}>{children}</Text>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.bannerAction}>
          <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: c.accent }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Empty, loading and error states share one layout so every screen handles all three. */
export function StateView({ kind, title, message, action }: {
  kind: 'loading' | 'empty' | 'error'; title: string; message?: string; action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  return (
    <View style={styles.state} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {kind === 'loading' ? <ActivityIndicator color={c.accent} accessibilityLabel={title} /> : null}
      <Heading style={{ textAlign: 'center' }} color={kind === 'error' ? c.warning : undefined}>{title}</Heading>
      {message ? <Muted style={{ textAlign: 'center' }}>{message}</Muted> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderColor: c.hairline }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Muted style={{ flex: 1 }}>{label}</Muted>
      <Text style={{ fontFamily: fonts.heading, fontSize: 18, fontVariant: ['tabular-nums'], color: c.text, textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontFamily: fonts.headingBold, fontSize: 34, lineHeight: 38 },
  heading: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  button: { minHeight: TOUCH + 4, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonLabel: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.md },
  input: { flex: 1, minHeight: TOUCH, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.sm },
  suffix: { fontFamily: fonts.body, fontSize: 14, marginLeft: space.sm },
  help: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: TOUCH - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md - 3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderWidth: 1, padding: space.md },
  bannerAction: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, minHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
});
