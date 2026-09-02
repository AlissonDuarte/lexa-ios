import type { ExpoConfig } from 'expo/config';

/**
 * Config do app Expo.
 *
 * E .ts em vez de app.json por causa do ATS: em dev o app aponta para o
 * backend do docker-compose por HTTP simples num IP de LAN, e o App Transport
 * Security do iOS bloqueia cleartext por padrao. A excecao so e injetada
 * quando a URL configurada e de fato http://, entao um build de producao
 * (https://lexaclub.com.br/api) sai sem nenhuma brecha.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const isCleartextApi = apiUrl.startsWith('http://');

/**
 * O plugin do Google Sign-In precisa registrar o "reversed client ID" como URL
 * scheme para receber o callback. Ele e o proprio client ID de iOS invertido,
 * entao derivamos em vez de pedir um segundo secret que poderia divergir.
 * Sem client ID configurado o plugin nao entra: o build segue normalmente e o
 * botao some da tela (ver src/auth/googleSignIn.ts).
 */
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleIosUrlScheme = googleIosClientId.endsWith('.apps.googleusercontent.com')
  ? `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`
  : null;

const config: ExpoConfig = {
  name: 'Lexa',
  slug: 'lexa',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'lexa',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.lexaclub.app',
    appleTeamId: process.env.APPLE_TEAM_ID,
    infoPlist: {
      ...(isCleartextApi
        ? {
            NSAppTransportSecurity: {
              // Libera apenas a rede local, nao a internet inteira.
              NSAllowsLocalNetworking: true,
            },
          }
        : {}),
    },
  },
  android: {
    package: 'com.lexaclub.app',
    adaptiveIcon: {
      backgroundColor: '#FDF6E9',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    // No SDK 57 a splash deixou de ser chave de topo e virou config do plugin.
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#FDF6E9',
      },
    ],
    // A anotacao de tupla e necessaria: sem ela o TS infere (string | objeto)[]
    // e o tipo de `plugins` exige exatamente [nome, config].
    ...(googleIosUrlScheme
      ? ([
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }],
        ] as [string, Record<string, string>][])
      : []),
  ],
  experiments: { typedRoutes: true },
};

export default config;
