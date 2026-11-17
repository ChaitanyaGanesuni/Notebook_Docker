import { create } from 'zustand';
import type { LocalStore } from '../local/store';
import { PULL_TABLES } from '../tables';
import { pullTables } from './pull';
import { pushOutbox } from './push';
import type { Remote } from './remote';

export interface SyncStatus {
  /** Changes saved on the device and not yet on the server. */
  pending: number;
  /** Changes the server rejected; kept on the device until retried. */
  failed: number;
  syncing: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
  /** Whether this account's existing data has been loaded onto this device at least once. */
  initialPull: 'unknown' | 'done' | 'failed';
}

const idle: SyncStatus = { pending: 0, failed: 0, syncing: false, lastError: null, lastSyncedAt: null, initialPull: 'unknown' };

export const useSyncStatus = create<SyncStatus>(() => idle);

const pulledKey = (userId: string) => `initial-pull:${userId}`;

/** Runs push and pull for one signed-in user. Calls never overlap: a request made mid-run triggers one follow-up run. */
export class SyncEngine {
  private running: Promise<void> | null = null;
  private again: { pull: boolean } | null = null;

  constructor(
    private readonly store: LocalStore,
    private readonly remote: Remote,
    private readonly userId: string,
    private readonly onDataChanged: () => void,
    /** Extra work that needs the network, run after local changes are sent (meal estimates). Returns true if it changed data. */
    private readonly afterPush?: () => Promise<boolean>,
  ) {}

  async start(): Promise<void> {
    const pulled = await this.store.getMeta(pulledKey(this.userId));
    useSyncStatus.setState({ ...idle, ...(await this.store.counts(this.userId)), initialPull: pulled ? 'done' : 'unknown' });
    await this.sync({ pull: true });
  }

  async refreshCounts(): Promise<void> {
    useSyncStatus.setState(await this.store.counts(this.userId));
  }

  sync(options: { pull?: boolean } = {}): Promise<void> {
    const pull = options.pull ?? false;
    if (this.running) {
      this.again = { pull: pull || (this.again?.pull ?? false) };
      return this.running;
    }
    this.running = this.run(pull).finally(() => {
      this.running = null;
      const next = this.again;
      this.again = null;
      if (next) void this.sync(next);
    });
    return this.running;
  }

  async retryFailed(): Promise<void> {
    await this.store.retryFailed(this.userId);
    await this.sync();
  }

  private async run(pull: boolean): Promise<void> {
    useSyncStatus.setState({ syncing: true });
    let error: string | null = null;
    try {
      let pushed = await pushOutbox(this.store, this.remote, this.userId);
      error = pushed.error;
      if (!pushed.interrupted && this.afterPush) {
        if (await this.afterPush()) {
          this.onDataChanged();
          pushed = await pushOutbox(this.store, this.remote, this.userId);
          error = error ?? pushed.error;
        }
      }
      const needInitial = useSyncStatus.getState().initialPull !== 'done';
      if (!pushed.interrupted && (pull || needInitial)) {
        const pulled = await pullTables(this.store, this.remote, this.userId, PULL_TABLES);
        if (pulled.ok) {
          await this.store.setMeta(pulledKey(this.userId), new Date().toISOString());
          useSyncStatus.setState({ initialPull: 'done' });
        } else {
          error = error ?? pulled.error;
          if (needInitial) useSyncStatus.setState({ initialPull: 'failed' });
        }
        if (pulled.applied > 0) this.onDataChanged();
      } else if (pushed.interrupted && needInitial) {
        useSyncStatus.setState({ initialPull: 'failed' });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    useSyncStatus.setState({
      ...(await this.store.counts(this.userId)),
      syncing: false,
      lastError: error,
      ...(error ? {} : { lastSyncedAt: new Date().toISOString() }),
    });
  }
}
