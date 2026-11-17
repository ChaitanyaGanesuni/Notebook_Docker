import { router } from 'expo-router';
import { useActiveProgramme, useProfile, useTargets } from '../../data/DataProvider';
import { SetupFlow } from '../../features/setup/SetupFlow';
import { Screen, StateView } from '../../ui/components';

export default function EditProfile() {
  const profile = useProfile();
  const targets = useTargets();
  const programme = useActiveProgramme();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/plan'));

  if (profile.isPending || targets.isPending || programme.isPending) {
    return <Screen scroll={false}><StateView kind="loading" title="Loading" /></Screen>;
  }
  if (profile.isError || targets.isError || programme.isError) {
    return <Screen scroll={false}><StateView kind="error" title="Could not load your settings" action={{ label: 'Close', onPress: close }} /></Screen>;
  }
  return <SetupFlow mode="edit" profile={profile.data ?? null} targets={targets.data ?? null} programme={programme.data ?? null} onDone={close} />;
}
