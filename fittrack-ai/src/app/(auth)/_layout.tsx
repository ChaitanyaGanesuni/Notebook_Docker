import { Stack } from 'expo-router';

/** When the root guard sends a signed-out user to this group, open the sign-in screen. */
export const unstable_settings = { anchor: 'sign-in' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
