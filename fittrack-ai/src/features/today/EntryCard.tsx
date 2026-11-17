import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { CONFIDENCE_LABEL } from '../../../supabase/functions/_shared/ai/estimate.ts';
import { useEntryPhoto } from '../../ai/useEntryPhoto';
import type { MealEntryRow } from '../../data/tables';
import { macroCheck, SOURCE_LABEL, type Source } from '../../domain/meals';
import type { IconName } from '../../ui/components';
import { PressableScale } from '../../ui/motion';
import { fonts, LIME, radius, space, TOUCH, useTheme } from '../../ui/theme';

const SOURCE_ICON: Record<Source, IconName> = { home: 'home-outline', canteen: 'business-outline', ordered: 'bicycle-outline' };
const n1 = (v: number | null | undefined) => (v == null ? '–' : (Math.round(Number(v) * 10) / 10).toLocaleString('en-IN'));
const THUMB = 52;

/** Photo thumbnail. While estimating, a scan line sweeps over it. */
function Thumb({ uri, scanning }: { uri: string | null; scanning: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!scanning || reduced) return;
    y.set(withRepeat(withSequence(withTiming(THUMB - 3, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1));
  }, [scanning, reduced, y]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={[styles.thumb, { backgroundColor: c.hairline }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Ionicons name="image-outline" size={22} color={c.muted} />}
      {scanning ? (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,13,17,0.35)' }]} />
          <Animated.View style={[styles.scanLine, line]} />
        </>
      ) : null}
    </View>
  );
}

/** "Estimating" with a gentle pulse. */
function Estimating() {
  const { c } = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(withRepeat(withSequence(withTiming(0.35, { duration: 650 }), withTiming(1, { duration: 650 })), -1));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[styles.row, style]} accessibilityLabel="Estimating calories">
      <Ionicons name="sparkles" size={13} color={c.accent} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: c.accent }}>Estimating…</Text>
    </Animated.View>
  );
}

export function EntryCard({ entry, onOpen, onCycleSource, onRetry }: {
  entry: MealEntryRow;
  onOpen: () => void;
  onCycleSource: () => void;
  onRetry: () => void;
}) {
  const { c } = useTheme();
  const photo = useEntryPhoto(entry);
  const hasPhoto = !!photo || !!entry.photo_path;
  const pending = entry.estimate_status === 'pending';
  const failed = entry.estimate_status === 'failed';
  const check = macroCheck(entry);
  const empty = entry.kcal == null;
  const items = entry.estimate_status === 'done' && !entry.edited ? entry.ai_estimate?.items ?? [] : [];
  const confidence = entry.confidence && !entry.edited ? CONFIDENCE_LABEL[entry.confidence] : null;

  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} layout={LinearTransition.springify().damping(18)}>
      <PressableScale onPress={onOpen} accessibilityRole="button"
        accessibilityLabel={`${entry.name}, ${pending ? 'estimating' : empty ? 'numbers missing' : `${n1(entry.kcal)} kilocalories`}${confidence ? `, ${confidence}` : ''}. Edit`}
        style={[styles.entry, { backgroundColor: c.sunken }]}>
        <View style={styles.top}>
          {hasPhoto ? <Thumb uri={photo} scanning={pending} /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: c.text }}>{entry.name}</Text>
            <View style={styles.tags}>
              <PressableScale haptic onPress={onCycleSource} accessibilityRole="button" accessibilityLabel={`Source: ${SOURCE_LABEL[entry.source]}. Change`}
                style={[styles.tag, { borderColor: c.hairline }]} hitSlop={8}>
                <Ionicons name={SOURCE_ICON[entry.source]} size={12} color={c.muted} />
                <Text style={[styles.tagText, { color: c.muted }]}>{SOURCE_LABEL[entry.source]}</Text>
              </PressableScale>
              {confidence ? <View style={[styles.tag, { borderColor: c.accent }]}><Ionicons name="sparkles" size={11} color={c.accent} /><Text style={[styles.tagText, { color: c.accent }]}>{confidence}</Text></View> : null}
              {entry.junk ? <View style={[styles.tag, { borderColor: c.warning }]}><Text style={[styles.tagText, { color: c.warning }]}>Junk</Text></View> : null}
              {entry.edited ? <View style={[styles.tag, { borderColor: c.hairline }]}><Text style={[styles.tagText, { color: c.muted }]}>Your numbers</Text></View> : null}
              {empty && !pending ? <View style={[styles.tag, { borderColor: c.warning }]}><Text style={[styles.tagText, { color: c.warning }]}>Add numbers</Text></View> : null}
              {check?.discrepancy ? (
                <View style={[styles.tag, { borderColor: c.warning }]} accessibilityLabel="Macros do not match the calories">
                  <Ionicons name="alert-circle-outline" size={12} color={c.warning} />
                  <Text style={[styles.tagText, { color: c.warning }]}>Macros off by {Math.abs(check.gap).toLocaleString('en-IN')} kcal</Text>
                </View>
              ) : null}
            </View>
            {pending ? <Estimating /> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: pending ? c.muted : c.text, fontVariant: ['tabular-nums'] }}>{pending && empty ? '…' : n1(entry.kcal)}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.protein }}>{pending && empty ? '' : `${n1(entry.protein_g)} g P`}</Text>
          </View>
        </View>

        {items.length > 0 ? (
          <View style={styles.chips}>
            {items.map((it, i) => (
              <Animated.View key={`${it.name}-${i}`} entering={FadeIn.delay(120 + i * 70).duration(260)} style={[styles.chip, { backgroundColor: c.surface }]}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: c.text }}>{it.name}{it.qty ? ` · ${it.qty}` : ''}</Text>
                <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: c.muted, fontVariant: ['tabular-nums'] }}>{Math.round(it.kcal)}</Text>
              </Animated.View>
            ))}
          </View>
        ) : null}
        {entry.assumption && entry.estimate_status === 'done' && !entry.edited ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: c.muted }}>{entry.assumption}</Text>
        ) : null}
        {failed ? (
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: c.warning, flex: 1 }}>
              {entry.ai_estimate?.error ?? 'Could not estimate this one.'} {empty ? 'Tap to add numbers.' : ''}
            </Text>
            <PressableScale haptic onPress={onRetry} accessibilityRole="button" accessibilityLabel={`Retry estimate for ${entry.name}`} style={[styles.retry, { backgroundColor: c.surface }]}>
              <Ionicons name="refresh" size={14} color={c.accent} />
              <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: c.accent }}>Retry</Text>
            </PressableScale>
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entry: { borderRadius: radius.md, padding: space.md, gap: space.sm, minHeight: TOUCH + 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scanLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: LIME, shadowColor: LIME, shadowOpacity: 0.9, shadowRadius: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 36 },
});
