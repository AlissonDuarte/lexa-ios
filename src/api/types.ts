/**
 * Tipos do contrato da API Lexa.
 *
 * O backend nao expoe OpenAPI, entao estes tipos sao derivados a mao dos
 * serializers DRF e sao a documentacao de facto do contrato. Ao mexer num
 * serializer, atualizar aqui.
 *
 * Fontes:
 *   backend/apps/users/serializers.py
 *   backend/apps/laws/serializers.py
 *   backend/apps/sequences/serializers.py
 *   backend/apps/gamification/views.py   (dicts a mao, sem serializer)
 *   backend/apps/achievements/views.py   (idem)
 */

// ── Auth / User ──────────────────────────────────────────────────────────────

/** User.TIER_THRESHOLDS em backend/apps/users/models.py */
export type Tier = 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante';

export const TIER_THRESHOLDS: ReadonlyArray<readonly [Tier, number]> = [
  ['bronze', 0],
  ['prata', 500],
  ['ouro', 1500],
  ['platina', 4000],
  ['diamante', 10000],
];

/**
 * UserSerializer. Atencao: NAO existe campo `id` — a identidade publica e
 * `user_uuid`. (A web erra nisso em ranking/+page.svelte, que compara
 * `user?.id` e nunca casa; aqui comparamos por `username`.)
 */
export interface User {
  user_uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  xp: number;
  tier: Tier;
  streak_atual: number;
  streak_maximo: number;
  is_premium: boolean;
  perfil_privado: boolean;
  onboarded: boolean;
}

/** Resposta de /auth/login/, /auth/register/ e /auth/google/ */
export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

// ── Laws ─────────────────────────────────────────────────────────────────────

export interface Law {
  id: number;
  slug: string;
  nome: string;
  fonte_url: string;
  article_count: number;
  artigos_concluidos: number;
}

export type ArticleTipo = 'artigo' | 'paragrafo' | 'inciso' | 'alinea';
export type ArticleStatus = 'novo' | 'ok' | 'atualizado' | 'revisao_pendente';

export type TipoLacuna =
  | 'prazo' | 'pena' | 'excecao' | 'juridico'
  | 'sujeito' | 'verbo' | 'simples' | 'outro';

/**
 * ArticleQuestionSerializer. `resposta` NAO e exposta de proposito — a
 * correcao acontece no servidor, em answer_item.
 */
export interface ArticleQuestion {
  texto_lacuna: string;
  alternativas: string[];
  tipo_lacuna: TipoLacuna;
  num_lacunas: number;
}

/** LawArticleChildSerializer — paragrafos/incisos/alineas do caput. */
export interface LawArticleChild {
  id: number;
  numero: string;
  tipo: ArticleTipo;
  texto: string;
  ordem: number;
}

export interface LawArticle {
  id: number;
  numero: string;
  tipo: ArticleTipo;
  texto: string;
  hash: string;
  status: ArticleStatus;
  parent: number | null;
  ordem: number;
  criado_em: string;
  atualizado_em: string | null;
  question: ArticleQuestion | null;
  /** max(10, palavras // 3) — calculado no servidor e reimposto em complete_item. */
  min_read_seconds: number;
  children: LawArticleChild[];
}

// ── Sequences ────────────────────────────────────────────────────────────────

export type ItemTipo = 'novo' | 'revisao';
export type Avaliacao = 'facil' | 'medio' | 'dificil';

export interface SequenceItem {
  id: number;
  article: LawArticle;
  tipo: ItemTipo;
  concluido: boolean;
  avaliacao: Avaliacao | null;
  ordem: number;
  shown_at: string | null;
  respondido: boolean;
  resposta_correta: boolean | null;
}

export interface DailySequence {
  id: number;
  data: string;
  numero: number;
  concluida: boolean;
  items: SequenceItem[];
  total: number;
  concluidos: number;
  criado_em: string;
  max_sequencias: number;
  sequencias_concluidas_hoje: number;
}

export interface ShowItemResponse {
  shown_at: string;
  min_read_seconds: number;
  already_shown: boolean;
}

export interface AnswerItemResponse {
  correto: boolean;
  resposta_correta: string;
  xp_bonus: number;
  xp_disponivel_hoje: number;
}

export interface AchievementUnlock {
  slug: string;
  nome: string;
  descricao: string;
  emoji: string;
  cor: string;
  raridade: string;
  raridade_label: string;
}

export interface MilestoneUnlock {
  threshold: number;
  lei: string;
  law_slug: string;
  title: string;
  body: string;
  pct: number;
}

/** Payload mais rico da API — dirige quase toda a UI pos-conclusao. */
export interface CompleteItemResponse {
  xp_ganho: number;
  bonus_xp: number;
  total_xp: number;
  tier: Tier;
  sequencia_concluida: boolean;
  streak_incrementado: boolean;
  streak_quebrado: boolean;
  streak_perdido: number | null;
  streak_atual: number;
  shields_disponiveis: number;
  xp_disponivel_hoje: number;
  new_achievements: AchievementUnlock[];
  new_milestones: MilestoneUnlock[];
}

// ── Gamification ─────────────────────────────────────────────────────────────

export interface RankingEntry {
  id: number;
  username: string;
  xp: number;
  tier: Tier;
  streak_atual: number;
  posicao: number;
  perfil_privado?: boolean;
}

// ── Erros ────────────────────────────────────────────────────────────────────

/**
 * Forma do erro lancado pelo client. Espelha o `throw { status, data }` de
 * frontend/src/lib/api.js — mantido para nao divergir do web, mas tipado.
 */
export interface ApiErrorData {
  error?: string;
  detail?: string;
  /** Presente quando error === 'reading_time' (complete_item antes do tempo). */
  wait_seconds?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  data: ApiErrorData | null;

  constructor(status: number, data: ApiErrorData | null) {
    super(data?.error || data?.detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  /** complete_item recusou: o tempo minimo de leitura ainda nao passou. */
  get isReadingTime(): boolean {
    return this.data?.error === 'reading_time';
  }

  get waitSeconds(): number {
    return this.data?.wait_seconds ?? 0;
  }
}
