/**
 * Liga o Sign-In nativo do Google ao POST /auth/google/ e ao AuthContext.
 *
 * Vive num hook porque login.tsx e register.tsx precisam do mesmo fluxo — o
 * endpoint cria a conta se ela ainda nao existir, entao "entrar" e "cadastrar"
 * com o Google sao a mesma chamada.
 */
import { useCallback, useState } from 'react';

import { api } from '../api/client';
import { ApiError } from '../api/types';
import { useAuth } from './AuthContext';
import { GoogleSignInError, googleSignInAvailable, signInWithGoogle } from './googleSignIn';

export function useGoogleAuth(onError: (message: string) => void) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setBusy(true);
    onError('');
    try {
      const idToken = await signInWithGoogle();
      // Cancelamento: sai calado, sem mensagem de erro.
      if (idToken === null) return;

      const data = await api.googleAuth(idToken);
      await signIn(data);
      // A navegacao e do RouteGuard, que reage ao token aparecer.
    } catch (e) {
      if (e instanceof GoogleSignInError) {
        onError(e.message);
      } else if (e instanceof ApiError) {
        onError(String(e.data?.error || e.data?.detail || 'Não foi possível entrar com o Google.'));
      } else {
        onError('Sem conexão com o servidor.');
      }
    } finally {
      setBusy(false);
    }
  }, [onError, signIn]);

  return { available: googleSignInAvailable, busy, start };
}
