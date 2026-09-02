import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../src/api/client';
import type {
  RoadmapIdea,
  RoadmapStats,
  RoadmapStatus,
  RoadmapCategory,
} from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { Pop, SlideUp } from '../src/components/motion';
import {
  CATS,
  FilterChip,
  IdeaCard,
  STATUS_META,
  fmtVotes,
} from '../src/components/roadmap';
import { colors, fonts, radius } from '../src/theme/tokens';
import { IdeaDetailSheet } from '../src/components/RoadmapDetailSheet';
import { SubmitIdeaSheet } from '../src/components/RoadmapSubmitSheet';

/**
 * Roadmap — porte de frontend/src/routes/roadmap/+page.svelte.
 *
 * A web e um kanban de 3 colunas que ja colapsa para uma so abaixo de 1080px;
 * aqui as tres secoes ficam empilhadas direto, que e o mesmo layout que o site
 * mostra no celular.
 *
 * Os modais viraram bottom sheets, e a ordenacao virou um grupo de chips: um
 * <select> nativo no iOS abriria um picker de roda para quatro opcoes.
 */

const SORTS = [
  { id: 'hot', label: '🔥 Em alta' },
  { id: 'top', label: 'Mais votados' },
  { id: 'new', label: 'Novos' },
  { id: 'old', label: 'Antigos' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

const STATUS_ORDER: RoadmapStatus[] = ['suggested', 'progress', 'shipped'];

export default function Roadmap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [ideas, setIdeas] = useState<RoadmapIdea[]>([]);
  const [stats, setStats] = useState<RoadmapStats>({
    ideas: 0,
    votes: 0,
    in_progress: 0,
    shipped: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<RoadmapStatus | 'all'>('all');
  const [activeCat, setActiveCat] = useState<RoadmapCategory | 'all'>('all');
  const [sort, setSort] = useState<SortId>('hot');
  const [search, setSearch] = useState('');

  const [votingId, setVotingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RoadmapIdea | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([api.getRoadmapIdeas(), api.getRoadmapStats()]);
      setIdeas(i);
      setStats(s);
      setError(null);
    } catch {
      setError('Não foi possível carregar o roadmap.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Filtro e ordenacao, do lado do cliente como na web ────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((i) => {
      if (activeCat !== 'all' && i.category !== activeCat) return false;
      if (!q) return true;
      const hay = `${i.title} ${i.description} ${i.author_display} ${CATS[i.category]?.label ?? ''}`;
      return hay.toLowerCase().includes(q);
    });
  }, [ideas, activeCat, search]);

  const sortIdeas = useCallback(
    (arr: RoadmapIdea[]) => {
      const a = [...arr];
      if (sort === 'top') return a.sort((x, y) => y.votes_count - x.votes_count);
      if (sort === 'new')
        return a.sort(
          (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
        );
      if (sort === 'old')
        return a.sort(
          (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime(),
        );
      // "Em alta": votos amortecidos pela idade, mesma formula da web e do backend.
      const now = Date.now();
      const score = (i: RoadmapIdea) => {
        const ageDays = (now - new Date(i.created_at).getTime()) / 86400000;
        return i.votes_count / Math.pow(ageDays + 2, 0.4);
      };
      return a.sort((x, y) => score(y) - score(x));
    },
    [sort],
  );

  const statusCounts = useMemo(
    () => ({
      all: ideas.length,
      suggested: ideas.filter((i) => i.status === 'suggested').length,
      progress: ideas.filter((i) => i.status === 'progress').length,
      shipped: ideas.filter((i) => i.status === 'shipped').length,
    }),
    [ideas],
  );

  const catCounts = useMemo(() => {
    const acc = {} as Record<RoadmapCategory, number>;
    (Object.keys(CATS) as RoadmapCategory[]).forEach((k) => {
      acc[k] = ideas.filter((i) => i.category === k).length;
    });
    return acc;
  }, [ideas]);

  const visibleStatuses = activeStatus === 'all' ? STATUS_ORDER : [activeStatus];

  // ── Acoes ─────────────────────────────────────────────────────────────────
  const requireAuth = useCallback(() => {
    if (token) return true;
    router.push('/(auth)/login');
    return false;
  }, [router, token]);

  const handleVote = useCallback(
    async (idea: RoadmapIdea) => {
      if (!requireAuth()) return;
      if (idea.status === 'shipped' || votingId !== null) return;
      setVotingId(idea.id);
      try {
        const res = await api.voteRoadmapIdea(idea.id);
        const patch = { has_voted: res.has_voted, votes_count: res.votes_count };
        setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, ...patch } : i)));
        // O sheet aberto mostra o mesmo objeto: sem isto ele ficaria defasado.
        setDetail((d) => (d && d.id === idea.id ? { ...d, ...patch } : d));
      } catch {
        setError('Não foi possível registrar seu voto.');
      } finally {
        setVotingId(null);
      }
    },
    [requireAuth, votingId],
  );

  const handleCreated = useCallback((idea: RoadmapIdea) => {
    setIdeas((list) => [idea, ...list]);
    setStats((s) => ({ ...s, ideas: s.ideas + 1 }));
    setShowSubmit(false);
  }, []);

  const handleCommented = useCallback((ideaId: number) => {
    setIdeas((list) =>
      list.map((i) => (i.id === ideaId ? { ...i, comments_count: i.comments_count + 1 } : i)),
    );
    setDetail((d) => (d && d.id === ideaId ? { ...d, comments_count: d.comments_count + 1 } : d));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* ── Cabecalho com a volta ao dashboard ───────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={() => router.replace('/(tabs)/dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={16} color={colors.muted} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors['text-soft'] }}>
            Início
          </Text>
        </Pressable>

        <Text style={{ flex: 1, fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
          Roadmap
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Abertura ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 30, color: colors.text }}>
            O que vem por aí.
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 21,
              color: colors.muted,
              marginTop: 6,
            }}
          >
            Toda feature do Lexa nasce aqui. Vote no que importa pra você, sugira o que tá faltando,
            acompanhe o que tá saindo do forno.
          </Text>
        </View>

        {/* ── Números ────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 18, gap: 8 }}>
          {(
            [
              [stats.ideas, 'na fila'],
              [fmtVotes(stats.votes), 'votos'],
              [stats.in_progress, 'em obra'],
              [stats.shipped, 'no ar'],
            ] as const
          ).map(([value, label], i) => (
            <Pop key={label} delay={i * 60} style={{ flex: 1 }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
                  {value}
                </Text>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted }}>
                  {label}
                </Text>
              </View>
            </Pop>
          ))}
        </View>

        {/* ── Busca ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.pill,
              paddingHorizontal: 14,
            }}
          >
            <Ionicons name="search" size={16} color={colors['muted-soft']} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Procurar ideia, palavra-chave, autor…"
              placeholderTextColor={colors['muted-soft']}
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 10,
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.text,
              }}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Limpar busca">
                <Ionicons name="close-circle" size={16} color={colors['muted-soft']} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Filtro por status ──────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14 }}
        >
          <FilterChip
            label="Todos"
            count={statusCounts.all}
            active={activeStatus === 'all'}
            color={colors.muted}
            onPress={() => setActiveStatus('all')}
          />
          {STATUS_ORDER.map((s) => (
            <FilterChip
              key={s}
              label={`${STATUS_META[s].emoji} ${STATUS_META[s].short}`}
              count={statusCounts[s]}
              color={STATUS_META[s].color}
              active={activeStatus === s}
              onPress={() => setActiveStatus(s)}
            />
          ))}
        </ScrollView>

        {/* ── Filtro por categoria ───────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 8 }}
        >
          <FilterChip
            label="Todas categorias"
            count={ideas.length}
            active={activeCat === 'all'}
            color={colors.muted}
            onPress={() => setActiveCat('all')}
          />
          {(Object.keys(CATS) as RoadmapCategory[]).map((k) => (
            <FilterChip
              key={k}
              label={`${CATS[k].emoji} ${CATS[k].label}`}
              count={catCounts[k]}
              color={CATS[k].color}
              active={activeCat === k}
              onPress={() => setActiveCat(k)}
            />
          ))}
        </ScrollView>

        {/* ── Ordenação ──────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}
        >
          <Text
            style={{
              alignSelf: 'center',
              fontFamily: fonts.bodySemi,
              fontSize: 12,
              color: colors.muted,
              marginRight: 2,
            }}
          >
            Ordenar
          </Text>
          {SORTS.map((s) => (
            <FilterChip
              key={s.id}
              label={s.label}
              active={sort === s.id}
              onPress={() => setSort(s.id)}
            />
          ))}
        </ScrollView>

        {error ? (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 14,
              backgroundColor: colors['danger-soft'],
              borderRadius: radius.md,
              padding: 12,
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors['danger-dark'] }}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* ── Seções ─────────────────────────────────────────────────────── */}
        {visibleStatuses.map((s) => {
          const meta = STATUS_META[s];
          const list = sortIdeas(filtered.filter((i) => i.status === s));
          return (
            <View key={s} style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: meta.color,
                  }}
                />
                <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 16, color: colors.text }}>
                  {meta.label}
                </Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted }}>
                  {list.length}
                </Text>
              </View>

              {list.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderRadius: radius.lg,
                    padding: 24,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodySemi,
                      fontSize: 13,
                      color: colors.muted,
                      textAlign: 'center',
                    }}
                  >
                    {meta.empty}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {list.map((idea, i) => (
                    <Pop key={idea.id} delay={Math.min(i, 6) * 40}>
                      <IdeaCard
                        idea={idea}
                        busy={votingId === idea.id}
                        onVote={() => void handleVote(idea)}
                        onOpen={() => setDetail(idea)}
                      />
                    </Pop>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Chamada fixa para sugerir ─────────────────────────────────────── */}
      <SlideUp
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => {
            if (requireAuth()) setShowSubmit(true);
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            borderBottomWidth: pressed ? 2 : 4,
            borderBottomColor: colors['primary-dark'],
            borderRadius: radius.lg,
            paddingVertical: 14,
          })}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: '#FFFFFF' }}>
            Sugerir ideia
          </Text>
        </Pressable>
      </SlideUp>

      <SubmitIdeaSheet
        visible={showSubmit}
        onClose={() => setShowSubmit(false)}
        onCreated={handleCreated}
      />

      <IdeaDetailSheet
        idea={detail}
        voting={detail !== null && votingId === detail.id}
        onClose={() => setDetail(null)}
        onVote={() => detail && void handleVote(detail)}
        onCommented={handleCommented}
        isAuth={!!token}
        onRequireAuth={() => {
          setDetail(null);
          router.push('/(auth)/login');
        }}
      />
    </View>
  );
}
