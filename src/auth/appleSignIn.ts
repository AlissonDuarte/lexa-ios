/**
 * Sign in with Apple.
 *
 * O equivalente do `idToken` do Google aqui e o `identityToken`: um JWT que o
 * backend valida contra as chaves publicas da Apple em POST /auth/apple/.
 *
 * Duas diferencas em relacao ao googleSignIn.ts moldam este modulo:
 *
 * 1. A disponibilidade nao vem de env var e sim do sistema (iOS 13+, e nunca no
 *    Android), entao e uma pergunta assincrona de runtime — nao da para exportar
 *    uma constante como `googleSignInAvailable`.
 * 2. Nome e e-mail so chegam na PRIMEIRA autorizacao. Nas seguintes vem `null`,
 *    de proposito, pela Apple. Por isso eles sobem junto no mesmo POST: e a
 *    unica janela em que existem, e quem persiste e o backend.
 *
 * Nao funciona no Expo Go — o modulo e nativo. Em dev, use um development build.
 */
import * as AppleAuthentication from 'expo-apple-authentication';

import type { AppleProfile } from '../api/types';

/** Erro de verdade no fluxo; cancelamento do usuario nao passa por aqui. */
export class AppleSignInError extends Error {}

export interface AppleCredential extends AppleProfile {
  identityToken: string;
}

/**
 * O aparelho suporta Sign in with Apple?
 *
 * Falso em todo Android e em iOS anterior ao 13. Nunca lanca: um erro aqui vira
 * "indisponivel", que so esconde o botao.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Abre o fluxo nativo e devolve o token mais o que a Apple tiver dito do perfil.
 *
 * @returns o JWT (e o perfil, se for a primeira entrada) para mandar ao backend,
 *   ou `null` se o usuario cancelou — cancelar nao e erro e nao deve virar
 *   mensagem vermelha na tela.
 */
export async function signInWithApple(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new AppleSignInError('A Apple nao devolveu um token de identidade.');
    }

    return {
      identityToken: credential.identityToken,
      // `?? undefined` em vez de `?? ''`: campo ausente some do JSON, e o
      // backend so sobrescreve o que recebe. Mandar '' apagaria o nome ja
      // cadastrado no segundo login.
      email: credential.email ?? undefined,
      first_name: credential.fullName?.givenName ?? undefined,
      last_name: credential.fullName?.familyName ?? undefined,
    };
  } catch (e) {
    if (e instanceof AppleSignInError) throw e;
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw new AppleSignInError('Nao foi possivel entrar com a Apple.');
  }
}
