import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { DayLogRow, MeasurementRow } from '../../data/tables';
import { weekdayIndex } from '../../domain/dates';
import type { ChaiSugar } from '../../domain/meals';
import { parseNumber } from '../../domain/validation';
import { Banner, Card, Muted, SectionHeader, Segmented, type IconName } from '../../ui/components';
import { CountUp, PressableScale } from '../../ui/motion';
import { fonts, radius, space, TOUCH, useTheme } from '../../ui/theme';
import { WaterTank } from '../../ui/WaterTank';

/** A number field that saves when you leave it. Invalid input is flagged and never saved. */
function NumberEntry({ label, value, suffix, min, max, decimals = 0, onCommit, testID, placeholder }: {
  label: string; value: number | null; suffix: string; min: number; max: number; decimals?: number;
  onCommit: (n: number) => void; testID?: string; placeholder?: string;
}) {
  const { c } = useTheme();
  const format = (v: number | null) => (v == null ? '' : decimals > 0 ? Number(v).toFixed(decimals) : String(Math.round(Number(v))));
  const [text, setText] = useState(format(value));
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  // Follow the saved value when it changes elsewhere (another day selected, a sync), unless the user is typing.
  const [seen, setSeen] = useState(value);
  if (seen !== value && !focused) {
    setSeen(value);
    setText(format(value));
    setError(false);
  }

  function commit() {
    setFocused(false);
    const raw = text.trim();
    if (raw === '') { setText(format(value)); setError(false); return; }
    const n = parseNumber(raw);
    const scale = 10 ** decimals;
    const rounded = Math.round(n * scale) / scale;
    if (Number.isNaN(n) || rounded < min || rounded > max) { setError(true); return; }
    setError(false);
    setText(format(rounded));
    if (rounded !== (value == null ? null : Number(value))) onCommit(rounded);
  }

  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: c.muted }}>{label}</Text>
      <View style={[styles.numberRow, { backgroundColor: c.sunken, borderColor: error ? c.warning : focused ? c.accent : 'transparent' }]}>
        <TextInput testID={testID} value={text} onChangeText={setText} onFocus={() => setFocused(true)} onBlur={commit} onSubmitEditing={commit}
          keyboardType="decimal-pad" returnKeyType="done" placeholder={placeholder ?? '–'} placeholderTextColor={c.muted}
          accessibilityLabel={`${label}, ${suffix}`} accessibilityHint={error ? `Enter ${min} to ${max}` : undefined}
          style={[styles.numberInput, { color: c.text }]} />
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: c.muted }}>{suffix}</Text>
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 12, color: c.warning }}>Enter {min.toLocaleString('en-IN')} to {max.toLocaleString('en-IN')}</Text> : null}
    </View>
  );
}

function ToggleTile({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale haptic onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={[styles.tile, { backgroundColor: on ? c.primary : c.sunken }]}>
      <Ionicons name={on ? 'checkmark-circle' : icon} size={22} color={on ? c.onPrimary : c.muted} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12.5, color: on ? c.onPrimary : c.text, textAlign: 'center' }}>{label}</Text>
    </PressableScale>
  );
}

/** Rest-of-day logging: each item is one tap or one number. */
export function DayLogging({ date, log, workoutRecorded = false, waterTarget, stepsTarget, weight, measurement, chaiSugar, bedtime, onPatch, onWeight, onWaist }: {
  date: string;
  log: DayLogRow | null;
  /** A guided or couples session was saved for this day. */
  workoutRecorded?: boolean;
  waterTarget: number;
  stepsTarget: number;
  weight: number | null;
  measurement: MeasurementRow | null;
  chaiSugar: ChaiSugar;
  bedtime: string;
  onPatch: (patch: Partial<DayLogRow>) => void;
  onWeight: (kg: number) => void;
  onWaist: (cm: number) => void;
}) {
  const { c } = useTheme();
  const water = log?.water_ml ?? 0;
  // Amounts added in this session for this day, so Undo removes exactly the last glass.
  // (The parent remounts this component per day, which clears it.)
  const [added, setAdded] = useState<number[]>([]);
  const [note, setNote] = useState(log?.note ?? '');
  const [noteSeen, setNoteSeen] = useState(log?.note ?? '');
  if ((log?.note ?? '') !== noteSeen) {
    setNoteSeen(log?.note ?? '');
    setNote(log?.note ?? '');
  }
  const sunday = weekdayIndex(date) === 6;

  const addWater = (ml: number) => { setAdded((a) => [...a, ml]); onPatch({ water_ml: Math.min(20000, water + ml) }); };
  const undoWater = () => {
    const last = added[added.length - 1];
    if (last === undefined) return;
    setAdded((a) => a.slice(0, -1));
    onPatch({ water_ml: Math.max(0, water - last) });
  };

  return (
    <>
      <Card>
        <SectionHeader icon="water-outline" title="Water" tint={c.water} soft={c.waterSoft} />
        <View style={styles.waterRow}>
          <WaterTank fraction={water / waterTarget} color={c.water} track={c.sunken} />
          <View style={{ flex: 1, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }} accessible accessibilityLabel={`${(water / 1000).toFixed(2)} of ${waterTarget / 1000} litres`}>
              <CountUp value={water / 1000} format={(n) => n.toFixed(2)} duration={500}
                style={{ fontFamily: fonts.headingBold, fontSize: 44, lineHeight: 46, color: c.text, fontVariant: ['tabular-nums'] }} />
              <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: c.muted }}>/ {waterTarget / 1000} L</Text>
            </View>
            <View style={styles.waterButtons}>
              {[200, 250, 500].map((ml) => (
                <PressableScale key={ml} haptic onPress={() => addWater(ml)} accessibilityRole="button" accessibilityLabel={`Add ${ml} millilitres`}
                  style={[styles.waterButton, { backgroundColor: c.waterSoft }]}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: c.water }}>+{ml}</Text>
                </PressableScale>
              ))}
              <PressableScale onPress={undoWater} disabled={added.length === 0} accessibilityRole="button" accessibilityLabel="Undo last water"
                accessibilityState={{ disabled: added.length === 0 }}
                style={[styles.waterButton, { backgroundColor: c.sunken, opacity: added.length === 0 ? 0.4 : 1, flexGrow: 0, width: TOUCH }]}>
                <Ionicons name="arrow-undo" size={18} color={c.text} />
              </PressableScale>
            </View>
            {water >= waterTarget ? <Muted color={c.water} style={{ fontFamily: fonts.bodySemiBold }}>Target reached</Muted> : null}
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader icon="walk-outline" title="Activity and sleep" />
        <NumberEntry testID="steps" label={`Steps (target ${stepsTarget.toLocaleString('en-IN')})`} suffix="steps" value={log?.steps ?? null} min={0} max={200000}
          placeholder="Not logged: 7,000 assumed" onCommit={(n) => onPatch({ steps: n, steps_source: 'manual' })} />
        <View style={styles.tiles}>
          <ToggleTile icon="tennisball-outline" label="Badminton" on={log?.badminton ?? false} onPress={() => onPatch({ badminton: !(log?.badminton ?? false) })} />
          <ToggleTile icon="barbell-outline" label={workoutRecorded ? 'Workout recorded' : 'Workout'} on={workoutRecorded || (log?.workout_done ?? false)}
            onPress={() => { if (!workoutRecorded) onPatch({ workout_done: !(log?.workout_done ?? false) }); }} />
          <ToggleTile icon="bed-outline" label={`In bed by ${bedtime}`} on={log?.in_bed_on_time ?? false} onPress={() => onPatch({ in_bed_on_time: !(log?.in_bed_on_time ?? false) })} />
        </View>
        <Segmented label="Chai sugar today" value={chaiSugar} onChange={(v) => onPatch({ chai_sugar: v })}
          options={[{ value: 'full', label: 'Full' }, { value: 'half', label: 'Half' }, { value: 'none', label: 'None' }]} />
      </Card>

      <Card>
        <SectionHeader icon="scale-outline" title="Body" />
        {sunday && measurement?.waist_cm == null ? <Banner>Sunday check: measure your waist at the navel this morning.</Banner> : null}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <NumberEntry testID="weight" label="Morning weight" suffix="kg" value={weight} min={20} max={300} decimals={1} onCommit={onWeight} />
          <NumberEntry testID="waist" label="Waist at navel" suffix="cm" value={measurement?.waist_cm ?? null} min={30} max={250} decimals={1} onCommit={onWaist} />
        </View>
        <Muted>Judge weight on the 7-day average, not a single morning.</Muted>
      </Card>

      <Card>
        <SectionHeader icon="create-outline" title="Note" />
        <TextInput testID="note" value={note} onChangeText={setNote} multiline placeholder="Anything worth remembering about today" placeholderTextColor={c.muted}
          accessibilityLabel="Note for the day" maxLength={4000}
          onBlur={() => { if (note !== (log?.note ?? '')) onPatch({ note }); }}
          style={[styles.note, { backgroundColor: c.sunken, color: c.text }]} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.md },
  numberInput: { flex: 1, minHeight: 50, minWidth: 0, fontFamily: fonts.heading, fontSize: 22, fontVariant: ['tabular-nums'], outlineStyle: 'none' } as object,
  tile: { flex: 1, minHeight: 72, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  waterButtons: { flexDirection: 'row', gap: space.sm },
  waterButton: { flexGrow: 1, minHeight: TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  note: { minHeight: 80, borderRadius: radius.md, padding: space.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, textAlignVertical: 'top', outlineStyle: 'none' } as object,
});
