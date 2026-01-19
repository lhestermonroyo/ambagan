import '@/global.css';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
