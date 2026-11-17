import { useState } from 'react';
import { Share, Switch, Text, View } from 'react-native';
import { SHARE_CATEGORIES, usePartner, usePartnerActions, type ShareCategory } from '../../data/partnerHooks';
import { Banner, Body, Button, Card, Field, Muted, SectionHeader, Segmented } from '../../ui/components';
import { fonts, radius, space, useTheme } from '../../ui/theme';

export type TrainWith = { kind: 'guest'; name: string } | { kind: 'linked' };

/** Who the couples session is with: a guest (saved to your account only) or a linked partner (saved to both). */
export function PartnerCard({ value, onChange }: { value: TrainWith; onChange: (v: TrainWith) => void }) {
  const { c } = useTheme();
  const partner = usePartner();
  const actions = usePartnerActions();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linked = partner.data?.linked ?? null;
  const invite = partner.data?.invite ?? null;

  async function run(name: string, fn: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(name);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) setError(r.message);
    return r.ok;
  }
  const toggleShare = (cat: ShareCategory, on: boolean) => {
    if (!linked) return;
    const next = on ? [...new Set([...linked.myShares, cat])] : linked.myShares.filter((x) => x !== cat);
    void run('share', () => actions.setSharing(linked.linkId, next));
  };

  return (
    <Card>
      <SectionHeader icon="people-outline" title="Training partner" />
      <Segmented hideLabel label="Train with" value={value.kind} onChange={(k) => onChange(k === 'guest' ? { kind: 'guest', name: value.kind === 'guest' ? value.name : '' } : { kind: 'linked' })}
        options={[{ value: 'guest', label: 'Guest' }, { value: 'linked', label: linked ? linked.partnerName : 'Linked partner' }]} />

      {value.kind === 'guest' ? (
        <>
          <Field label="Guest's name" value={value.name} onChangeText={(name) => onChange({ kind: 'guest', name })} placeholder="Optional" autoCapitalize="words" testID="guest-name" />
          <Muted>The session is saved to your account only. Your guest does not need the app.</Muted>
        </>
      ) : linked ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.proteinSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: c.protein }}>{linked.partnerName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: fonts.bodySemiBold }}>Linked with {linked.partnerName}</Body>
              <Muted>Couples sessions are saved to both accounts, each with your own reps and rating.</Muted>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: c.text }}>Also share my…</Text>
            <Muted>Off by default. Only you can change what {linked.partnerName} sees of yours.</Muted>
            {SHARE_CATEGORIES.map((cat) => (
              <View key={cat.key} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
                <Body style={{ flex: 1 }}>{cat.label}</Body>
                <Switch accessibilityLabel={`Share ${cat.label} with ${linked.partnerName}`} value={linked.myShares.includes(cat.key)}
                  disabled={busy !== null || partner.data?.cached} onValueChange={(on) => toggleShare(cat.key, on)} trackColor={{ true: c.accent, false: c.hairline }} thumbColor="#FFFFFF" ios_backgroundColor={c.hairline} />
              </View>
            ))}
            {linked.theirShares.length ? <Muted>{linked.partnerName} shares with you: {linked.theirShares.join(', ')}.</Muted> : null}
          </View>
          <Button variant="quiet" icon="unlink-outline" label="Unlink" loading={busy === 'unlink'} onPress={() => void run('unlink', () => actions.unlink(linked.linkId)).then((ok) => ok && onChange({ kind: 'guest', name: '' }))} />
        </>
      ) : (
        <>
          <Muted>Link accounts so a couples session counts for both of you. Linking shares couples workouts only; meals, weight, photos and coach chats stay private unless you turn sharing on.</Muted>
          {invite ? (
            <View style={{ backgroundColor: c.sunken, borderRadius: radius.md, padding: space.md, gap: 4, alignItems: 'center' }}>
              <Muted>Your invite code</Muted>
              <Text selectable accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`} style={{ fontFamily: fonts.headingBold, fontSize: 30, letterSpacing: 3, color: c.text }}>{invite.code}</Text>
              <Muted>Valid until {new Date(invite.expiresAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Muted>
              <Button variant="secondary" icon="share-outline" label="Send code" onPress={() => void Share.share({ message: `Join me on FitTrack AI: open Train, then Couples, and enter the code ${invite.code}` }).catch(() => undefined)} />
            </View>
          ) : (
            <Button variant="secondary" icon="link-outline" label="Create an invite code" loading={busy === 'invite'} onPress={() => void run('invite', actions.createInvite)} />
          )}
          <Field label="Have a code?" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="none" placeholder="10 characters" testID="partner-code" />
          <Button label="Link with this code" disabled={code.trim().length < 6} loading={busy === 'accept'} onPress={() => void run('accept', () => actions.accept(code)).then((ok) => ok && setCode(''))} />
        </>
      )}
      {partner.data?.cached ? <Muted>Offline: showing your last known partner link.</Muted> : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Card>
  );
}
