/**
 * Persistencia de sessao.
 *
 * Diferenca deliberada em relacao a web (frontend/src/lib/stores/auth.js), que
 * guarda so `lexa_token` em localStorage e joga fora o refresh: aqui o refresh
 * e persistido. Com ACCESS_TOKEN_LIFETIME de 7 dias, um app nativo sem refresh
 * forcaria re-login toda semana.
 *
 * Tokens vao no SecureStore (Keychain no iOS, Keystore no Android); o objeto
 * user, que nao e segredo, vai no AsyncStorage — o SecureStore tem limite
 * pratico de tamanho e avisa acima de 2KB.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { User } from '../api/types';

const ACCESS_KEY = 'lexa_token';
const REFRESH_KEY = 'lexa_refresh';
const USER_KEY = 'lexa_user';

export interface StoredSession {
  access: string | null;
  refresh: string | null;
  user: User | null;
}

export async function loadSession(): Promise<StoredSession> {
  const [access, refresh, rawUser] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY).catch(() => null),
    SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    AsyncStorage.getItem(USER_KEY).catch(() => null),
  ]);

  let user: User | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as User;
    } catch {
      // Cache corrompido nao pode derrubar o boot: seguimos sem o user em
      // cache e o /auth/me/ do layout raiz repopula.
      user = null;
    }
  }

  return { access, refresh, user };
}

export async function saveTokens(access: string, refresh: string | null): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) {
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  }
}

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined),
    AsyncStorage.removeItem(USER_KEY).catch(() => undefined),
  ]);
}
