import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    // Keep account recovery and onboarding protected from accidental back swipes.
    // Email forms opt in below because welcome is now their back destination.
    <Stack screenOptions={{ gestureEnabled: false }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}
