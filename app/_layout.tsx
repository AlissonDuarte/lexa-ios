import '../global.css';

import {
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { usePushNotifications } from '../src/push/usePushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Guard central de rota.
 *
 * A web repete `if (!$authStore.token) goto('/login')` no onMount de cada
 * pagina privada; aqui a decisao vive num lugar so.
 */
function RouteGuard() {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Aqui dentro por dois motivos: precisa do AuthProvider acima (o registro so
  // vale com sessao) e do router, para o toque na notificacao navegar.
  usePushNotifications();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [token, loading, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    // Obrigatoria para o texto legal: Agents.md exige fidelidade visual ao
    // documento oficial.
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    // Some com a splash mesmo se uma fonte falhar — melhor um fallback de
    // sistema do que um app travado na splash.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RouteGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
