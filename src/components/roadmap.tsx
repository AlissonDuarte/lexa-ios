/**
 * Pecas da tela de roadmap — porte de frontend/src/routes/roadmap/+page.svelte.
 *
 * Vivem fora de app/roadmap.tsx porque a tela ja e grande e estas partes sao
 * puramente visuais: card, pilha de avatares, chip de filtro e tag.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import type { RoadmapCategory, RoadmapIdea, RoadmapStatus, RoadmapVoter } from '../api/types';
import { colors, fonts, radius } from '../theme/tokens';
import { Pressed } from './Pressed';

export const CATS: Record<RoadmapCategory, { label: string; emoji: string; color: string }> = {
  content: { label: 'Conteúdo', emoji: '📚', color: '#E8642D' },
  gamif: { label: 'Gamificação', emoji: '🎮', color: '#A78BFA' },
  notif: { label: 'Notificações', emoji: '🔔', color: '#E2AD3C' },
  ui: { label: 'Interface', emoji: '🎨', color: '#E76A8C' },
  studies: { label: 'Estudos', emoji: '🧠', color: '#5BC5A3' },
  premium: { label: 'Premium', emoji: '💎', color: '#4A9EFF' },
  social: { label: 'Social', emoji: '👥', color: '#FF6B35' },
  bug: { label: 'Bug', emoji: '🐛', color: '#6F6359' },
};

export const STATUS_META: Record<
  RoadmapStatus,
  { label: string; short: string; emoji: string; color: string; empty: string }
> = {
  suggested: {
    label: '💡 Sugestões da galera',
    short: 'Sugestões',
    emoji: '💡',
    color: '#E2AD3C',
    empty: 'Sem sugestões ainda. Que tal mandar a primeira ideia? 👀',
  },
  progress: {
    label: '🚧 Em construção',
    short: 'Em construção',
    emoji: '🚧',
    color: '#E8642D',
    empty: 'Em breve. Logo logo aparece algo aqui.',
  },
  shipped: {
    label: '🚀 Já no ar',
    short: 'No ar',
    emoji: '🚀',
    color: '#2EBC6B',
    empty: 'A primeira feature shipada vai aparecer aqui.',
  },
};

const AVATAR_PALETTE = [
  '#E8642D',
  '#A78BFA',
  '#5BC5A3',
  '#E76A8C',
  '#4A9EFF',
  '#E2AD3C',
  '#FF6B35',
  '#6F6359',
];

/** Cor estavel por nome: o mesmo apoiador tem sempre o mesmo avatar. */
export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name || '?') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

export function fmtVotes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function catOf(category: RoadmapCategory) {
  return CATS[category] ?? { label: 'Outros', emoji: '✨', color: '#6F6359' };
}

/** Pilha de iniciais dos apoiadores, com "+N" quando passa do limite. */
export function AvatarStack({
  voters,
  max = 3,
  size = 26,
}: {
  voters: RoadmapVoter[];
  max?: number;
  size?: number;
}) {
  const shown = voters.slice(0, max);
  const rest = voters.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((v, i) => (
        <View
          key={`${v.name}-${i}`}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: avatarColor(v.name),
            borderWidth: 2,
            borderColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            // Sobreposicao: cada avatar entra por cima do anterior.
            marginLeft: i === 0 ? 0 : -size * 0.32,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.38, color: '#FFFFFF' }}>
            {v.initials}
          </Text>
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={{
            height: size,
            paddingHorizontal: 6,
            borderRadius: size / 2,
            backgroundColor: colors['border-soft'],
            borderWidth: 2,
            borderColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -size * 0.32,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.36, color: colors.muted }}>
            +{rest}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Etiqueta de categoria: fundo lavado na cor, texto na cor cheia. */
export function CategoryTag({ category }: { category: RoadmapCategory }) {
  const cat = catOf(category);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        // A web usa color-mix; o RN nao tem, entao a transparencia em hex faz o
        // mesmo papel de "14% da cor sobre branco".
        backgroundColor: `${cat.color}24`,
        borderColor: `${cat.color}38`,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontSize: 11 }}>{cat.emoji}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: cat.color }}>
        {cat.label}
      </Text>
    </View>
  );
}

/** Chip de filtro (status ou categoria). */
export function FilterChip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const tint = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: active ? tint : colors.card,
        borderColor: active ? tint : colors.border,
        borderWidth: active ? 2 : 1,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: 12,
          color: active ? '#FFFFFF' : colors['text-soft'],
        }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <View
          style={{
            minWidth: 20,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: radius.pill,
            backgroundColor: active ? 'rgba(255,255,255,0.28)' : colors['border-soft'],
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodyBold,
              fontSize: 11,
              color: active ? '#FFFFFF' : colors.muted,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Botao de voto do card: seta, contagem e rotulo, como na web. */
export function VoteButton({
  idea,
  busy,
  onPress,
}: {
  idea: RoadmapIdea;
  busy: boolean;
  onPress: () => void;
}) {
  // Ideia no ar nao aceita voto (o backend recusa com 400); vira um selo.
  if (idea.status === 'shipped') {
    return (
      <View
        style={{
          width: 56,
          borderRadius: radius.md,
          backgroundColor: STATUS_META.shipped.color,
          alignItems: 'center',
          paddingVertical: 8,
        }}
      >
        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: '#FFFFFF', marginTop: 2 }}>
          no ar
        </Text>
      </View>
    );
  }

  const voted = idea.has_voted;
  return (
    <Pressed
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={voted ? `Remover voto em ${idea.title}` : `Votar em ${idea.title}`}
      selected={voted}
      outerStyle={{ opacity: busy ? 0.5 : 1 }}
      style={(held) => ({
        width: 56,
        borderRadius: radius.md,
        backgroundColor: voted ? colors.primary : colors.surface,
        borderWidth: 2,
        borderColor: voted ? colors['primary-dark'] : colors.border,
        alignItems: 'center',
        paddingVertical: 8,
        transform: [{ scale: held ? 0.94 : 1 }],
      })}
    >
      <Ionicons name="arrow-up" size={14} color={voted ? '#FFFFFF' : colors.text} />
      <Text
        style={{
          fontFamily: fonts.displayBold,
          fontSize: 16,
          color: voted ? '#FFFFFF' : colors.text,
        }}
      >
        {idea.votes_count}
      </Text>
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: 10,
          color: voted ? '#FFFFFF' : colors.muted,
        }}
      >
        {voted ? 'votado' : 'votar'}
      </Text>
    </Pressed>
  );
}

/** Card de ideia: voto a esquerda, conteudo a direita. */
export function IdeaCard({
  idea,
  busy,
  onVote,
  onOpen,
}: {
  idea: RoadmapIdea;
  busy: boolean;
  onVote: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${idea.title}`}
      style={{
        flexDirection: 'row',
        gap: 12,
        backgroundColor: colors.card,
        borderColor: idea.is_mine ? colors.primary : colors.border,
        borderWidth: idea.is_mine ? 2 : 1,
        borderRadius: radius.lg,
        padding: 12,
      }}
    >
      <VoteButton idea={idea} busy={busy} onPress={onVote} />

      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.text }}>
          {idea.title}
        </Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
          {idea.description}
        </Text>

        {idea.status === 'progress' && idea.progress_pct !== null ? (
          <View style={{ marginTop: 2 }}>
            <View
              style={{
                height: 6,
                backgroundColor: colors['border-soft'],
                borderRadius: radius.pill,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${idea.progress_pct}%`,
                  backgroundColor: STATUS_META.progress.color,
                  borderRadius: radius.pill,
                }}
              />
            </View>
            <Text
              style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, marginTop: 4 }}
            >
              {idea.progress_pct}%{idea.eta ? ` · ETA ${idea.eta}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CategoryTag category={idea.category} />
          {idea.status === 'shipped' && idea.version ? (
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
              {idea.version}
            </Text>
          ) : null}
          {idea.voters_display.length > 0 ? <AvatarStack voters={idea.voters_display} /> : null}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}
          >
            <Ionicons name="chatbubble-outline" size={12} color={colors.muted} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted }}>
              {idea.comments_count}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
