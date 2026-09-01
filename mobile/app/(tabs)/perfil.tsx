import { useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import { TIER_THRESHOLDS } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { PushButton } from '../../src/components/PushButton';
import { colors, fonts, radius } from '../../src/theme/tokens';

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  platina: 'Platina',
  diamante: 'Diamante',
};

export default function Perfil() {
  const { user, signOut, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const xp = user?.xp ?? 0;
  const tier = user?.tier ?? 'bronze';

  // Progresso ate o proximo tier, a partir de User.TIER_THRESHOLDS.
  const currentIdx = TIER_THRESHOLDS.findIndex(([t]) => t === tier);
  const next = TIER_THRESHOLDS[currentIdx + 1];
  const currentFloor = TIER_THRESHOLDS[currentIdx]?.[1] ?? 0;
  const pct = next ? Math.min(1, (xp - currentFloor) / (next[1] - currentFloor)) : 1;

  async function togglePrivacy(value: boolean) {
    if (!user) return;
    setSavingPrivacy(true);
    setError(null);
    try {
      await api.updatePrivacy(value);
      // O PATCH devolve o user, mas atualizamos localmente para a UI nao
      // depender do formato da resposta.
      await updateUser({ ...user, perfil_privado: value });
    } catch {
      setError('Não foi possível salvar a preferência.');
    } finally {
      setSavingPrivacy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 16,
      }}
    >
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors['primary-light'],
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: 4,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 32, color: colors.primary }}>
            {(user?.first_name || user?.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 22,
            color: colors.text,
            marginTop: 12,
          }}
        >
          {user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : user?.username}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
          @{user?.username}
        </Text>
      </View>

      {/* Tier e progresso */}
      <Card>
        <Row label="Tier" value={TIER_LABEL[tier] ?? tier} />
        <Row label="XP total" value={String(xp)} />
        <Row label="Maior streak" value={`${user?.streak_maximo ?? 0} dias`} />

        <View
          style={{
            height: 10,
            backgroundColor: colors.border,
            borderRadius: radius.pill,
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${pct * 100}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 12,
            color: colors.muted,
            marginTop: 6,
          }}
        >
          {next ? `${next[1] - xp} XP para ${TIER_LABEL[next[0]]}` : 'Tier máximo atingido'}
        </Text>
      </Card>

      {/* Privacidade */}
      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>
              Perfil privado
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}>
              Esconde seu nome no ranking.
            </Text>
          </View>
          {savingPrivacy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={user?.perfil_privado ?? false}
              onValueChange={togglePrivacy}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          )}
        </View>
      </Card>

      {error ? (
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors['danger-dark'] }}>
          {error}
        </Text>
      ) : null}

      <PushButton label="Sair" variant="ghost" onPress={() => void signOut()} />
    </ScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>{value}</Text>
    </View>
  );
}
