import { Body, Card, Muted, Screen, Title } from '../ui/components';

/** Shown when the build has no Supabase URL and anon key. */
export default function SetupScreen() {
  return (
    <Screen>
      <Title>Connect a backend</Title>
      <Body>This build is not connected to Supabase yet, so nobody can sign in.</Body>
      <Card>
        <Body>1. Copy .env.example to .env.local</Body>
        <Body>2. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project (Settings, then API)</Body>
        <Body>3. Restart the dev server, or rebuild the app</Body>
        <Muted>Only the public anon key goes in the app. The service-role key and the AI key never do.</Muted>
      </Card>
    </Screen>
  );
}
