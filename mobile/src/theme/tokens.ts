/**
 * Design tokens portados de frontend/tailwind.config.js.
 *
 * Fonte de verdade compartilhada entre o NativeWind (tailwind.config.js deste
 * projeto consome este arquivo) e os componentes que usam StyleSheet direto.
 * Ao mudar uma cor na web, espelhar aqui.
 */

import palette from './palette';

export const colors = palette as Record<string, string> & {
  bg: string; surface: string; card: string; border: string;
  text: string; muted: string; primary: string; 'primary-dark': string;
  accent: string; success: string; danger: string; streak: string; gem: string;
};

export type ColorName = keyof typeof colors;

/**
 * Metadados visuais por lei. Espelha o mapa LAW_COLORS de
 * frontend/src/routes/dashboard/+page.svelte, que estende os law-* do Tailwind
 * com lep/trib/trab e carrega tambem a cor de profundidade, a sigla e o rotulo
 * curto usados na trilha e nas abas.
 */
export interface LawMeta {
  color: string;
  dark: string;
  code: string;
  short: string;
}

const LAW_META: Record<string, LawMeta> = {
  const: { color: '#FF8C42', dark: '#D86F2A', code: 'CF', short: 'Const.' },
  cf: { color: '#FF8C42', dark: '#D86F2A', code: 'CF', short: 'Const.' },
  penal: { color: '#FF4757', dark: '#C82E3C', code: 'CP', short: 'Penal' },
  cp: { color: '#FF4757', dark: '#C82E3C', code: 'CP', short: 'Penal' },
  civil: { color: '#6BCB77', dark: '#4DA85C', code: 'CC', short: 'Civil' },
  cc: { color: '#6BCB77', dark: '#4DA85C', code: 'CC', short: 'Civil' },
  adm: { color: '#4A9EFF', dark: '#2B7BDC', code: 'DA', short: 'Adm.' },
  proc: { color: '#A78BFA', dark: '#7C5CFF', code: 'DP', short: 'Proc.' },
  lep: { color: '#F87171', dark: '#DC2626', code: 'LE', short: 'LEP' },
  trib: { color: '#34D399', dark: '#059669', code: 'CT', short: 'Trib.' },
  trab: { color: '#FBBF24', dark: '#D97706', code: 'CL', short: 'Trab.' },
};

/**
 * Casa por substring do slug, na ordem de insercao — mesma semantica do
 * `slug.includes(key)` da web.
 */
export function lawMeta(law?: { slug?: string; nome?: string } | null): LawMeta {
  const slug = (law?.slug || '').toLowerCase();
  for (const [key, meta] of Object.entries(LAW_META)) {
    if (slug.includes(key)) return meta;
  }
  return {
    color: colors.primary,
    dark: colors['primary-dark'],
    code: (law?.nome || '?').slice(0, 2).toUpperCase(),
    short: law?.nome || 'Lei',
  };
}

export const pushDepth = {
  button: 4,
  buttonSm: 3,
  card: 2,
  node: 6,
} as const;

export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  // Obrigatoria para texto legal: Agents.md exige fidelidade visual ao
  // documento oficial publicado.
  mono: 'JetBrainsMono_400Regular',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;
