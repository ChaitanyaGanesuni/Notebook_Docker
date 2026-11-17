import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { DataProvider, useData, useProfile } from '../data/DataProvider';
import { useSyncStatus } from '../data/sync/engine';
import { useTheme } from '../ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Which part of the app the signed-in user should see. */
export type Gate = 'starting' | 'onboarding' | 'ready';

function useGate(): Gate {
  const { store, storeError } = useData();
  const profile = useProfile();
  const initialPull = useSyncStatus((s) => s.initialPull);
  if (storeError || !store || profile.isPending) return 'starting';
  if (profile.data?.onboarded_at) return 'ready';
  // No profile on this device. Only offer onboarding once we know the account has none on the
  // server either; otherwise onboarding on a second phone could overwrite an existing profile.
  return initialPull === 'done' ? 'onboarding' : 'starting';
}

function Navigator() {
  const { status } = useAuth();
  const gate = useGate();
  const { c } = useTheme();
  const signedIn = status === 'signedIn';
  // Where a screen sends the user when its guard closes (for example on sign-out).
  const home: Href =
    status === 'unconfigured' ? '/setup'
    : status === 'signedOut' ? '/sign-in'
    : status === 'loading' || gate === 'starting' ? '/starting'
    : gate === 'onboarding' ? '/onboarding'
    : '/';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Protected redirectTo={home} guard={status === 'unconfigured'}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={status === 'loading' || (signedIn && gate === 'starting')}>
        <Stack.Screen name="starting" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={signedIn && gate === 'onboarding'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected redirectTo={home} guard={signedIn && gate === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings/profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exercise/[slug]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    // All queries read the on-device database, so they must run with no connection.
    defaultOptions: { queries: { networkMode: 'always', staleTime: Infinity, retry: false }, mutations: { networkMode: 'always' } },
  }));
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });
  const { dark } = useTheme();
  const fontsReady = fontsLoaded || !!fontError; // fall back to system fonts rather than block the app

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);

  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DataProvider>
            <StatusBar style={dark ? 'light' : 'dark'} />
            <Navigator />
          </DataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
