import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/src/lib/auth';
import { ExperienceProvider } from '@/src/lib/experience-mode';
import { HouseholdProvider } from '@/src/lib/household';
import { QueryProvider } from '@/src/lib/query';

if (Platform.OS === 'web') {
  LogBox.ignoreLogs(['Cannot redefine property: ethereum']);
}

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <AuthProvider>
        <QueryProvider>
          <HouseholdProvider>
            <ExperienceProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1016' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="auth/callback" />
                <Stack.Screen name="invite/[token]" />
                <Stack.Screen name="share/list/[token]" />
                <Stack.Screen name="import" />
                <Stack.Screen name="recipes" />
                <Stack.Screen name="https/[...slug]" />
                <Stack.Screen name="http/[...slug]" />
              </Stack>
            </ExperienceProvider>
          </HouseholdProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
