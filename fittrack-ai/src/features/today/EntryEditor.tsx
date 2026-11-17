import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MealDraft } from '../../data/dayHooks';
import { macroCheck, SLOT_LABEL, SOURCE_LABEL, type Slot, type Source } from '../../domain/meals';
import { parseNumber } from '../../domain/validation';
import { Banner, Button, Field, Heading, Muted, Segmented, ToggleRow } from '../../ui/components';
import { radius, space, useTheme } from '../../ui/theme';

export interface EditorTarget {
  slot: Slot;
  source: Source;
  draft: MealDraft;
  /** True when editing an entry that already exists (shows Delete). */
  existing: boolean;
}

const LIMITS = { kcal: 5000, protein_g: 300, carbs_g: 1000, fat_g: 500, fibre_g: 200 } as const;
type NumKey = keyof typeof LIMITS;
const FIELDS: { key: NumKey; label: string; suffix: string }[] = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal' },
  { key: 'protein_g', label: 'Protein', suffix: 'g' },
  { key: 'carbs_g', label: 'Carbs', suffix: 'g' },
  { key: 'fat_g', label: 'Fat', suffix: 'g' },
  { key: 'fibre_g', label: 'Fibre', suffix: 'g' },
];
const show = (n: number | null) => (n == null ? '' : String(Number(n)));

/** Bottom sheet for entering or correcting a meal's numbers. Empty numbers are allowed: the meal is never lost. */
export function EntryEditor({ target, onClose, onSave, onDelete, onFavourite }: {
  target: EditorTarget;
  onClose: () => void;
  onSave: (draft: MealDraft, source: Source) => Promise<void>;
  onDelete?: () => Promise<void>;
  onFavourite: (draft: MealDraft, source: Source) => Promise<void>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(target.draft.name);
  const [text, setText] = useState<Record<NumKey, string>>({
    kcal: show(target.draft.kcal), protein_g: show(target.draft.protein_g), carbs_g: show(target.draft.carbs_g),
    fat_g: show(target.draft.fat_g), fibre_g: show(target.draft.fibre_g),
  });
  const [junk, setJunk] = useState(target.draft.junk);
  const [source, setSource] = useState<Source>(target.source);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [starred, setStarred] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { draft, errors } = useMemo(() => {
    const e: Partial<Record<NumKey | 'name', string>> = {};
    const values = {} as Record<NumKey, number | null>;
    for (const f of FIELDS) {
      const raw = text[f.key].trim();
      if (raw === '') { values[f.key] = null; continue; }
      const n = parseNumber(raw);
      if (Number.isNaN(n) || n < 0 || n > LIMITS[f.key]) e[f.key] = `0 to ${LIMITS[f.key].toLocaleString('en-IN')}`;
      values[f.key] = Number.isNaN(n) ? null : Math.round(n * 10) / 10;
    }
    if (!name.trim()) e.name = 'Give it a name';
    return { draft: { name: name.trim(), text: target.draft.text, ...values, junk } satisfies MealDraft, errors: e };
  }, [name, text, junk, target.draft.text]);
  const check = Object.keys(errors).length === 0 ? macroCheck(draft) : null;

  async function run(fn: () => Promise<void>, close: boolean) {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close editor" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: c.hairline }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }} showsVerticalScrollIndicator={false}>
            <View>
              <Muted>{SLOT_LABEL[target.slot]}</Muted>
              <Heading>{target.existing ? 'Edit entry' : 'Add entry'}</Heading>
            </View>
            <Field testID="entry-name" label="What was it?" value={name} onChangeText={setName} error={submitted ? errors.name : undefined} />
            <View style={styles.grid}>
              {FIELDS.map((f) => (
                <View key={f.key} style={f.key === 'kcal' ? styles.full : styles.half}>
                  <Field testID={`entry-${f.key}`} label={f.label} suffix={f.suffix} value={text[f.key]} keyboardType="decimal-pad" autoCapitalize="none"
                    onChangeText={(t) => setText((s) => ({ ...s, [f.key]: t }))} error={submitted ? errors[f.key] : undefined} />
                </View>
              ))}
            </View>
            {check?.discrepancy ? <Banner tone="warning">{check.note} Nothing is changed for you: correct a number if you want to.</Banner> : null}
            <Segmented label="Where it came from" value={source} onChange={setSource}
              options={(['home', 'canteen', 'ordered'] as const).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
            <ToggleRow label="Junk" hint="Deep-fried, fast food, sweets or sugary drinks" value={junk} onChange={setJunk} />
            {error ? <Banner tone="warning">{error}</Banner> : null}
            <Button label={target.existing ? 'Save changes' : 'Add to ' + SLOT_LABEL[target.slot]} icon="checkmark" loading={busy} onPress={() => void run(() => onSave(draft, source), true)} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" icon={starred ? 'star' : 'star-outline'} label={starred ? 'Saved' : 'Save as favourite'} disabled={busy || starred}
                  onPress={() => void run(async () => { await onFavourite(draft, source); setStarred(true); }, false)} />
              </View>
              {onDelete ? <View style={{ flex: 1 }}><Button variant="quiet" icon="trash-outline" label="Delete" disabled={busy} onPress={() => { setBusy(true); void onDelete().then(onClose).finally(() => setBusy(false)); }} /></View> : null}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,7,10,0.55)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: space.sm, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  grabber: { width: 44, height: 5, borderRadius: radius.pill, alignSelf: 'center', marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  full: { width: '100%' },
  half: { flexGrow: 1, flexBasis: '45%' },
});
