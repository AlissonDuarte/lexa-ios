/**
 * Google Sign-In nativo.
 *
 * A web usa o script do Google Identity Services e recebe um `credential`
 * (JWT de ID) no callback — ver frontend/src/components/GoogleSignInButton.svelte.
 * Aqui o equivalente e o `idToken` devolvido pelo SDK nativo: os dois vao para
 * o mesmo POST /auth/google/, que valida o JWT no backend.
 *
 * Nao funciona no Expo Go — o modulo e nativo. Em dev, use um development
 * build (`npx expo run:ios`).
 */
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/**
 * Sem client ID configurado o botao some da tela, igual ao `unsupported` da
 * web. Evita um botao que so falharia ao ser tocado.
 */
export const googleSignInAvailable = WEB_CLIENT_ID.length > 0 && IOS_CLIENT_ID.length > 0;

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    // O backend valida o JWT contra um client ID so (settings.GOOGLE_CLIENT_ID).
    // Passar o web client aqui e o que faz o token servir para os dois clientes.
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });
  configured = true;
}

/** Erro de verdade no fluxo; cancelamento do usuario nao passa por aqui. */
export class GoogleSignInError extends Error {}

/**
 * Abre o fluxo nativo e devolve o ID token.
 *
 * @returns o JWT para mandar ao backend, ou `null` se o usuario cancelou —
 *   cancelar nao e erro e nao deve virar mensagem vermelha na tela.
 */
export async function signInWithGoogle(): Promise<string | null> {
  ensureConfigured();

  try {
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return null;
    }

    const { idToken } = response.data;
    if (!idToken) {
      throw new GoogleSignInError('O Google nao devolveu um token de identidade.');
    }
    return idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      switch (e.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return null;
        case statusCodes.IN_PROGRESS:
          // Toque duplo no botao: a primeira chamada ainda resolve.
          return null;
        default:
          throw new GoogleSignInError('Nao foi possivel entrar com o Google.');
      }
    }
    throw e;
  }
}

/**
 * Encerra a sessao no SDK do Google.
 *
 * Sem isto o proximo toque no botao reentra com a mesma conta sem perguntar,
 * o que confunde quem deslogou justamente para trocar de conta.
 */
export async function signOutFromGoogle(): Promise<void> {
  if (!googleSignInAvailable) return;
  ensureConfigured();
  await GoogleSignin.signOut().catch(() => undefined);
}
