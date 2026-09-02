import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import type { Achievement, Gamification } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { GameTopBar } from '../../src/components/GameTopBar';
import { GrowBar, Pop, Sway } from '../../src/components/motion';
import { PushButton } from '../../src/components/PushButton';
import { colors, fonts, radius } from '../../src/theme/tokens';

/** Porte de frontend/src/routes/perfil/+page.svelte. */

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  platina: 'Platina',
  diamante: 'Diamante',
};

/** Nivel e puramente derivado do XP: 1.000 XP por nivel, como na web. */
const XP_PER_LEVEL = 1000;
const BADGE_SLOTS = 8;

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

function StatCard({
  icon,
  iconColor,
  value,
  label,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
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
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: colors['primary-tint'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
            {value}
          </Text>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted }}>
            {label}
          </Text>
        </View>
      </View>
    </Pop>
  );
}

export default function Perfil() {
  const { user, signOut, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [gami, setGami] = useState<Gamification | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Um provedor fora do ar nao pode levar o outro junto: o perfil ainda
    // renderiza com o que o AuthContext tem.
    const [g, a] = await Promise.all([
      api.getMyGamification().catch(() => null),
      api.getAchievements().catch(() => [] as Achievement[]),
    ]);
    if (g) setGami(g);
    setAchievements(a);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const xp = gami?.xp ?? user?.xp ?? 0;
  const tier = (gami?.tier ?? user?.tier ?? 'bronze').toLowerCase();
  const isPremium = gami?.is_premium ?? user?.is_premium ?? false;
  const shields = gami?.streak_shields ?? 0;

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;

  const { previewBadges, earnedCount } = useMemo(() => {
    const earned = achievements
      .filter((a) => a.earned)
      .sort(
        (a, b) =>
          new Date(b.conquistado_em ?? 0).getTime() - new Date(a.conquistado_em ?? 0).getTime(),
      )
      .slice(0, BADGE_SLOTS);
    return {
      previewBadges: [
        ...earned,
        ...Array<null>(Math.max(0, BADGE_SLOTS - earned.length)).fill(null),
      ],
      earnedCount: achievements.filter((a) => a.earned).length,
    };
  }, [achievements]);

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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Identidade ─────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center' }}>
          <Sway>
            <Text style={{ fontSize: 92 }}>🐱</Text>
          </Sway>
          <Text
            style={{ fontFamily: fonts.displayBold, fontSize: 26, color: colors.text, marginTop: 4 }}
          >
            {user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : user?.username}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>
            @{user?.username}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Ionicons name="trophy" size={15} color={colors['text-soft']} />
              <Text style={{ fontFamily: fonts.display, fontSize: 13, color: colors.text }}>
                Nível {level} · {TIER_LABEL[tier] ?? 'Bronze'}
              </Text>
            </View>

            {isPremium ? (
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: radius.pill,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name="star" size={15} color="#FFFFFF" />
                <Text style={{ fontFamily: fonts.display, fontSize: 13, color: '#FFFFFF' }}>
                  Premium
                </Text>
              </LinearGradient>
            ) : (
              <View
                style={{
                  justifyContent: 'center',
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 2,
                  borderRadius: radius.pill,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ fontFamily: fonts.display, fontSize: 13, color: colors.muted }}>
                  Gratuito
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Barra de nivel ─────────────────────────────────────────────── */}
        <View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}
          >
            <Text
              style={{
                fontFamily: fonts.bodyBold,
                fontSize: 12,
                color: colors.muted,
                letterSpacing: 0.5,
              }}
            >
              NÍVEL {level}
            </Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
              {xpInLevel.toLocaleString('pt-BR')} / {XP_PER_LEVEL.toLocaleString('pt-BR')} XP
            </Text>
          </View>
          <View
            style={{
              height: 14,
              backgroundColor: colors['border-soft'],
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}
          >
            <GrowBar
              pct={xpInLevel / XP_PER_LEVEL}
              style={{ height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill }}
            />
          </View>
        </View>

        {/* ── Estatisticas (2x2) ─────────────────────────────────────────── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              icon="flame"
              iconColor={colors.streak}
              value={gami?.streak_atual ?? user?.streak_atual ?? 0}
              label="Sequência"
              delay={0}
            />
            <StatCard
              icon="flash"
              iconColor={colors.accent}
              value={xp.toLocaleString('pt-BR')}
              label="XP total"
              delay={60}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard
              icon="medal"
              iconColor={colors.accent}
              value={earnedCount}
              label="Conquistas"
              delay={120}
            />
            <StatCard
              icon="trophy"
              iconColor={colors.primary}
              value={TIER_LABEL[tier] ?? 'Bronze'}
              label="Liga atual"
              delay={180}
            />
          </View>
        </View>

        {/* ── Streak Shield (so premium, como na web) ────────────────────── */}
        {isPremium ? (
          <Pop delay={220}>
            <LinearGradient
              colors={['#FFF8EC', '#FFF3D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: colors.accent,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,209,102,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>🛡️</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.text }}>
                  Streak Shield
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.bodySemi,
                    fontSize: 12,
                    color: colors.muted,
                    marginTop: 2,
                  }}
                >
                  {shields > 0
                    ? `${shields} escudo${shields > 1 ? 's' : ''} disponíve${shields > 1 ? 'is' : 'l'} — seu streak está protegido`
                    : 'Nenhum escudo disponível no momento'}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.displayBold,
                  fontSize: 22,
                  color: shields > 0 ? colors.primary : '#C8BFB5',
                }}
              >
                {shields}
              </Text>
            </LinearGradient>
          </Pop>
        ) : null}

        {/* ── Conquistas ─────────────────────────────────────────────────── */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.text }}>
              Conquistas
            </Text>
            <Pressable onPress={() => router.push('/conquistas')} hitSlop={8}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.primary }}>
                Ver tudo ›
              </Text>
            </Pressable>
          </View>

          {/* 4 colunas: space-between distribui a folga entre elas, o que nao
              depende de acertar a largura no decimal. */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 8,
            }}
          >
            {previewBadges.map((a, i) => (
              <Pop key={a?.slug ?? `vazio-${i}`} delay={i * 40} style={{ width: '23%' }}>
                <View
                  style={{
                    aspectRatio: 1,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: a ? a.cor : colors['border-soft'],
                    borderWidth: 2,
                    borderColor: a ? a.cor : '#D5C9B2',
                    borderStyle: a ? 'solid' : 'dashed',
                  }}
                >
                  {a ? <Text style={{ fontSize: 24 }}>{a.emoji}</Text> : null}
                </View>
              </Pop>
            ))}
          </View>

          <Text
            style={{
              fontFamily: fonts.bodyBold,
              fontSize: 11,
              color: colors.muted,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {earnedCount} de {achievements.length} conquistas desbloqueadas
          </Text>
        </View>

        {/* ── Privacidade ────────────────────────────────────────────────── */}
        <Card>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>
                Perfil privado
              </Text>
              <Text
                style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}
              >
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
    </View>
  );
}
