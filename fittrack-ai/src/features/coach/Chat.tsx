import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAskCoach, useCoachMessages } from '../../data/coachHooks';
import type { CoachMessageRow } from '../../data/tables';
import { Banner, Muted, StateView } from '../../ui/components';
import { PressableScale } from '../../ui/motion';
import { fonts, LIME, radius, space, TOUCH, useTheme } from '../../ui/theme';
import { RichText } from './RichText';

export const SUGGESTIONS = [
  'Am I eating enough protein?',
  'Am I in a deficit this week?',
  'What should dinner be to hit my protein?',
  'Is my rate of loss healthy?',
  'How has my weight changed in 30 days?',
  'Which food choices should I change?',
];

function Avatar() {
  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name="sparkles" size={14} color="#0B0D11" />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 300 })), -1)));
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: c.muted }, style]} />;
}

function Typing() {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeIn} style={styles.assistantRow} accessibilityLabel="Coach is typing">
      <Avatar />
      <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: c.surface, flexDirection: 'row', gap: 5, paddingVertical: 16 }]}>
        <Dot delay={0} /><Dot delay={130} /><Dot delay={260} />
      </View>
    </Animated.View>
  );
}

const time = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

function Message({ m }: { m: CoachMessageRow }) {
  const { c } = useTheme();
  if (m.role === 'user') {
    return (
      <Animated.View entering={FadeInUp.duration(260)} style={styles.userRow}>
        <View style={[styles.bubble, styles.userBubble, { backgroundColor: c.primary }]}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: c.onPrimary }}>{m.content}</Text>
        </View>
      </Animated.View>
    );
  }
  const flags = Array.isArray(m.meta?.guardrails) ? (m.meta.guardrails as string[]) : [];
  return (
    <Animated.View entering={FadeInUp.duration(320)} style={styles.assistantRow}>
      <Avatar />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: c.surface }]}>
          <RichText text={m.content} />
        </View>
        <Muted style={{ fontSize: 11, marginLeft: 4 }}>
          {time(m.created_at)}{typeof m.meta?.data_through === 'string' ? ` · from your data through ${m.meta.data_through}` : ''}{flags.length ? ' · safety note added' : ''}
        </Muted>
      </View>
    </Animated.View>
  );
}

export function Chat() {
  const { c, dark } = useTheme();
  const messages = useCoachMessages();
  const ask = useAskCoach();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const list = messages.data ?? [];

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [list.length, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setError(null);
    setSending(q);
    setDraft('');
    const res = await ask(q);
    setSending(null);
    if (!res.ok) {
      setDraft(q);
      setError(res.error === 'network' ? 'The coach needs a connection. Your question is still in the box; send it again when you are online.' : res.message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {messages.isPending ? <StateView kind="loading" title="Loading conversation" /> : null}
        {messages.isError ? <StateView kind="error" title="Could not load the conversation" action={{ label: 'Try again', onPress: () => void messages.refetch() }} /> : null}
        {!messages.isPending && list.length === 0 && !sending ? (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: space.lg, paddingTop: space.md }}>
            <View style={[styles.intro, { backgroundColor: c.surface, borderColor: dark ? c.hairline : 'transparent' }]}>
              <Avatar />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 21, color: c.text }}>Ask about your own data</Text>
                <Muted>Answers use only what you have logged: meals, weight, steps, water, workouts and sleep. Calories are estimates; weight is measured.</Muted>
              </View>
            </View>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <Animated.View key={s} entering={FadeInUp.delay(80 + i * 60).duration(300)}>
                  <PressableScale haptic onPress={() => void send(s)} accessibilityRole="button" accessibilityLabel={`Ask: ${s}`}
                    style={[styles.suggestion, { backgroundColor: c.surface, borderColor: c.hairline }]}>
                    <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: c.text }}>{s}</Text>
                    <Ionicons name="arrow-forward" size={15} color={c.accent} />
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : null}
        {list.map((m) => <Message key={m.id} m={m} />)}
        {sending ? (
          <>
            <Message m={{ id: 'sending', user_id: '', role: 'user', content: sending, meta: {}, created_at: '', updated_at: '' }} />
            <Typing />
          </>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
        {error ? <Banner tone="warning">{error}</Banner> : null}
        <View style={[styles.composer, { backgroundColor: c.surface, borderColor: dark ? c.hairline : 'transparent' }]}>
          <TextInput testID="coach-input" value={draft} onChangeText={setDraft} placeholder="Ask your coach…" placeholderTextColor={c.muted}
            multiline maxLength={2000} accessibilityLabel="Question for the coach" style={[styles.input, { color: c.text }]} />
          <PressableScale haptic disabled={!draft.trim() || !!sending} onPress={() => void send(draft)} accessibilityRole="button" accessibilityLabel="Send question"
            accessibilityState={{ disabled: !draft.trim() || !!sending }} style={[styles.send, { backgroundColor: draft.trim() ? c.primary : c.sunken }]}>
            <Ionicons name="arrow-up" size={20} color={draft.trim() ? c.onPrimary : c.muted} />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, paddingBottom: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  intro: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  suggestions: { gap: space.sm },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: TOUCH + 6 },
  userRow: { alignItems: 'flex-end', paddingLeft: 48 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingRight: 24 },
  bubble: { borderRadius: 20, paddingHorizontal: space.lg, paddingVertical: space.md },
  userBubble: { borderBottomRightRadius: 6 },
  assistantBubble: { borderTopLeftRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, padding: 6, paddingLeft: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: TOUCH, maxHeight: 120, fontFamily: fonts.body, fontSize: 15, paddingTop: 12, paddingBottom: 12, outlineStyle: 'none' } as object,
  send: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
