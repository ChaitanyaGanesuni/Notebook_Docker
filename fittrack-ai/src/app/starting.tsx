import { useAuth } from '../auth/AuthProvider';
import { useData } from '../data/DataProvider';
import { useSyncStatus } from '../data/sync/engine';
import { Button, Screen, StateView } from '../ui/components';

/** Shown while the device database opens and, on a new device, while the account's data loads. */
export default function StartingScreen() {
  const { status, signOut } = useAuth();
  const { storeError, engine } = useData();
  const initialPull = useSyncStatus((s) => s.initialPull);
  const syncing = useSyncStatus((s) => s.syncing);

  if (storeError) {
    return (
      <Screen scroll={false}>
        <StateView kind="error" title="Could not open local storage" message={storeError} />
      </Screen>
    );
  }
  if (status === 'signedIn' && initialPull === 'failed' && !syncing) {
    return (
      <Screen scroll={false}>
        <StateView kind="error" title="Could not load your account"
          message="This device has not loaded your data yet, and the server could not be reached. Connect to the internet and try again. After this first load the app works offline."
          action={{ label: 'Try again', onPress: () => void engine?.sync({ pull: true }) }} />
        <Button label="Sign out" variant="quiet" onPress={() => void signOut()} />
      </Screen>
    );
  }
  return (
    <Screen scroll={false}>
      <StateView kind="loading" title="Loading" />
    </Screen>
  );
}
