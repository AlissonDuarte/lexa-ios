import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import type { Gamification, RankingEntry, Tier } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { GameTopBar } from '../../src/components/GameTopBar';
import { GrowBar, Pop } from '../../src/components/motion';
import { colors, fonts, radius } from '../../src/theme/tokens';

/**
 * Liga — porte de frontend/src/routes/ranking/+page.svelte.
 *
 * A web identifica "voce" na lista por `player.id === $authStore.user?.id`, mas
 * o UserSerializer nao expoe `id`: a comparacao e sempre falsa e o destaque
 * nunca aparece. Aqui casamos por `username`, que os dois lados tem e e unico.
 */

const LEAGUES: { id: Tier; name: string; color: string; dark: string }[] = [
  { id: 'bronze', name: 'Bronze', color: '#C99065', dark: '#9C6E48' },
  { id: 'prata', name: 'Prata', color: '#9AB0BD', dark: '#73848E' },
  { id: 'ouro', name: 'Ouro', color: '#F2C94C', dark: '#C09923' },
  { id: 'platina', name: 'Platina', color: '#7DD3FC', dark: '#0EA5E9' },
  { id: 'diamante', name: 'Diamante', color: '#C4B5FD', dark: '#7C3AED' },
];

const PROMOTE_TOP = 3;
/** Altura do degrau por colocacao, como na web (1o mais alto). */
const STEP_HEIGHT = [92, 72, 56];
const MEDALS = ['🥇', '🥈', '🥉'];
/** Cor do degrau por colocacao: ouro, prata, bronze — nao a cor da liga atual. */
const PODIUM_COLOR = ['#F2C94C', '#9AB0BD', '#C99065'];

function displayName(e?: RankingEntry) {
  return e?.first_name || e?.username || '';
}

/** Faixa "ZONA DE PROMOCAO" / "ZONA DE QUEDA": linha, pilula, linha. */
function ZoneDivider({ up }: { up: boolean }) {
  const line = up ? colors.success : colors.streak;
  const bg = up ? colors['success-soft'] : '#FFE9D2';
  const borderColor = up ? '#C2E4C8' : '#F5C896';
  const fg = up ? '#3F8B4A' : '#B85020';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: line }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: bg,
          borderColor,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={11} color={fg} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: fg, letterSpacing: 0.3 }}>
          {up ? 'ZONA DE PROMOÇÃO' : 'ZONA DE QUEDA'}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: line }} />
    </View>
  );
}

export default function Liga() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [gami, setGami] = useState<Gamification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, g] = await Promise.all([api.getRanking(), api.getMyGamification()]);
      setRanking(r);
      setGami(g);
      setError(null);
    } catch {
      setError('Não foi possível carregar a liga.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
    // A web repolla a cada 30s. Aqui o pull-to-refresh cobre o caso, e um timer
    // rodando em background so gastaria bateria e dados do usuario.
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const tier = (gami?.tier ?? user?.tier ?? 'bronze').toLowerCase();
  const leagueIdx = Math.max(0, LEAGUES.findIndex((l) => l.id === tier));
  const league = LEAGUES[leagueIdx];

  const top3 = ranking.slice(0, 3);
  // A web abre a zona de queda antes do penultimo (`i + 1 === length - 1`),
  // deixando os dois ultimos abaixo da linha, e some com ela abaixo de 10
  // competidores. -1 nunca casa com uma posicao, entao serve de "sem linha".
  const demoteFrom = ranking.length >= 10 ? ranking.length - 1 : -1;

  const myIndex = useMemo(
    () => ranking.findIndex((e) => e.username === user?.username),
    [ranking, user?.username],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <GameTopBar streak={gami?.streak_atual ?? user?.streak_atual ?? 0} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {error ? (
          <View
            style={{
              margin: 20,
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

        {/* ── Cabecalho da liga ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Pop>
            <LinearGradient
              colors={[league.color, league.dark]}
              style={{
                borderRadius: 26,
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 18,
                borderBottomWidth: 4,
                borderBottomColor: league.dark,
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trophy" size={32} color="#FFFAF2" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.85)',
                      letterSpacing: 0.5,
                    }}
                  >
                    LIGA {league.name.toUpperCase()}
                  </Text>
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: '#FFFFFF' }}>
                    {ranking.length} {ranking.length === 1 ? 'competidor' : 'competidores'}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.bodySemi,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.85)',
                      marginTop: 2,
                    }}
                  >
                    Top {PROMOTE_TOP} sobem · Últimos caem
                  </Text>
                </View>
              </View>

              {/* Progresso entre ligas */}
              <View
                style={{ flexDirection: 'row', gap: 6, marginTop: 14, justifyContent: 'center' }}
              >
                {LEAGUES.map((l, i) => (
                  <View
                    key={l.id}
                    style={{
                      height: 8,
                      width: i === leagueIdx ? 28 : 8,
                      borderRadius: 4,
                      backgroundColor: i === leagueIdx ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    }}
                  />
                ))}
              </View>
            </LinearGradient>
          </Pop>
        </View>

        {/* ── Podio ──────────────────────────────────────────────────────── */}
        {top3.length >= 3 ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 20,
                paddingTop: 20,
              }}
            >
              {/* Ordem visual 2-1-3, nao a ordem do ranking. */}
              {[1, 0, 2].map((idx) => {
                const entry = top3[idx];
                const isMe = entry?.username === user?.username;
                const medalColor = PODIUM_COLOR[idx];
                return (
                  <View key={idx} style={{ flex: 1, maxWidth: 100, alignItems: 'center' }}>
                    {/* Coroa so no 1o lugar; os outros reservam a mesma altura
                        para os tres avatares ficarem alinhados. */}
                    <View style={{ height: 22, justifyContent: 'center' }}>
                      {idx === 0 ? <Text style={{ fontSize: 20 }}>👑</Text> : null}
                    </View>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: colors.card,
                        borderWidth: 3,
                        borderColor: medalColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{MEDALS[idx]}</Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.display,
                        fontSize: 13,
                        color: isMe ? colors.primary : colors.text,
                        textAlign: 'center',
                      }}
                    >
                      {isMe ? 'Você' : displayName(entry)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.bodyBold,
                        fontSize: 11,
                        color: colors.muted,
                        marginBottom: 6,
                      }}
                    >
                      {(entry?.xp ?? 0).toLocaleString('pt-BR')} XP
                    </Text>

                    {/* Degrau: cresce da base, espelhando a transicao da web. */}
                    <View
                      style={{
                        width: '100%',
                        height: STEP_HEIGHT[idx],
                        justifyContent: 'flex-end',
                      }}
                    >
                      <GrowBar
                        pct={1}
                        horizontal={false}
                        delay={200 + idx * 120}
                        style={{
                          width: '100%',
                          backgroundColor: medalColor,
                          borderTopLeftRadius: 14,
                          borderTopRightRadius: 14,
                          borderBottomLeftRadius: 6,
                          borderBottomRightRadius: 6,
                          alignItems: 'center',
                          paddingTop: 6,
                        }}
                      >
                        <Text
                          style={{ fontFamily: fonts.displayBold, fontSize: 22, color: '#FFFFFF' }}
                        >
                          {idx + 1}
                        </Text>
                      </GrowBar>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <ZoneDivider up />
            </View>
          </>
        ) : null}

        {/* ── Lista completa ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 6 }}>
          {ranking.length === 0 && !error ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: radius.lg,
                padding: 40,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 44, marginBottom: 10 }}>🏆</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted }}>
                Nenhum competidor ainda.
              </Text>
            </View>
          ) : null}

          {ranking.map((player, i) => {
            const isMe = i === myIndex;
            const rank = player.posicao;
            return (
              <View key={player.id}>
                {rank === demoteFrom ? <ZoneDivider up={false} /> : null}
                <Pop delay={Math.min(i, 8) * 40}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: radius.lg,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isMe ? colors['primary-light'] : colors.card,
                      borderWidth: isMe ? 2 : 1,
                      borderColor: isMe ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        width: 26,
                        textAlign: 'center',
                        fontFamily: fonts.displayBold,
                        fontSize: 16,
                        color: rank <= PROMOTE_TOP ? colors.primary : colors.muted,
                      }}
                    >
                      {rank}
                    </Text>

                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: colors.text }}>
                        {(displayName(player)[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}
                    >
                      {isMe ? 'Você' : displayName(player)}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="flash" size={14} color={colors.accent} />
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>
                        {player.xp.toLocaleString('pt-BR')}
                      </Text>
                    </View>
                  </View>
                </Pop>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
