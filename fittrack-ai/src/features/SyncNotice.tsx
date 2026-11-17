import { useData } from '../data/DataProvider';
import { useSyncStatus } from '../data/sync/engine';
import { Banner } from '../ui/components';

/** Tells the user, only when it matters, that entries are saved on the phone and not yet on the server. */
export function SyncNotice() {
  const { engine } = useData();
  const { pending, failed, syncing } = useSyncStatus();
  if (failed > 0) {
    return (
      <Banner tone="warning" action={{ label: 'Retry', onPress: () => void engine?.retryFailed() }}>
        {failed} {failed === 1 ? 'change was' : 'changes were'} not accepted by the server. {failed === 1 ? 'It is' : 'They are'} still saved on this phone.
      </Banner>
    );
  }
  if (pending > 0) {
    return (
      <Banner action={syncing ? undefined : { label: 'Sync now', onPress: () => void engine?.sync() }}>
        {pending} {pending === 1 ? 'change' : 'changes'} saved on this phone, waiting to sync{syncing ? '…' : '.'}
      </Banner>
    );
  }
  return null;
}
