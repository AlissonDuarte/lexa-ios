import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthContext';
import { colors, fonts, radius } from '../../src/theme/tokens';

/**
 * Tela de streak — porte de frontend/src/routes/sequencia/+page.svelte.
 *
 * A chama cresce com o streak (a web anima com o keyframe lexaFlame; aqui a
 * animacao entra no v2 com Reanimated) e o calendario marca os dias do mes.
 */
export default function Sequencia() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const streak = user?.streak_atual ?? 0;
  const recorde = user?.streak_maximo ?? 0;

  // Tamanho da chama proporcional ao streak, com teto — mesma ideia da web.
  const flameSize = Math.min(120, 56 + streak * 4);

  const { days, today, monthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return {
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      today: now.getDate(),
      monthLabel: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ fontSize: flameSize }}>🔥</Text>
        <Text
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 44,
            color: colors.streak,
            marginTop: 4,
          }}
        >
          {streak}
        </Text>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.muted }}>
          {streak === 1 ? 'dia seguido' : 'dias seguidos'}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors['muted-soft'], marginTop: 6 }}>
          Recorde: {recorde} {recorde === 1 ? 'dia' : 'dias'}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 2,
          borderBottomWidth: 4,
          borderRadius: radius.lg,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 14,
            color: colors['text-soft'],
            marginBottom: 12,
            textTransform: 'capitalize',
          }}
        >
          {monthLabel}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {days.map((d) => {
            // O backend nao expoe o historico de dias por enquanto; marcamos a
            // janela coberta pelo streak atual, terminando hoje.
            const inStreak = d <= today && d > today - streak;
            const isToday = d === today;
            return (
              <View
                key={d}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: inStreak ? colors.streak : colors['border-soft'],
                  borderWidth: isToday ? 2 : 0,
                  borderColor: colors['streak-dark'],
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bodySemi,
                    fontSize: 12,
                    color: inStreak ? '#FFFFFF' : colors.muted,
                  }}
                >
                  {d}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
