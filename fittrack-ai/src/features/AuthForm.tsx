import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { validateEmail, validatePassword } from '../domain/validation';
import { Banner, Body, Button, Card, Field, Screen, Title } from '../ui/components';
import { fonts, space, TOUCH, useTheme } from '../ui/theme';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn, signUp } = useAuth();
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const signingUp = mode === 'sign-up';

  const emailError = validateEmail(email);
  const passwordError = signingUp ? validatePassword(password) : password ? undefined : 'Enter your password';

  async function submit() {
    setSubmitted(true);
    setError(null);
    setNotice(null);
    if (emailError || passwordError) return;
    setBusy(true);
    const result = signingUp ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.needsEmailConfirmation) setNotice('Check your inbox and open the confirmation link, then sign in.');
  }

  const other: { href: Href; label: string } = signingUp
    ? { href: '/sign-in', label: 'Already have an account? Sign in' }
    : { href: '/sign-up', label: 'New here? Create an account' };

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.xl }}>
        <Title>FitTrack AI</Title>
        <Body>{signingUp ? 'Create your account. Your data is private to you.' : 'Sign in to your tracker.'}</Body>
      </View>
      <Card>
        <Field testID="email" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
          error={submitted ? emailError : undefined} />
        <Field testID="password" label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none"
          hint={signingUp ? 'At least 8 characters' : undefined} error={submitted ? passwordError : undefined} />
        {error ? <Banner tone="warning">{error}</Banner> : null}
        {notice ? <Banner>{notice}</Banner> : null}
        <Button label={signingUp ? 'Create account' : 'Sign in'} onPress={() => void submit()} loading={busy} />
      </Card>
      <Link href={other.href} replace accessibilityRole="link" style={{ minHeight: TOUCH, textAlign: 'center', textAlignVertical: 'center', paddingVertical: space.md }}>
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.accent }}>{other.label}</Text>
      </Link>
    </Screen>
  );
}
