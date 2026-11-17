import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { validateEmail, validatePassword } from '../domain/validation';
import { Banner, Button, Card, Field, Heading, Muted, Screen } from '../ui/components';
import { Appear } from '../ui/motion';
import { fonts, hero, space, TOUCH, useTheme } from '../ui/theme';

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
      <Appear>
        <LinearGradient colors={hero.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brand}>
          <Text style={styles.ghost} importantForAccessibility="no" aria-hidden>FT</Text>
          <View style={styles.mark}><Ionicons name="flash" size={22} color="#0B0D11" /></View>
          <Text accessibilityRole="header" style={styles.wordmark}>FITTRACK <Text style={{ color: hero.lime }}>AI</Text></Text>
          <Text style={styles.tagline}>Log in seconds. Judge on weeks, not days.</Text>
        </LinearGradient>
      </Appear>
      <Appear index={1}>
      <Card>
        <View style={{ gap: 2 }}>
          <Heading>{signingUp ? 'Create your account' : 'Welcome back'}</Heading>
          <Muted>{signingUp ? 'Create your account. Your data is private to you.' : 'Sign in to your tracker.'}</Muted>
        </View>
        <Field testID="email" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
          error={submitted ? emailError : undefined} />
        <Field testID="password" label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none"
          hint={signingUp ? 'At least 8 characters' : undefined} error={submitted ? passwordError : undefined} />
        {error ? <Banner tone="warning">{error}</Banner> : null}
        {notice ? <Banner>{notice}</Banner> : null}
        <Button label={signingUp ? 'Create account' : 'Sign in'} onPress={() => void submit()} loading={busy} icon="arrow-forward" />
      </Card>
      </Appear>
      <Link href={other.href} replace accessibilityRole="link" style={{ minHeight: TOUCH, textAlign: 'center', textAlignVertical: 'center', paddingVertical: space.md }}>
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.accent }}>{other.label}</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { borderRadius: 28, padding: space.xl, paddingTop: space.xxl, gap: space.sm, overflow: 'hidden', marginTop: space.sm },
  ghost: { position: 'absolute', right: -10, top: -30, fontFamily: fonts.headingBold, fontSize: 190, lineHeight: 200, color: hero.ghost },
  mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: hero.lime, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  wordmark: { fontFamily: fonts.headingBold, fontSize: 44, lineHeight: 46, letterSpacing: 1, color: hero.text },
  tagline: { fontFamily: fonts.bodyMedium, fontSize: 15, color: hero.textMuted },
});
