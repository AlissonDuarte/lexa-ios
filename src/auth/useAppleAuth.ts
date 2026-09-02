/**
 * Liga o Sign in with Apple ao POST /auth/apple/ e ao AuthContext.
 *
 * Mesma forma do useGoogleAuth — `{ available, busy, start }` — para as telas
 * tratarem os dois provedores do mesmo jeito. So `available` muda de natureza:
 * la e uma constante de build, aqui e uma pergunta ao sistema, respondida
 * depois do primeiro render.
 */
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import { ApiError } from '../api/types';
import { AppleSignInError, isAppleSignInAvailable, signInWithApple } from './appleSignIn';
import { useAuth } from './AuthContext';

export function useAppleAuth(onError: (message: string) => void) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((ok) => {
      // A tela pode ter saido antes da resposta; setState num componente
      // desmontado nao faz nada de util.
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const start = useCallback(async () => {
    setBusy(true);
    onError('');
    try {
      const credential = await signInWithApple();
      // Cancelamento: sai calado, sem mensagem de erro.
      if (credential === null) return;

      const { identityToken, ...profile } = credential;
      const data = await api.appleAuth(identityToken, profile);
      await signIn(data);
      // A navegacao e do RouteGuard, que reage ao token aparecer.
    } catch (e) {
      if (e instanceof AppleSignInError) {
        onError(e.message);
      } else if (e instanceof ApiError) {
        onError(String(e.data?.error || e.data?.detail || 'Não foi possível entrar com a Apple.'));
      } else {
        onError('Sem conexão com o servidor.');
      }
    } finally {
      setBusy(false);
    }
  }, [onError, signIn]);

  return { available, busy, start };
}
