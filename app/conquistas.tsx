import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../src/api/client';
import type { Achievement } from '../src/api/types';
import { GrowBar, Pop } from '../src/components/motion';
import { colors, fonts, radius } from '../src/theme/tokens';

/** Porte de frontend/src/routes/conquistas/+page.svelte. */

const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'consistencia', label: 'Consistência' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'precisao', label: 'Precisão' },
  { id: 'habito', label: 'Hábito' },
] as const;

const RARITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  comum: { bg: '#F0F4F7', text: '#9AB0BD', border: '#D5E0E8' },
  raro: { bg: '#EFF6FF', text: '#4A9EFF', border: '#BFD9FF' },
  epico: { bg: '#F3F0FF', text: '#A78BFA', border: '#DDD6FF' },
  lendario: { bg: '#FFFBEB', text: '#F2C94C', border: '#FFE99B' },
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Conquistas() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    api
      .getAchievements()
      .then(setAchievements)
      .catch(() => setError('Não foi possível carregar as conquistas.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (category === 'all' ? achievements : achievements.filter((a) => a.categoria === category)),
    [achievements, category],
  );

  const earned = achievements.filter((a) => a.earned).length;
  const total = achievements.length;
  const pct = total > 0 ? earned / total : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* ── Cabecalho ────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
        </Pressable>

        <Text style={{ flex: 1, fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
          Conquistas
        </Text>

        {!loading ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Ionicons name="medal" size={13} color={colors.primary} />
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 12, color: colors.text }}>
              {earned}/{total}
            </Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {error ? (
            <View
              style={{
                margin: 20,
                backgroundColor: colors['danger-soft'],
                borderRadius: radius.md,
                padding: 12,
              }}
            >
              <Text
                style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors['danger-dark'] }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* ── Progresso ──────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <View
              style={{
                height: 10,
                backgroundColor: colors.border,
                borderRadius: radius.pill,
                overflow: 'hidden',
              }}
            >
              <GrowBar pct={pct} style={{ height: '100%' }}>
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: radius.pill }}
                />
              </GrowBar>
            </View>
            <Text
              style={{
                fontFamily: fonts.bodyBold,
                fontSize: 11,
                color: colors.muted,
                marginTop: 6,
                textAlign: 'right',
              }}
            >
              {Math.round(pct * 100)}% desbloqueado
            </Text>
          </View>

          {/* ── Filtro por categoria ───────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            {CATEGORIES.map((cat) => {
              const active = cat.id === category;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={{
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors['primary-dark'] : colors.border,
                    borderWidth: active ? 2 : 1,
                    borderBottomWidth: active ? 3 : 1,
                    borderRadius: radius.pill,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 13,
                      color: active ? '#FFFFFF' : colors.text,
                    }}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Lista ──────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {filtered.map((badge, i) => {
              const rc = RARITY_COLOR[badge.raridade] ?? RARITY_COLOR.comum;
              const isEarned = badge.earned;
              return (
                <Pop key={badge.slug} delay={Math.min(i, 8) * 40}>
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 18,
                      borderWidth: 1,
                      // `+ '66'` da web e alfa em hex; aqui a cor da badge ja
                      // basta para diferenciar o card conquistado.
                      borderColor: isEarned ? badge.cor : colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}
                    >
                      <View
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isEarned ? badge.cor : colors['border-soft'],
                          borderWidth: 2,
                          borderColor: isEarned ? badge.cor : '#D5C9B2',
                          borderStyle: isEarned ? 'solid' : 'dashed',
                          // A web usa grayscale(1) opacity(.45); o RN nao tem
                          // filtro CSS, entao a opacidade sozinha faz o papel.
                          opacity: isEarned ? 1 : 0.45,
                        }}
                      >
                        <Text style={{ fontSize: 26 }}>{isEarned ? badge.emoji : '?'}</Text>
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fonts.displayBold,
                              fontSize: 15,
                              color: isEarned ? colors.text : colors['muted-soft'],
                            }}
                          >
                            {badge.nome}
                          </Text>
                          <View
                            style={{
                              backgroundColor: rc.bg,
                              borderColor: rc.border,
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: fonts.bodyBold,
                                fontSize: 9,
                                color: rc.text,
                                letterSpacing: 0.4,
                              }}
                            >
                              {badge.raridade_label.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={{
                            fontFamily: fonts.bodySemi,
                            fontSize: 12,
                            color: isEarned ? colors.muted : '#C8BFB5',
                            marginTop: 2,
                          }}
                        >
                          {badge.descricao}
                        </Text>

                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}
                        >
                          <Text
                            style={{
                              fontFamily: fonts.bodyBold,
                              fontSize: 11,
                              color: isEarned ? badge.cor : colors.muted,
                            }}
                          >
                            {isEarned && badge.conquistado_em
                              ? `✓ ${formatDate(badge.conquistado_em)}`
                              : 'Não conquistada'}
                          </Text>
                          <Text
                            style={{
                              flex: 1,
                              textAlign: 'right',
                              fontFamily: fonts.bodyBold,
                              fontSize: 11,
                              color: colors.muted,
                            }}
                          >
                            {badge.pct_usuarios}% dos usuários
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isEarned ? (
                      <LinearGradient
                        colors={[badge.cor, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ height: 3 }}
                      />
                    ) : null}
                  </View>
                </Pop>
              );
            })}

            {filtered.length === 0 && !error ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🏆</Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted }}>
                  Nenhuma conquista nesta categoria.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
