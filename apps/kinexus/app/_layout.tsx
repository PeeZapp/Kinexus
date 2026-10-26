import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ShareIntentProvider } from 'expo-share-intent';
import 'react-native-reanimated';

import { AuthProvider } from '@/src/lib/auth';
import { ExperienceProvider } from '@/src/lib/experience-mode';
import { HouseholdProvider } from '@/src/lib/household';
import { QueryProvider } from '@/src/lib/query';
import '@/src/lib/silence-wallet-extensions';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ShareIntentProvider options={{ disabled: Platform.OS === 'web', resetOnBackground: true }}>
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
                  <Stack.Screen name="(staff)" />
                  <Stack.Screen name="auth/callback" />
                  <Stack.Screen name="invite/[token]" />
                  <Stack.Screen name="share/list/[token]" />
                  <Stack.Screen name="share/recipe" />
                  <Stack.Screen name="share/trolley" />
                  <Stack.Screen name="shareintent" />
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
    </ShareIntentProvider>
  );
}
