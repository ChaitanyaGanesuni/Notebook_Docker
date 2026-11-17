import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../auth/supabase';
import { useData } from './DataProvider';

export type ShareCategory = 'meals' | 'weight' | 'measurements' | 'photos' | 'coach';
export const SHARE_CATEGORIES: { key: ShareCategory; label: string }[] = [
  { key: 'meals', label: 'Meals' }, { key: 'weight', label: 'Weight' }, { key: 'measurements', label: 'Measurements' },
  { key: 'photos', label: 'Progress photos' }, { key: 'coach', label: 'Coach chats and reports' },
];

export interface PartnerLink {
  id: string; requester_id: string; addressee_id: string | null; invite_code: string; invite_expires_at: string;
  status: 'pending' | 'accepted' | 'revoked'; requester_shares: ShareCategory[]; addressee_shares: ShareCategory[];
  requester_name: string | null; addressee_name: string | null;
}

export interface PartnerState {
  /** An accepted link, from the user's point of view. */
  linked: null | { linkId: string; partnerId: string; partnerName: string; myShares: ShareCategory[]; theirShares: ShareCategory[] };
  /** The user's own open invite, if any. */
  invite: null | { linkId: string; code: string; expiresAt: string };
  /** True when this came from the copy saved on the phone (offline). */
  cached: boolean;
}

const EMPTY: PartnerState = { linked: null, invite: null, cached: false };

export function describeLinks(links: PartnerLink[], me: string): Omit<PartnerState, 'cached'> {
  const accepted = links.find((l) => l.status === 'accepted');
  const pending = links.find((l) => l.status === 'pending' && l.requester_id === me);
  return {
    linked: accepted ? {
      linkId: accepted.id,
      partnerId: (accepted.requester_id === me ? accepted.addressee_id : accepted.requester_id)!,
      partnerName: (accepted.requester_id === me ? accepted.addressee_name : accepted.requester_name) ?? 'Partner',
      myShares: accepted.requester_id === me ? accepted.requester_shares : accepted.addressee_shares,
      theirShares: accepted.requester_id === me ? accepted.addressee_shares : accepted.requester_shares,
    } : null,
    invite: pending ? { linkId: pending.id, code: pending.invite_code, expiresAt: pending.invite_expires_at } : null,
  };
}

const metaKey = (uid: string) => `partner:${uid}`;

/** Partner linking lives on the server (it involves two accounts). The last known state is kept on the phone for offline workouts. */
export function usePartner() {
  const { store, userId } = useData();
  return useQuery({
    queryKey: ['partner', userId],
    enabled: !!store && !!userId,
    networkMode: 'always',
    queryFn: async (): Promise<PartnerState> => {
      const cached = async (): Promise<PartnerState> => {
        const raw = await store!.getMeta(metaKey(userId!));
        return raw ? { ...(JSON.parse(raw) as Omit<PartnerState, 'cached'>), cached: true } : EMPTY;
      };
      if (!supabase) return cached();
      try {
        const { data, error } = await supabase.from('partner_links').select('*').in('status', ['pending', 'accepted']).order('created_at', { ascending: false });
        if (error) return cached();
        const state = describeLinks((data ?? []) as PartnerLink[], userId!);
        await store!.setMeta(metaKey(userId!), JSON.stringify(state));
        return { ...state, cached: false };
      } catch {
        return cached();
      }
    },
  });
}

type RpcResult = { ok: true } | { ok: false; message: string };

export function usePartnerActions() {
  const { userId } = useData();
  const queryClient = useQueryClient();
  const call = useCallback(async (fn: string, args?: Record<string, unknown>): Promise<RpcResult> => {
    if (!supabase) return { ok: false, message: 'The app is not connected to a backend.' };
    try {
      const { error } = await supabase.rpc(fn, args);
      if (error) return { ok: false, message: /fetch|network/i.test(error.message) ? 'Partner linking needs a connection.' : error.message };
      await queryClient.invalidateQueries({ queryKey: ['partner', userId] });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error && /fetch|network/i.test(e.message) ? 'Partner linking needs a connection.' : String(e) };
    }
  }, [queryClient, userId]);
  return {
    createInvite: () => call('create_partner_invite'),
    accept: (code: string) => call('accept_partner_invite', { code }),
    setSharing: (linkId: string, categories: ShareCategory[]) => call('set_partner_sharing', { link_id: linkId, categories }),
    unlink: (linkId: string) => call('unlink_partner', { link_id: linkId }),
  };
}
