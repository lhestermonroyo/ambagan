import '@/global.css';
import { Stack } from 'expo-router';
import { Fragment } from 'react';
import 'react-native-reanimated';

export default function AuthLayout() {
  return (
    <Fragment>
      <Stack
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </Fragment>
  );
}
