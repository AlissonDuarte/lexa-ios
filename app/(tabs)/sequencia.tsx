import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import type { Gamification } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { GameTopBar } from '../../src/components/GameTopBar';
import { Mascot } from '../../src/components/Mascot';
import { Flicker, Pop } from '../../src/components/motion';
import { colors, fonts, radius } from '../../src/theme/tokens';

/**
 * Tela de streak — porte de frontend/src/routes/sequencia/+page.svelte.
 *
 * Dois campos que a web le nao existem no backend (`total_dias_estudados` e
 * `xp_semana`); ela ja cai em fallbacks, e aqui usamos os mesmos, para os dois
 * mostrarem o mesmo numero em vez de divergirem quando o campo aparecer.
 */

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function StatCard({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  suffix,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string | number;
  valueColor: string;
  suffix: string;
  delay: number;
}) {
  return (
    <Pop delay={delay} style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={20} color={iconColor} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted }}>
            {label}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 28, color: valueColor, marginTop: 2 }}>
          {value}
        </Text>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: colors.muted }}>
          {suffix}
        </Text>
      </View>
    </Pop>
  );
}

export default function Sequencia() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [gami, setGami] = useState<Gamification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setGami(await api.getMyGamification());
    } catch {
      // A tela ainda funciona com o que o AuthContext ja tem do usuario; um
      // erro aqui so mantem os numeros do login.
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

  const streak = gami?.streak_atual ?? user?.streak_atual ?? 0;
  const maxStreak = gami?.streak_maximo ?? user?.streak_maximo ?? 0;

  // Cresce com a raiz do streak: sobe rapido no comeco e satura em 175, igual a web.
  const flameSize = streak === 0 ? 72 : Math.min(Math.round(64 + Math.sqrt(streak) * 16), 175);

  const totalDays = maxStreak || streak;
  const xpWeek = 0;
  const nextAchievementDays = Math.max(0, maxStreak + 1 - streak);

  const { weekDone, weekCount, todayIdx } = useMemo(() => {
    const today = new Date().getDay();
    const done = Array.from({ length: 7 }, (_, i) => (today - i + 7) % 7 < streak);
    return { weekDone: done, weekCount: done.filter(Boolean).length, todayIdx: today };
  }, [streak]);

  const msgRecord =
    streak > 0 && maxStreak > 0
      ? streak >= maxStreak
        ? 'Você está fazendo seu recorde agora! 🚀'
        : `Mais ${maxStreak - streak + 1} ${maxStreak - streak + 1 === 1 ? 'dia' : 'dias'} e você bate seu recorde!`
      : 'Comece hoje e dê o primeiro passo! 🐾';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <GameTopBar streak={streak} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Chama ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Pop>
            <LinearGradient
              colors={['#FFEFD9', '#FCDDB0']}
              style={{
                borderRadius: 28,
                borderWidth: 1,
                borderColor: '#F0D9B0',
                paddingHorizontal: 18,
                paddingTop: 22,
                paddingBottom: 18,
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Text style={{ position: 'absolute', top: 16, right: 24, fontSize: 18 }}>✦</Text>
              <Text style={{ position: 'absolute', top: 36, left: 26, fontSize: 14 }}>✦</Text>
              <Text style={{ position: 'absolute', bottom: 30, right: 30, fontSize: 14 }}>✦</Text>

              <Flicker>
                <Text style={{ fontSize: flameSize, lineHeight: flameSize * 1.15 }}>🔥</Text>
              </Flicker>

              <Text
                style={{
                  fontFamily: fonts.displayBold,
                  fontSize: 64,
                  color: colors.text,
                  letterSpacing: -2,
                }}
              >
                {streak}
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>
                {streak === 1 ? 'dia seguido!' : 'dias seguidos!'}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.bodyBold,
                  fontSize: 13,
                  color: colors.muted,
                  marginTop: 10,
                  textAlign: 'center',
                }}
              >
                {streak === 0
                  ? 'Comece sua sequência hoje! 🐾'
                  : 'Você está em chamas, continue assim! 🐾'}
              </Text>
            </LinearGradient>
          </Pop>
        </View>

        {/* ── Esta semana ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.text }}>
              Esta semana
            </Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
              {weekCount} de 7 dias
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              paddingVertical: 14,
              paddingHorizontal: 10,
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            {DAY_LABELS.map((d, i) => {
              const isToday = i === todayIdx;
              const isDone = weekDone[i];
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 11,
                      color: isToday ? colors.primary : colors.muted,
                    }}
                  >
                    {d}
                  </Text>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDone
                        ? colors.streak
                        : isToday
                          ? colors.card
                          : colors['border-soft'],
                      borderWidth: isToday && !isDone ? 2 : 0,
                      borderColor: colors.primary,
                      borderStyle: isToday && !isDone ? 'dashed' : 'solid',
                    }}
                  >
                    {isDone ? (
                      <Ionicons name="flame" size={18} color={colors.accent} />
                    ) : isToday ? (
                      <Text
                        style={{ fontFamily: fonts.displayBold, fontSize: 14, color: colors.primary }}
                      >
                        ?
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Estatisticas (2x2) ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              icon="flame"
              iconColor={colors.streak}
              label="Maior sequência"
              value={maxStreak}
              valueColor={colors.streak}
              suffix="dias"
              delay={0}
            />
            <StatCard
              icon="book"
              iconColor={colors.primary}
              label="Total de dias"
              value={totalDays}
              valueColor={colors.primary}
              suffix="estudados"
              delay={60}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              icon="flash"
              iconColor={colors.accent}
              label="XP esta semana"
              value={xpWeek.toLocaleString('pt-BR')}
              valueColor={colors.gem}
              suffix="pontos"
              delay={120}
            />
            <StatCard
              icon="medal"
              iconColor={colors.accent}
              label="Próx. conquista"
              value={nextAchievementDays}
              valueColor={colors.accent}
              suffix="dias"
              delay={180}
            />
          </View>
        </View>

        {/* ── Mascote ────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <Pop delay={240}>
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Mascot size={72} variant="happy" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.text }}>
                  {msgRecord}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.bodySemi,
                    fontSize: 12,
                    color: colors.muted,
                    marginTop: 4,
                  }}
                >
                  {streak > 0
                    ? 'Estude hoje para não perder a sequência.'
                    : 'Uma leitura por dia já conta.'}
                </Text>
              </View>
            </View>
          </Pop>
        </View>
      </ScrollView>
    </View>
  );
}
