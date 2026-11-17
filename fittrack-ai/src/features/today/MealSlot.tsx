import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { pickPhoto } from '../../ai/photos';
import { EntryCard } from './EntryCard';
import type { MealDraft } from '../../data/dayHooks';
import type { MealEntryRow, SavedMealRow } from '../../data/tables';
import { FOODS, searchFoods } from '../../domain/foods';
import { proteinTick, SLOT_LABEL, SOURCE_LABEL, totals, type QuickAdd, type Slot, type Source } from '../../domain/meals';
import { Banner, Card, IconChip, Muted, type IconName } from '../../ui/components';
import { PressableScale } from '../../ui/motion';
import { fonts, radius, space, TOUCH, useTheme } from '../../ui/theme';

const SLOT_ICON: Record<Slot, IconName> = { breakfast: 'sunny-outline', lunch: 'restaurant-outline', dinner: 'moon-outline', snacks: 'cafe-outline' };
const SOURCE_ICON: Record<Source, IconName> = { home: 'home-outline', canteen: 'business-outline', ordered: 'bicycle-outline' };
const n1 = (v: number | null | undefined) => (v == null ? '–' : (Math.round(Number(v) * 10) / 10).toLocaleString('en-IN'));

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
export function MealSlot({ slot, entries, yesterday, saved, source, quickAdds, onCycleSource, onAdd, onCopyYesterday, onOpen, onManual, onCycleEntrySource, onEstimate, onRetry }: {
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
  /** Saves the meal now and estimates it with AI as soon as there is a connection. */
  onEstimate: (text: string, photoUri: string | null) => void;
  onRetry: (entry: MealEntryRow) => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  async function choose(source: 'camera' | 'library') {
    setChoosing(false);
    setPickError(null);
    const r = await pickPhoto(source);
    if (r.ok) setPhoto(r.uri);
    else if (r.reason === 'denied') setPickError(source === 'camera' ? 'Camera access is off. Allow it in Settings, or choose from your library.' : 'Photo access is off. Allow it in Settings.');
    else if (r.reason === 'error') setPickError(`Could not open the photo: ${r.message ?? 'unknown error'}`);
  }
  const submit = () => {
    const text = query.trim();
    if (photo || text) onEstimate(text, photo);
    else onManual('');
    setQuery('');
    setPhoto(null);
  };
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

      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onOpen={() => onOpen(e)} onCycleSource={() => onCycleEntrySource(e)} onRetry={() => onRetry(e)} />
      ))}

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

      {photo ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.attached, { backgroundColor: c.sunken }]}>
          <Image source={{ uri: photo }} style={styles.attachedImage} accessibilityLabel="Attached meal photo" />
          <Muted style={{ flex: 1 }}>Photo attached. Add a note such as “2 rotis” if you like, then tap the arrow.</Muted>
          <PressableScale onPress={() => setPhoto(null)} accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.iconButton}>
            <Ionicons name="close" size={20} color={c.muted} />
          </PressableScale>
        </Animated.View>
      ) : null}
      {choosing ? (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.pills}>
          <Pill icon="camera-outline" label="Take photo" onPress={() => void choose('camera')} />
          <Pill icon="images-outline" label="Choose from library" onPress={() => void choose('library')} />
        </Animated.View>
      ) : null}
      {pickError ? <Banner tone="warning">{pickError}</Banner> : null}

      <View style={[styles.composer, { backgroundColor: c.sunken }]}>
        <PressableScale haptic onPress={onCycleSource} accessibilityRole="button" accessibilityLabel={`New entries are tagged ${SOURCE_LABEL[source]}. Change`}
          style={[styles.sourceButton, { backgroundColor: c.surface }]}>
          <Ionicons name={SOURCE_ICON[source]} size={15} color={c.accent} />
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: c.text }}>{SOURCE_LABEL[source]}</Text>
        </PressableScale>
        <PressableScale haptic onPress={() => setChoosing((v) => !v)} accessibilityRole="button" accessibilityLabel={`Add a photo to ${SLOT_LABEL[slot]}`}
          accessibilityState={{ expanded: choosing }} style={[styles.iconButton, { backgroundColor: choosing ? c.surface : 'transparent' }]}>
          <Ionicons name="camera" size={21} color={c.accent} />
        </PressableScale>
        <TextInput testID={`composer-${slot}`} value={query} onChangeText={setQuery} placeholder={photo ? 'Add a note…' : 'Add a meal…'} placeholderTextColor={c.muted}
          accessibilityLabel={`Describe a meal for ${SLOT_LABEL[slot]}`} autoCorrect={false} returnKeyType="send"
          onSubmitEditing={submit} style={[styles.input, { color: c.text }]} />
        <PressableScale haptic accessibilityRole="button"
          accessibilityLabel={photo || query.trim() ? `Estimate ${query.trim() || 'photo'} with AI` : `Add to ${SLOT_LABEL[slot]} manually`}
          onPress={submit} style={[styles.addButton, { backgroundColor: c.primary }]}>
          <Ionicons name={photo || query.trim() ? 'sparkles' : 'add'} size={photo || query.trim() ? 19 : 22} color={c.onPrimary} />
        </PressableScale>
      </View>

      {query.trim().length >= 2 ? (
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
          <PressableScale haptic onPress={() => { onManual(query.trim()); setQuery(''); }} accessibilityRole="button"
            accessibilityLabel={`Enter your own numbers for ${query.trim()}`} style={[styles.suggestion, { borderColor: c.hairline, borderStyle: 'dashed' }]}>
            <Ionicons name="create-outline" size={18} color={c.muted} />
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: c.text }}>Enter your own numbers</Text>
          </PressableScale>
          <Muted>Typical servings, estimates only. Or tap the sparkle to let AI estimate it.</Muted>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: TOUCH, alignSelf: 'flex-start' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.pill, padding: 5, overflow: 'hidden' },
  sourceButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: TOUCH },
  input: { flex: 1, minWidth: 0, minHeight: TOUCH, fontFamily: fonts.bodyMedium, fontSize: 15, paddingHorizontal: space.xs, outlineStyle: 'none' } as object,
  iconButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  attached: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.sm },
  attachedImage: { width: 56, height: 56, borderRadius: 12 },
  addButton: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: TOUCH + 8 },
});
