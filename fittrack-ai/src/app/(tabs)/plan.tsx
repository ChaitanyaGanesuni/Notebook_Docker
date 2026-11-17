import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useActiveProgramme, useProfile, useSaveRows, useTargets } from '../../data/DataProvider';
import { useSyncStatus } from '../../data/sync/engine';
import { SyncNotice } from '../../features/SyncNotice';
import { formatLocalDate } from '../../domain/dates';
import { programmeEndDate } from '../../domain/programme';
import { Bullet, Button, Card, Eyebrow, Muted, Row, Screen, SectionHeader, Segmented, StateView, Title } from '../../ui/components';
import { Appear } from '../../ui/motion';
import { useTheme } from '../../ui/theme';

const FOOD_RULES = [
  'Protein at every meal. Poha alone is mostly carbs.',
  'Fried food, pizza and burgers fit one planned weekend meal.',
  'Biryani once a week.',
  'No chai on an empty stomach.',
  'Finish dinner 2 to 3 hours before bed.',
];
const SWAPS = [
  'Breakfast: poha with 2 to 3 eggs or whey.',
  'Lunch out: tandoori or grilled chicken, 2 roti, dal or salad.',
  'Dinner: paneer bhurji or chicken, 2 roti, large salad, done by 9 pm.',
];
const RECOVERY = [
  'Phone down by 11. No caffeine after 4 pm.',
  'Do not skip breakfast.',
  'If acidity continues past two weeks, see a doctor.',
];

const n = (v: number) => Number(v).toLocaleString('en-IN');

export default function Plan() {
  const { email, signOut } = useAuth();
  const profile = useProfile();
  const targets = useTargets();
  const programme = useActiveProgramme();
  const pending = useSyncStatus((s) => s.pending + s.failed);
  const save = useSaveRows();
  const { c } = useTheme();

  function confirmSignOut() {
    const message = pending > 0
      ? `${pending} ${pending === 1 ? 'change has' : 'changes have'} not synced yet. They stay on this phone and will sync when you sign back in on it.`
      : 'You can sign back in at any time.';
    if (Platform.OS === 'web') {
      void signOut();
      return;
    }
    Alert.alert('Sign out?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  if (targets.isPending || profile.isPending || programme.isPending) {
    return <Screen scroll={false}><StateView kind="loading" title="Loading your plan" /></Screen>;
  }
  const t = targets.data;
  const p = programme.data;
  const me = profile.data;

  return (
    <Screen>
      <Appear><Eyebrow>Targets, rules and settings</Eyebrow><Title>Plan</Title></Appear>
      <SyncNotice />

      <Card>
        <SectionHeader icon="flag-outline" title="Daily targets" />
        {t ? (
          <>
            <Row label="Calories" value={`${n(t.kcal_target)} kcal (${n(t.kcal_min)} to ${n(t.kcal_max)})`} />
            <Row label="Protein" value={`${t.protein_target_g} g (${t.protein_min_g} to ${t.protein_max_g})`} />
            <Row label="Fat" value={`${t.fat_min_g} to ${t.fat_max_g} g`} />
            <Row label="Fibre" value={`${t.fibre_min_g} to ${t.fibre_max_g} g`} />
            <Row label="Carbohydrates" value="Flexible, no target" />
            <Row label="Water" value={`${t.water_ml / 1000} L`} />
            <Row label="Steps" value={n(t.steps)} />
            <Row label="Strength workouts" value={`${t.workouts_per_week} per week`} />
            <Row label="Sleep" value={`In bed by ${String(t.bedtime_target).slice(0, 5)}, ${Number(t.sleep_min_h)} to ${Number(t.sleep_max_h)} h`} />
            <Muted>The calorie target is fixed. Exercise calories are {t.add_exercise_calories ? 'added back (you turned this on)' : 'not added back'}.</Muted>
          </>
        ) : <Muted>No targets saved yet.</Muted>}
      </Card>

      <Card>
        <SectionHeader icon="calendar-outline" title="Programme" />
        {p ? (
          <>
            <Row label="Runs" value={`${formatLocalDate(p.start_date)} to ${formatLocalDate(programmeEndDate({ startDate: p.start_date, weeks: p.weeks }))}`} />
            <Row label="Length" value={`${p.weeks} weeks`} />
            {p.checkpoint_date ? <Row label="First checkpoint" value={formatLocalDate(p.checkpoint_date)} /> : null}
            {p.expectation ? <Muted>Realistic expectation: {p.expectation}.</Muted> : null}
          </>
        ) : <Muted>No programme set.</Muted>}
      </Card>

      <Card><SectionHeader icon="restaurant-outline" title="Food rules" tint={c.protein} soft={c.proteinSoft} />{FOOD_RULES.map((r) => <Bullet key={r} tint={c.protein}>{r}</Bullet>)}</Card>
      <Card><SectionHeader icon="swap-horizontal" title="Swaps" />{SWAPS.map((r) => <Bullet key={r} icon="arrow-forward">{r}</Bullet>)}</Card>
      <Card><SectionHeader icon="moon-outline" title="Recovery and digestion" tint={c.water} soft={c.waterSoft} />{RECOVERY.map((r) => <Bullet key={r} tint={c.water}>{r}</Bullet>)}</Card>

      <Card>
        <SectionHeader icon="person-outline" title="Profile" />
        {me ? (
          <>
            <Row label="Name" value={me.display_name} />
            <Row label="Age" value={`${me.age}`} />
            <Row label="Height" value={`${Number(me.height_cm)} cm`} />
            <Row label="Timezone" value={me.timezone} />
            <Row label="Account" value={email ?? ''} last />
          </>
        ) : <Muted>No profile saved yet.</Muted>}
        <Segmented label="Exercise demos show" value={me?.demo_presenter ?? 'male'}
          onChange={(v) => { if (me) void save([{ table: 'profiles', data: { ...me, demo_presenter: v } }]); }}
          options={[{ value: 'female', label: 'Female presenter' }, { value: 'male', label: 'Male presenter' }]} />
        <Muted>Separate from your profile. Couples moves always show a pair.</Muted>
        <Button label="Edit profile, targets and programme" variant="secondary" icon="create-outline" onPress={() => router.push('/settings/profile')} />
      </Card>

      <Button label="Sign out" variant="quiet" onPress={confirmSignOut} />
    </Screen>
  );
}
