/**
 * Registro do aparelho no APNs — porte de frontend/src/lib/push.js.
 *
 * A web pede uma PushSubscription ao service worker e manda endpoint+chaves
 * para /notifications/push/subscribe/. Aqui nao ha service worker: o iOS
 * devolve um device token opaco, que vai para /notifications/device/register/.
 * Sao dois protocolos e dois endpoints; o backend decide qual usar por usuario
 * (ver _fan_out em apps/notifications/tasks.py).
 *
 * Dois estados diferentes convivem aqui, e confundi-los da bug:
 *   - a PERMISSAO do iOS, que so pode ser concedida uma vez e nunca revogada
 *     de dentro do app;
 *   - a PREFERENCIA do usuario no toggle do perfil, que ele liga e desliga a
 *     vontade.
 * Quem desliga o toggle continua com a permissao concedida. Se o boot olhasse
 * so a permissao, ele registraria o aparelho de novo na proxima abertura e o
 * toggle voltaria sozinho para ligado.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from '../api/client';

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface PushState {
  /** Permissao do sistema. */
  status: PushStatus;
  /** Valor do toggle: permissao concedida E aparelho registrado no backend. */
  enabled: boolean;
}

/**
 * O ultimo token registrado, para o logout saber o que apagar sem gastar uma
 * ida ao APNs so para descobrir algo que ja sabiamos.
 */
const TOKEN_KEY = 'lexa_push_token';
/** 'off' quando o usuario desligou o toggle. Ausente = nunca decidiu. */
const PREF_KEY = 'lexa_push_pref';

/**
 * O simulador registra e ate devolve um token, mas ele nao vale no APNs real:
 * qualquer envio volta BadDeviceToken. Melhor dizer 'unsupported' do que sujar
 * a tabela do backend com tokens que nunca vao entregar nada.
 */
function supported(): boolean {
  return Device.isDevice;
}

async function currentStatus(): Promise<PushStatus> {
  const settings = await Notifications.getPermissionsAsync();
  // No iOS o `status` da raiz nao distingue "ainda nao perguntei" de "negado"
  // em todos os casos — o ios.status e a fonte certa.
  const status = settings.ios?.status;
  if (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  if (status === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
  if (status === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
  return settings.granted ? 'granted' : 'denied';
}

async function optedOut(): Promise<boolean> {
  return (await AsyncStorage.getItem(PREF_KEY)) === 'off';
}

/** Le permissao e preferencia sem nunca abrir o prompt do sistema. */
export async function getPushState(): Promise<PushState> {
  if (!supported()) return { status: 'unsupported', enabled: false };

  const status = await currentStatus();
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return { status, enabled: status === 'granted' && !!token && !(await optedOut()) };
}

/**
 * Pede a permissao (se ainda nao foi pedida) e manda o token para o backend.
 *
 * `promptIfNeeded: false` registra apenas quem ja concedeu antes — e o que o
 * boot do app usa, para nao gastar o prompt do iOS, que so aparece uma vez na
 * vida da instalacao.
 *
 * `force: true` ignora um opt-out anterior. So o toggle do perfil usa: e o
 * unico lugar onde o usuario esta pedindo para religar.
 */
export async function registerForPush({ promptIfNeeded = true, force = false } = {}): Promise<PushStatus> {
  if (!supported()) return 'unsupported';
  if (!force && (await optedOut())) return currentStatus();

  let status = await currentStatus();

  if (status === 'undetermined') {
    if (!promptIfNeeded) return status;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = asked.granted ? 'granted' : 'denied';
  }

  if (status !== 'granted') return status;

  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== 'string') return status;

  // __DEV__ e so uma dica de ambiente: build de Metro fala com o APNs sandbox,
  // TestFlight e loja falam com o de producao. Se vier errada, o backend
  // corrige a linha sozinho no primeiro envio (BadEnvironmentKeyInToken).
  await api.registerDeviceToken(token.data, __DEV__ ? 'sandbox' : 'production');
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token.data],
    [PREF_KEY, 'on'],
  ]);

  return 'granted';
}

/**
 * Desliga os lembretes: o aparelho sai da tabela do backend e a preferencia
 * fica gravada, para o boot nao registrar de novo.
 *
 * A permissao do iOS continua concedida — nao da para revogar de dentro do app,
 * e nem seria desejavel: religar o toggle nao pode depender de o usuario ir aos
 * Ajustes.
 */
export async function disablePush(): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, 'off');
  await unregisterFromPush();
}

/**
 * Chamado no logout, antes de limpar a sessao: sem isso o aparelho continua
 * recebendo os lembretes do dono anterior.
 *
 * Nao mexe na preferencia: quem tinha lembretes ligados e so deslogou deve
 * voltar com eles ligados.
 */
export async function unregisterFromPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api.unregisterDeviceToken(token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Rede fora ou token ja expirado nao pode travar o logout. O backend apaga
    // a linha sozinho no primeiro Unregistered que o APNs devolver.
  }
}
