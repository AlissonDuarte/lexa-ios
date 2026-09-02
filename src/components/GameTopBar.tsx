/**
 * Barra superior de jogo — porte de frontend/src/components/game/GameTopBar.svelte.
 *
 * Aparece em todas as telas de aba na web (curso a esquerda, contadores a
 * direita). Gemas e vidas ainda nao existem no backend: /gamification/me/ nao
 * devolve `gemas` nem `vidas`, e a web ja cai nos mesmos defaults (0 e 5). Os
 * valores ficam como props para que ligar o backend depois seja trocar o
 * chamador, nao esta view.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme/tokens';

interface GameTopBarProps {
  /** Sigla da lei ativa (CF, CP...). Sem ela o bloco do curso some. */
  course?: string;
  courseColor?: string;
  courseDark?: string;
  streak?: number;
  gems?: number;
  lives?: number;
}

function Counter({
  icon,
  color,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number;
  onPress?: () => void;
}) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color }}>{value}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {content}
    </Pressable>
  );
}

export function GameTopBar({
  course,
  courseColor = colors.primary,
  courseDark = colors['primary-dark'],
  streak = 0,
  gems = 0,
  lives = 5,
}: GameTopBarProps) {
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {course ? (
        <View
          style={{
            width: 40,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: courseColor,
            borderBottomWidth: 2,
            borderBottomColor: courseDark,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.5 }}>
            {course}
          </Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      <Counter
        icon="flame"
        color={colors.streak}
        value={streak}
        onPress={() => router.navigate('/(tabs)/sequencia')}
      />
      <Counter icon="diamond" color={colors.gem} value={gems} />
      <Counter icon="heart" color={colors.heart} value={lives} />
    </View>
  );
}
