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
/**
 * Ambiente do APNs gravado no entitlement aps-environment.
 *
 * 'development' aponta o app para o APNs sandbox; 'production' para o real. Os
 * dois registram e devolvem um device token normalmente — o erro so aparece do
 * outro lado: um build de TestFlight assinado com 'development' recebe token,
 * manda pro backend e nunca entrega nada, sem log nenhum no aparelho dizendo
 * por que. Por isso o CI exporta APS_ENVIRONMENT=production explicitamente
 * (ver .github/workflows/ios.yml) e o default local e o sandbox.
 */
const apsEnvironment = process.env.APS_ENVIRONMENT === 'production' ? 'production' : 'development';

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
    // Escreve o entitlement com.apple.developer.applesignin no prebuild. Sem
    // ele o botao da Apple aparece e o signInAsync falha na hora.
    usesAppleSignIn: true,
    // Declarado aqui em vez de deixar a cargo do plugin do expo-notifications:
    // e o mesmo motivo do usesAppleSignIn acima — o entitlement que sai do
    // prebuild fica visivel no config, e o CI consegue conferir o valor.
    entitlements: {
      'aps-environment': apsEnvironment,
    },
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
    // Sem condicional, diferente do Google: nao ha client ID para configurar, e
    // a disponibilidade e decidida em runtime por isAvailableAsync().
    'expo-apple-authentication',
    // Registra o app no APNs e entrega o device token. Sem
    // enableBackgroundRemoteNotifications: as notificacoes sao puramente de
    // alerta, o app nao roda codigo em background ao receber uma.
    'expo-notifications',
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
