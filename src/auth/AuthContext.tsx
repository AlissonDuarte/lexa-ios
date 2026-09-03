/**
 * Estado de autenticacao — porte de frontend/src/lib/stores/auth.js.
 *
 * Alem de portar, corrige dois pontos da web:
 *   - o refresh token e persistido e usado (a web descarta);
 *   - o guard de rota e centralizado aqui + no app/_layout.tsx, em vez de
 *     repetido no onMount de cada pagina privada.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { api, setTokenRefreshedHandler, setTokens, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, User } from '../api/types';
import { signOutFromGoogle } from './googleSignIn';
import { unregisterFromPush } from '../push/registerDevice';
import { clearSession, loadSession, saveTokens, saveUser } from './tokenStore';

interface AuthState {
  user: User | null;
  token: string | null;
  /** true ate a sessao persistida terminar de carregar — evita piscar o login. */
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (response: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  // Evita setState depois do unmount durante o boot assincrono.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    // Antes de limpar a sessao, enquanto o Bearer ainda vale: sem isto o
    // aparelho continua recebendo os lembretes do dono anterior.
    await unregisterFromPush();
    setTokens(null, null);
    await clearSession();
    // Sem isto o SDK do Google guarda a conta e o proximo toque no botao
    // reentra sem perguntar — ruim para quem deslogou para trocar de conta.
    await signOutFromGoogle();
    if (mounted.current) {
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    // Chama o backend com o Bearer ainda valido — ele marca a conta como
    // excluida e blacklista os refresh tokens emitidos. So depois disso
    // limpamos localmente, na mesma sequencia do signOut.
    await api.deleteAccount();
    await unregisterFromPush();
    setTokens(null, null);
    await clearSession();
    await signOutFromGoogle();
    if (mounted.current) {
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  const signIn = useCallback(async (response: AuthResponse) => {
    setTokens(response.access, response.refresh);
    await saveTokens(response.access, response.refresh);
    await saveUser(response.user);
    if (mounted.current) {
      setState({ user: response.user, token: response.access, loading: false });
    }
  }, []);

  const updateUser = useCallback(async (user: User) => {
    await saveUser(user);
    if (mounted.current) {
      setState((s) => ({ ...s, user }));
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await api.me();
      await updateUser(fresh);
    } catch {
      // Offline ou token morto: seguimos com o user em cache. Se o token
      // estiver realmente invalido, o handler de 401 desloga.
    }
  }, [updateUser]);

  // Liga o client a este contexto: 401 sem recuperacao desloga, e o access
  // renovado pelo refresh e persistido.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    setTokenRefreshedHandler((access, refresh) => {
      void saveTokens(access, refresh);
      if (mounted.current) {
        setState((s) => ({ ...s, token: access }));
      }
    });
    return () => {
      setUnauthorizedHandler(null);
      setTokenRefreshedHandler(null);
    };
  }, [signOut]);

  // Boot: reidrata a sessao persistida.
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      setTokens(session.access, session.refresh);
      if (mounted.current) {
        setState({ user: session.user, token: session.access, loading: false });
      }
      if (session.access) {
        // Revalida em background, igual ao onMount do +layout.svelte da web.
        void refreshUser();
      }
    })();
    // Roda uma vez: refreshUser e estavel via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, deleteAccount, updateUser, refreshUser }),
    [state, signIn, signOut, deleteAccount, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return ctx;
}
