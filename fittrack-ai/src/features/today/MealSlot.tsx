import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import type { MealDraft } from '../../data/dayHooks';
import type { MealEntryRow, SavedMealRow } from '../../data/tables';
import { FOODS, searchFoods } from '../../domain/foods';
import {
  macroCheck, proteinTick, SLOT_LABEL, SOURCE_LABEL, totals, type QuickAdd, type Slot, type Source,
} from '../../domain/meals';
import { Card, IconChip, Muted, type IconName } from '../../ui/components';
import { PressableScale } from '../../ui/motion';
import { fonts, radius, space, TOUCH, useTheme } from '../../ui/theme';

const SLOT_ICON: Record<Slot, IconName> = { breakfast: 'sunny-outline', lunch: 'restaurant-outline', dinner: 'moon-outline', snacks: 'cafe-outline' };
const SOURCE_ICON: Record<Source, IconName> = { home: 'home-outline', canteen: 'business-outline', ordered: 'bicycle-outline' };
const n1 = (v: number | null) => (v == null ? '–' : (Math.round(Number(v) * 10) / 10).toLocaleString('en-IN'));

interface Suggestion { key: string; title: string; detail: string; draft: MealDraft; saved: boolean }

function Pill({ icon, label, onPress, tint, hint }: { icon: IconName; label: string; onPress: () => void; tint?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <PressableScale haptic onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      style={[styles.pill, { backgroundColor: c.sunken }]}>
      <Ionicons name={icon} size={15} color={tint ?? c.accent} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.text }}>{label}</Text>
    </PressableScale>
  );
}

/** One meal slot: its entries, running totals, and a composer that adds a meal in one or two taps. */
export function MealSlot({ slot, entries, yesterday, saved, source, quickAdds, onCycleSource, onAdd, onCopyYesterday, onOpen, onManual, onCycleEntrySource }: {
  slot: Slot;
  entries: MealEntryRow[];
  yesterday: MealEntryRow[];
  saved: SavedMealRow[];
  source: Source;
  quickAdds: QuickAdd[];
  onCycleSource: () => void;
  onAdd: (draft: MealDraft) => void;
  onCopyYesterday: () => void;
  onOpen: (entry: MealEntryRow) => void;
  onManual: (name: string) => void;
  onCycleEntrySource: (entry: MealEntryRow) => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const t = totals(entries);
  const tick = proteinTick(slot, entries);

  const suggestions: Suggestion[] = [
    ...searchFoods(saved, query, 3).map((m) => ({
      key: `saved-${m.id}`, title: m.name, detail: `Favourite · ${n1(m.kcal)} kcal · ${n1(m.protein_g)} g protein`, saved: true,
      draft: { name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fibre_g: m.fibre_g, junk: m.junk },
    })),
    ...searchFoods(FOODS, query, 5).map((f) => ({
      key: `food-${f.name}-${f.serving}`, title: f.name, detail: `${f.serving} · ${f.kcal} kcal · ${f.protein_g} g protein`, saved: false,
      draft: { name: `${f.name}, ${f.serving}`, kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fibre_g: f.fibre_g, junk: !!f.junk },
    })),
  ];
  const add = (draft: MealDraft) => { onAdd(draft); setQuery(''); };
  const favourites = saved.filter((m) => m.slot === slot || m.slot === null).slice(0, 3);

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.head}>
        <IconChip icon={SLOT_ICON[slot]} tint={c.accent} soft={c.accentSoft} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: 22, color: c.text }}>{SLOT_LABEL[slot]}</Text>
            {tick ? <Ionicons name="checkmark-circle" size={18} color={c.protein} accessibilityLabel="20 grams of protein or more" /> : null}
          </View>
          {entries.length > 0 ? <Muted>{Math.round(t.protein_g)} g protein{slot !== 'snacks' && !tick ? ' · aim for 20 g' : ''}</Muted> : <Muted>Nothing logged</Muted>}
        </View>
        {entries.length > 0 ? (
          <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${Math.round(t.kcal)} kilocalories`}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 28, color: c.text, fontVariant: ['tabular-nums'] }}>{Math.round(t.kcal).toLocaleString('en-IN')}</Text>
            <Muted>kcal</Muted>
          </View>
        ) : null}
      </View>

      {entries.map((e) => {
        const check = macroCheck(e);
        const empty = e.kcal == null;
        return (
          <Animated.View key={e.id} entering={FadeInDown.springify().damping(16)} layout={LinearTransition.springify().damping(18)}>
            <PressableScale onPress={() => onOpen(e)} accessibilityRole="button" accessibilityLabel={`${e.name}, ${empty ? 'numbers missing' : `${n1(e.kcal)} kilocalories`}. Edit`}
              style={[styles.entry, { backgroundColor: c.sunken }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: c.text }}>{e.name}</Text>
                <View style={styles.tags}>
                  <PressableScale haptic onPress={() => onCycleEntrySource(e)} accessibilityRole="button" accessibilityLabel={`Source: ${SOURCE_LABEL[e.source]}. Change`}
                    style={[styles.tag, { borderColor: c.hairline }]} hitSlop={8}>
                    <Ionicons name={SOURCE_ICON[e.source]} size={12} color={c.muted} />
                    <Text style={[styles.tagText, { color: c.muted }]}>{SOURCE_LABEL[e.source]}</Text>
                  </PressableScale>
                  {e.junk ? <View style={[styles.tag, { borderColor: c.warning }]}><Text style={[styles.tagText, { color: c.warning }]}>Junk</Text></View> : null}
                  {e.edited ? <View style={[styles.tag, { borderColor: c.hairline }]}><Text style={[styles.tagText, { color: c.muted }]}>Your numbers</Text></View> : null}
                  {empty ? <View style={[styles.tag, { borderColor: c.warning }]}><Text style={[styles.tagText, { color: c.warning }]}>Add numbers</Text></View> : null}
                  {check?.discrepancy ? (
                    <View style={[styles.tag, { borderColor: c.warning }]} accessibilityLabel="Macros do not match the calories">
                      <Ionicons name="alert-circle-outline" size={12} color={c.warning} />
                      <Text style={[styles.tagText, { color: c.warning }]}>Macros off by {Math.abs(check.gap).toLocaleString('en-IN')} kcal</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: c.text, fontVariant: ['tabular-nums'] }}>{n1(e.kcal)}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.protein }}>{n1(e.protein_g)} g P</Text>
              </View>
            </PressableScale>
          </Animated.View>
        );
      })}

      {entries.length === 0 && yesterday.length > 0 ? (
        <Pill icon="copy-outline" label={`Same as yesterday · ${Math.round(totals(yesterday).kcal)} kcal`} onPress={onCopyYesterday}
          hint={`Copies ${yesterday.map((y) => y.name).join(', ')}`} />
      ) : null}

      {query.trim().length < 2 && (quickAdds.length > 0 || favourites.length > 0) ? (
        <View style={styles.pills}>
          {quickAdds.map((q) => <Pill key={q.name} icon="flash-outline" label={`${q.name} · ${q.kcal}`} onPress={() => add(q)} />)}
          {favourites.map((m) => (
            <Pill key={m.id} icon="star" tint={c.protein} label={`${m.name} · ${n1(m.kcal)}`}
              onPress={() => add({ name: m.name, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, fibre_g: m.fibre_g, junk: m.junk })} />
          ))}
        </View>
      ) : null}

      <View style={[styles.composer, { backgroundColor: c.sunken }]}>
        <PressableScale haptic onPress={onCycleSource} accessibilityRole="button" accessibilityLabel={`New entries are tagged ${SOURCE_LABEL[source]}. Change`}
          style={[styles.sourceButton, { backgroundColor: c.surface }]}>
          <Ionicons name={SOURCE_ICON[source]} size={15} color={c.accent} />
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: c.text }}>{SOURCE_LABEL[source]}</Text>
        </PressableScale>
        <TextInput testID={`composer-${slot}`} value={query} onChangeText={setQuery} placeholder="Type a food…" placeholderTextColor={c.muted}
          accessibilityLabel={`Add to ${SLOT_LABEL[slot]}`} autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => { if (query.trim()) { onManual(query.trim()); setQuery(''); } }}
          style={[styles.input, { color: c.text }]} />
        <PressableScale haptic accessibilityRole="button" accessibilityLabel={query.trim() ? `Add ${query.trim()} with your own numbers` : `Add to ${SLOT_LABEL[slot]} manually`}
          onPress={() => { onManual(query.trim()); setQuery(''); }} style={[styles.addButton, { backgroundColor: c.primary }]}>
          <Ionicons name="add" size={22} color={c.onPrimary} />
        </PressableScale>
      </View>

      {suggestions.length > 0 ? (
        <View style={{ gap: 6 }}>
          {suggestions.map((s, i) => (
            <Animated.View key={s.key} entering={FadeInDown.delay(i * 35).duration(220)}>
              <PressableScale haptic onPress={() => add(s.draft)} accessibilityRole="button" accessibilityLabel={`Add ${s.title}, ${s.detail}`}
                style={[styles.suggestion, { borderColor: c.hairline }]}>
                <Ionicons name={s.saved ? 'star' : 'add-circle-outline'} size={18} color={s.saved ? c.protein : c.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: c.text }}>{s.title}</Text>
                  <Muted>{s.detail}</Muted>
                </View>
              </PressableScale>
            </Animated.View>
          ))}
          <Muted>Typical servings, estimates only. Tap an entry afterwards to correct it.</Muted>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.md, minHeight: TOUCH + 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: TOUCH, alignSelf: 'flex-start' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.pill, padding: 5, overflow: 'hidden' },
  sourceButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: TOUCH },
  input: { flex: 1, minWidth: 0, minHeight: TOUCH, fontFamily: fonts.bodyMedium, fontSize: 15, paddingHorizontal: space.xs, outlineStyle: 'none' } as object,
  addButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: TOUCH + 8 },
});
