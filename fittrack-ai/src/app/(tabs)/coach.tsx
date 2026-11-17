import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalHistory } from '../../data/coachHooks';
import { useProfile } from '../../data/DataProvider';
import { localDateOf } from '../../domain/dates';
import { Chat } from '../../features/coach/Chat';
import { Reports } from '../../features/coach/Reports';
import { Eyebrow, Segmented, StateView, Title } from '../../ui/components';
import { Appear } from '../../ui/motion';
import { space, useTheme } from '../../ui/theme';

export default function Coach() {
  const { c } = useTheme();
  const profile = useProfile();
  const [tab, setTab] = useState<'chat' | 'reports'>('chat');
  const today = localDateOf(new Date(), profile.data?.timezone ?? undefined);
  const { history, loading } = useLocalHistory(today);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={styles.head}>
        <Appear><Eyebrow>From your own data</Eyebrow><Title>Coach</Title></Appear>
        <Segmented hideLabel label="Coach view" value={tab} onChange={setTab} options={[{ value: 'chat', label: 'Chat' }, { value: 'reports', label: 'Reports' }]} />
      </View>
      {tab === 'chat' ? <Chat /> : (
        <ScrollView contentContainerStyle={styles.reports} showsVerticalScrollIndicator={false}>
          {loading ? <StateView kind="loading" title="Working out your numbers" />
            : history ? <Reports history={history} today={today} />
            : <StateView kind="error" title="Could not load your data" message="Finish setup, or try again." />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  reports: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
