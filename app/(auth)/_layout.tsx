import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    // gestureEnabled: false — the auth screens use `replace` to move forward, so
    // there's no valid back target. Disabling the native back-swipe stops an
    // accidental swipe from landing the user back on login/welcome mid-flow.
    <Stack screenOptions={{ gestureEnabled: false }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}
