import * as Crypto from 'expo-crypto';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useData, useSaveRows } from '../../data/DataProvider';
import { naturalId } from '../../data/ids';
import type { RowInput } from '../../data/repo';
import type { ProfileRow, ProgrammeRow, TargetsRow } from '../../data/tables';
import { formatLocalDate, isLocalDate } from '../../domain/dates';
import { trackDefaultsForSex } from '../../domain/defaults';
import { programmeEndDate } from '../../domain/programme';
import { parseNumber } from '../../domain/validation';
import { Banner, Body, Button, Card, Eyebrow, Field, Muted, Screen, Segmented, Title, ToggleRow } from '../../ui/components';
import { Appear } from '../../ui/motion';
import { space, useTheme } from '../../ui/theme';
import { fromForm, toForm, type SetupForm } from './formModel';

type FieldSpec = { key: string; label: string; kind?: 'text' | 'number' | 'long'; suffix?: string; hint?: string };

const STEPS: { title: string; intro: string; fields: FieldSpec[]; onboardingOnly?: FieldSpec[] }[] = [
  {
    title: 'About you',
    intro: 'Used for the burn estimate. Everything here can be changed later.',
    fields: [
      { key: 'display_name', label: 'Name' },
      { key: 'age', label: 'Age', kind: 'number', suffix: 'years' },
      { key: 'height_cm', label: 'Height', kind: 'number', suffix: 'cm' },
    ],
    onboardingOnly: [
      { key: 'weight_kg', label: 'Starting weight', kind: 'number', suffix: 'kg' },
      { key: 'weight_date', label: 'Weighed on', hint: 'YYYY-MM-DD' },
    ],
  },
  {
    title: 'Your routine',
    intro: 'Context for the coach. Free text, edit anything that is not right.',
    fields: [
      { key: 'goal', label: 'Goal', kind: 'long' },
      { key: 'fat_storage', label: 'Where you store fat' },
      { key: 'job', label: 'Job' },
      { key: 'wake_time', label: 'Wake time', hint: '24-hour HH:MM' },
      { key: 'bed_time', label: 'In bed by', hint: '24-hour HH:MM' },
      { key: 'daily_activity', label: 'Daily activity', kind: 'long' },
      { key: 'training', label: 'Training', kind: 'long' },
      { key: 'strength_level', label: 'Strength level' },
      { key: 'diet', label: 'Diet', kind: 'long' },
      { key: 'food_sources', label: 'Where your food comes from' },
      { key: 'weak_spots', label: 'Weak spots' },
      { key: 'timezone', label: 'Timezone', hint: 'Day boundaries use this timezone' },
    ],
  },
  {
    title: 'Daily targets',
    intro: 'The calorie target is fixed: it is never lowered after a big meal.',
    fields: [
      { key: 'kcal_target', label: 'Calories', kind: 'number', suffix: 'kcal' },
      { key: 'kcal_min', label: 'Calorie range, low', kind: 'number', suffix: 'kcal' },
      { key: 'kcal_max', label: 'Calorie range, high', kind: 'number', suffix: 'kcal' },
      { key: 'protein_target_g', label: 'Protein', kind: 'number', suffix: 'g' },
      { key: 'protein_min_g', label: 'Protein range, low', kind: 'number', suffix: 'g' },
      { key: 'protein_max_g', label: 'Protein range, high', kind: 'number', suffix: 'g' },
      { key: 'fat_min_g', label: 'Fat, low', kind: 'number', suffix: 'g' },
      { key: 'fat_max_g', label: 'Fat, high', kind: 'number', suffix: 'g' },
      { key: 'fibre_min_g', label: 'Fibre, low', kind: 'number', suffix: 'g' },
      { key: 'fibre_max_g', label: 'Fibre, high', kind: 'number', suffix: 'g' },
      { key: 'water_l', label: 'Water', kind: 'number', suffix: 'L' },
      { key: 'steps', label: 'Steps', kind: 'number' },
      { key: 'workouts_per_week', label: 'Strength workouts', kind: 'number', suffix: 'per week' },
      { key: 'bedtime_target', label: 'Bedtime target', hint: '24-hour HH:MM' },
      { key: 'sleep_min_h', label: 'Sleep, at least', kind: 'number', suffix: 'hours' },
      { key: 'sleep_max_h', label: 'Sleep, up to', kind: 'number', suffix: 'hours' },
    ],
  },
  {
    title: 'Programme',
    intro: 'No target weight is set automatically. Progress is judged on weekly averages.',
    fields: [
      { key: 'name', label: 'Programme name' },
      { key: 'start_date', label: 'Start date', hint: 'YYYY-MM-DD' },
      { key: 'weeks', label: 'Length', kind: 'number', suffix: 'weeks' },
      { key: 'checkpoint_date', label: 'First checkpoint', hint: 'YYYY-MM-DD, or leave empty' },
      { key: 'expectation', label: 'Realistic expectation', kind: 'long' },
    ],
  },
];

export function SetupFlow({ mode, profile, targets, programme, onDone }: {
  mode: 'onboarding' | 'edit';
  profile: ProfileRow | null;
  targets: TargetsRow | null;
  programme: ProgrammeRow | null;
  onDone: () => void;
}) {
  const { userId } = useData();
  const save = useSaveRows();
  const { c } = useTheme();
  const onboarding = mode === 'onboarding';
  const [form, setForm] = useState<SetupForm>(() => toForm(profile, targets, programme));
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { values, errors } = useMemo(() => fromForm(form, onboarding), [form, onboarding]);
  const current = STEPS[step]!;
  const fields = [...current.fields, ...(onboarding ? current.onboardingOnly ?? [] : [])];
  const stepKeys = (i: number) => [
    ...STEPS[i]!.fields, ...(onboarding ? STEPS[i]!.onboardingOnly ?? [] : []),
  ].map((f) => f.key).concat(i === 0 ? ['sex'] : []);
  const stepHasErrors = (i: number) => stepKeys(i).some((k) => errors[k]);
  const last = step === STEPS.length - 1;
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const endDate = isLocalDate(form.start_date ?? '') && Number.isInteger(parseNumber(form.weeks ?? ''))
    && parseNumber(form.weeks ?? '') >= 1 && parseNumber(form.weeks ?? '') <= 52
    ? programmeEndDate({ startDate: form.start_date!, weeks: parseNumber(form.weeks!) }) : null;

  async function finish() {
    const firstBad = STEPS.findIndex((_, i) => stepHasErrors(i));
    if (firstBad !== -1) {
      setStep(firstBad);
      setShowErrors(true);
      return;
    }
    if (!userId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const rows: RowInput[] = [
        {
          table: 'profiles',
          data: {
            ...profile, user_id: userId, ...values.profile,
            // The default track and presenter follow sex only at onboarding; afterwards they are the user's choice.
            ...(onboarding ? trackDefaultsForSex(values.profile.sex) : {}),
            onboarded_at: profile?.onboarded_at ?? new Date().toISOString(),
          },
        },
        { table: 'targets', data: { ...targets, user_id: userId, ...values.targets } },
        {
          table: 'programmes',
          data: { ...programme, id: programme?.id ?? Crypto.randomUUID(), user_id: userId, ...values.programme, is_active: true },
        },
      ];
      if (values.startingWeight) {
        rows.push({
          table: 'weight_logs',
          data: {
            id: naturalId(userId, 'weight_logs', values.startingWeight.date), user_id: userId,
            date: values.startingWeight.date, weight_kg: values.startingWeight.weight_kg, deleted_at: null,
          },
        });
      }
      await save(rows);
      onDone();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (stepHasErrors(step)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (last) void finish();
    else setStep(step + 1);
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}
        accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
        {STEPS.map((st, i) => (
          <View key={st.title} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.accent : c.hairline }} />
        ))}
      </View>
      <Appear key={`head-${step}`} style={{ gap: space.xs }}>
        <Eyebrow>{onboarding ? `Step ${step + 1} of ${STEPS.length}` : `Edit · ${step + 1} of ${STEPS.length}`}</Eyebrow>
        <Title>{current.title}</Title>
        <Body color={c.muted}>{current.intro}</Body>
      </Appear>

      <Appear key={`card-${step}`} index={1}>
      <Card>
        {step === 0 ? (
          <Segmented label="Sex (used only for the burn formula and the default workout track)" value={form.sex === 'female' ? 'female' : 'male'}
            options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} onChange={(v) => set('sex', v)} />
        ) : null}
        {fields.map((f) => (
          <Field key={f.key} testID={`field-${f.key}`} label={f.label} value={form[f.key] ?? ''} onChangeText={(t) => set(f.key, t)}
            suffix={f.suffix} hint={f.hint} multiline={f.kind === 'long'}
            keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
            autoCapitalize={f.kind === 'number' || f.hint ? 'none' : 'sentences'}
            error={showErrors ? errors[f.key] : undefined} />
        ))}
        {step === 2 ? (
          <ToggleRow label="Add exercise calories back" hint="Off by default. When off, exercise never raises your calorie target."
            value={form.add_exercise_calories === 'true'} onChange={(v) => set('add_exercise_calories', v ? 'true' : 'false')} />
        ) : null}
        {step === 3 && endDate ? (
          <Muted>Runs {formatLocalDate(form.start_date!)} to {formatLocalDate(endDate)}. Programme weeks are 7-day blocks counted from the start date.</Muted>
        ) : null}
      </Card>
      </Appear>

      {showErrors && stepHasErrors(step) ? <Banner tone="warning">Fix the highlighted fields to continue.</Banner> : null}
      {saveError ? <Banner tone="warning">{saveError}</Banner> : null}

      <View style={{ gap: space.sm }}>
        <Button label={last ? (onboarding ? 'Finish setup' : 'Save changes') : 'Next'} onPress={next} loading={saving} icon={last ? 'checkmark' : 'arrow-forward'} />
        {step > 0 ? <Button label="Back" variant="secondary" onPress={() => { setShowErrors(false); setStep(step - 1); }} disabled={saving} /> : null}
        {!onboarding ? <Button label="Cancel" variant="quiet" onPress={onDone} disabled={saving} /> : null}
      </View>
    </Screen>
  );
}
