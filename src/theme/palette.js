/**
 * Paleta Lexa — copia fiel de frontend/tailwind.config.js (theme.extend.colors.lexa).
 *
 * CommonJS de proposito: tailwind.config.js precisa dar require() nisto, e um
 * .ts nao e carregavel de la. O tokens.ts tipado importa deste arquivo, entao a
 * paleta existe uma vez so.
 */
module.exports = {
  // Warm cream palette
  bg: '#FDF6E9',
  surface: '#FFF9F0',
  card: '#FFFFFF',
  border: '#EFE5D3',
  'border-soft': '#F4ECDE',

  // Text
  text: '#1F1A17',
  'text-soft': '#4A3F35',
  muted: '#8B7E73',
  'muted-soft': '#B8AC9F',

  // Primary: warm orange
  primary: '#FF8C42',
  'primary-dark': '#D86F2A',
  'primary-light': '#FFEFD9',
  'primary-tint': '#FFF5E8',

  // Accent: golden yellow
  accent: '#FFD166',
  'accent-dark': '#D7A938',
  'accent-soft': '#FFF6D0',

  // Subjects (law colors)
  'law-const': '#FF8C42',
  'law-penal': '#FF4757',
  'law-civil': '#6BCB77',
  'law-adm': '#4A9EFF',
  'law-proc': '#A78BFA',

  // Status
  success: '#6BCB77',
  'success-dark': '#4DA85C',
  'success-soft': '#E8F7EA',

  danger: '#FF4757',
  'danger-dark': '#C82E3C',
  'danger-soft': '#FFE5EA',

  // Streak fire
  streak: '#FF6B35',
  'streak-dark': '#D84F1A',

  // Gems / XP
  gem: '#4ECDC4',

  // Hearts
  heart: '#FF4757',
};
