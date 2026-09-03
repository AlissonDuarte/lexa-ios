/**
 * Client HTTP do Lexa — porte tipado de frontend/src/lib/api.js.
 *
 * Duas diferencas em relacao a web, ambas deliberadas (o refresh token e
 * persistido e renovado dos dois lados desde que o backend ligou
 * ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION):
 *   1. No 401 nao faz `window.location.href`; delega a um handler que o
 *      AuthContext registra, para o expo-router navegar.
 *   2. Lanca ApiError (subclasse de Error) em vez de um objeto cru, mas
 *      preservando `status` e `data` para os chamadores.
 */
import { ApiError } from './types';
import type {
  Achievement,
  AnswerItemResponse,
  AppleProfile,
  AuthResponse,
  Avaliacao,
  CompleteItemResponse,
  DailySequence,
  Gamification,
  Law,
  LawArticle,
  LoginPayload,
  RankingEntry,
  RegisterPayload,
  RoadmapComment,
  RoadmapIdea,
  RoadmapIdeaPayload,
  RoadmapStats,
  RoadmapVoteResponse,
  ShowItemResponse,
  User,
} from './types';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000/api';

// ── Estado de sessao em memoria ──────────────────────────────────────────────
// Mantido fora do React para o client ser chamavel de qualquer lugar sem
// prop-drilling. O AuthContext e a unica fonte que escreve aqui.

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  refreshToken = refresh;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * Callback para o AuthContext persistir o que o refresh renovou. `refresh` e
 * `null` quando o backend nao rotaciona (nao e o caso hoje: o backend roda
 * ROTATE_REFRESH_TOKENS, entao um novo refresh sempre volta e precisa ser
 * salvo — o anterior e blacklistado no servidor assim que este e emitido).
 */
let onTokenRefreshed: ((access: string, refresh: string | null) => void) | null = null;

export function setTokenRefreshedHandler(
  handler: ((access: string, refresh: string | null) => void) | null,
): void {
  onTokenRefreshed = handler;
}

// ── Refresh ──────────────────────────────────────────────────────────────────

/**
 * Uma unica renovacao em voo por vez: varias telas podem tomar 401 ao mesmo
 * tempo no boot, e sem isso cada uma dispararia seu proprio refresh.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!response.ok) return null;

      const data = (await response.json()) as { access?: string; refresh?: string };
      if (!data?.access) return null;

      accessToken = data.access;
      if (data.refresh) refreshToken = data.refresh;
      onTokenRefreshed?.(data.access, data.refresh ?? null);
      return data.access;
    } catch {
      // Falha de rede nao deve deslogar: o chamador trata como 401 comum.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ── Núcleo ───────────────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Nao redireciona para login no 401. Usado nos endpoints publicos. */
  allowAnonymous?: boolean;
  /** Uso interno: evita loop de refresh. */
  _isRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, allowAnonymous, _isRetry, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((extraHeaders as Record<string, string>) || {}),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !allowAnonymous) {
    // Tenta renovar uma unica vez antes de desistir da sessao.
    if (!_isRetry) {
      const renewed = await refreshAccessToken();
      if (renewed) {
        return request<T>(path, { ...options, _isRetry: true });
      }
    }
    onUnauthorized?.();
    throw new ApiError(401, { error: 'Não autorizado' });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

/** Endpoints publicos: manda o Bearer se houver, mas nao desloga no 401. */
function publicRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, allowAnonymous: true });
}

// ── Superficie da API ────────────────────────────────────────────────────────

export const api = {
  // Auth
  register: (body: RegisterPayload) =>
    publicRequest<AuthResponse>('/auth/register/', { method: 'POST', body }),
  login: (body: LoginPayload) =>
    publicRequest<AuthResponse>('/auth/login/', { method: 'POST', body }),
  /** `credential` e o ID token do Google (mesmo contrato do GIS na web). */
  googleAuth: (credential: string) =>
    publicRequest<AuthResponse>('/auth/google/', { method: 'POST', body: { credential } }),
  /**
   * `identityToken` e o JWT da Apple. O `profile` vai junto porque nome e
   * e-mail so existem na primeira autorizacao — depois disso o backend nao
   * teria de onde tirar.
   */
  appleAuth: (identityToken: string, profile: AppleProfile) =>
    publicRequest<AuthResponse>('/auth/apple/', {
      method: 'POST',
      body: { identity_token: identityToken, ...profile },
    }),
  me: () => request<User>('/auth/me/'),
  updatePrivacy: (perfil_privado: boolean) =>
    request<User>('/auth/me/privacy/', { method: 'PATCH', body: { perfil_privado } }),
  completeOnboarding: () => request<unknown>('/auth/me/onboard/', { method: 'POST' }),

  // Laws
  getLaws: () => request<Law[]>('/laws/'),
  getLawArticles: (slug: string) =>
    request<LawArticle[]>(`/laws/${encodeURIComponent(slug)}/articles/`),

  // Sequences
  getTodaySequence: (lawSlug: string) =>
    request<DailySequence>(`/sequences/today/?law=${encodeURIComponent(lawSlug)}`),
  showItem: (itemId: number) =>
    request<ShowItemResponse>(`/sequences/items/${itemId}/show/`, { method: 'POST' }),
  answerItem: (itemId: number, resposta: string) =>
    request<AnswerItemResponse>(`/sequences/items/${itemId}/answer/`, {
      method: 'POST',
      body: { resposta },
    }),
  completeItem: (itemId: number, avaliacao: Avaliacao) =>
    request<CompleteItemResponse>(`/sequences/items/${itemId}/complete/`, {
      method: 'POST',
      body: { avaliacao },
    }),
  useShield: () => request<unknown>('/sequences/shield/use/', { method: 'POST' }),

  // Gamification
  getRanking: () => request<RankingEntry[]>('/gamification/ranking/'),
  getMyGamification: () => request<Gamification>('/gamification/me/'),

  // Achievements
  getAchievements: () => request<Achievement[]>('/achievements/'),

  // Notifications
  getNotifications: () => request<Record<string, unknown>[]>('/notifications/'),
  /**
   * `environment` diz ao backend em qual APNs o token foi emitido: build de
   * Metro fala com o sandbox, TestFlight e loja com o de producao. E uma dica —
   * o backend corrige a linha sozinho se ela vier errada.
   */
  registerDeviceToken: (token: string, environment: 'sandbox' | 'production') =>
    request<unknown>('/notifications/device/register/', {
      method: 'POST',
      body: { token, platform: 'ios', environment },
    }),
  unregisterDeviceToken: (token: string) =>
    request<unknown>('/notifications/device/unregister/', {
      method: 'DELETE',
      body: { token },
    }),

  // Roadmap
  getRoadmapIdeas: () => publicRequest<RoadmapIdea[]>('/roadmap/ideas/'),
  getRoadmapStats: () => publicRequest<RoadmapStats>('/roadmap/stats/'),
  getRoadmapComments: (id: number) =>
    publicRequest<RoadmapComment[]>(`/roadmap/ideas/${id}/comments/`),
  // As tres abaixo exigem sessao: o backend responde 401 sem token.
  createRoadmapIdea: (body: RoadmapIdeaPayload) =>
    request<RoadmapIdea>('/roadmap/ideas/', { method: 'POST', body }),
  voteRoadmapIdea: (id: number) =>
    request<RoadmapVoteResponse>(`/roadmap/ideas/${id}/vote/`, { method: 'POST' }),
  addRoadmapComment: (id: number, text: string) =>
    request<RoadmapComment>(`/roadmap/ideas/${id}/comments/`, { method: 'POST', body: { text } }),
};

export { BASE_URL };
