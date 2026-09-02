import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import type { DailySequence, Law, SequenceItem } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { GameTopBar } from '../../src/components/GameTopBar';
import { PulseRing } from '../../src/components/motion';
import { PushButton } from '../../src/components/PushButton';
import { colors, fonts, lawMeta, radius } from '../../src/theme/tokens';

/** Deslocamento horizontal de cada no da trilha — igual ao ZIGZAG_OFFSETS da web. */
const ZIGZAG_OFFSETS = [0, 70, 120, 70, 0, -70, -120, -70];

type NodeStatus = 'done' | 'current' | 'locked';
type NodeKind = 'normal' | 'chest' | 'boss';

interface TrailNode {
  item: SequenceItem;
  status: NodeStatus;
  kind: NodeKind;
  label: string;
}

/** Espelha o bloco reativo `trailNodes` de dashboard/+page.svelte. */
function buildTrail(items: SequenceItem[]): TrailNode[] {
  const firstPending = items.findIndex((it) => !it.concluido);
  return items.slice(0, 8).map((item, i) => {
    let status: NodeStatus;
    if (item.concluido) status = 'done';
    else if (i === firstPending) status = 'current';
    else status = 'locked';

    const kind: NodeKind =
      (i + 1) % 5 === 0 ? 'boss' : (i + 1) % 4 === 0 ? 'chest' : 'normal';

    return {
      item,
      status,
      kind,
      label: `${item.tipo === 'novo' ? 'Novo' : 'Rev.'} · ${item.article?.numero ?? ''}`,
    };
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [laws, setLaws] = useState<Law[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [sequence, setSequence] = useState<DailySequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLaws = useCallback(async () => {
    try {
      const data = await api.getLaws();
      setLaws(data);
      setActiveSlug((current) => current ?? data[0]?.slug ?? null);
      setError(null);
    } catch {
      setError('Não foi possível carregar as leis.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSequence = useCallback(async (slug: string) => {
    setSequenceLoading(true);
    try {
      const data = await api.getTodaySequence(slug);
      setSequence(data);
    } catch {
      setSequence(null);
    } finally {
      setSequenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLaws();
  }, [loadLaws]);

  useEffect(() => {
    if (activeSlug) void loadSequence(activeSlug);
  }, [activeSlug, loadSequence]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLaws();
    if (activeSlug) await loadSequence(activeSlug);
    setRefreshing(false);
  }, [activeSlug, loadLaws, loadSequence]);

  const activeLaw = useMemo(
    () => laws.find((l) => l.slug === activeSlug) ?? laws[0],
    [laws, activeSlug],
  );
  const meta = useMemo(() => lawMeta(activeLaw), [activeLaw]);
  const trail = useMemo(() => buildTrail(sequence?.items ?? []), [sequence]);

  const done = sequence?.concluidos ?? 0;
  const total = sequence?.total ?? 0;
  const isDone = sequence?.concluida === true;

  function openLesson(node: TrailNode) {
    if (node.status === 'locked' || !activeSlug) return;
    router.push({ pathname: '/leitura', params: { law: activeSlug } });
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
      {/* Fixa fora do ScrollView, como na web: os contadores nao rolam junto. */}
      <GameTopBar
        course={meta.code}
        courseColor={meta.color}
        courseDark={meta.dark}
        streak={user?.streak_atual ?? 0}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text }}>
            Olá, {user?.first_name || user?.username}
          </Text>
        </View>

        {/* Abas de lei */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
        >
          {laws.map((law) => {
            const m = lawMeta(law);
            const active = law.slug === activeSlug;
            return (
              <Pressable
                key={law.slug}
                onPress={() => setActiveSlug(law.slug)}
                style={{
                  backgroundColor: active ? m.color : colors.card,
                  borderColor: active ? m.dark : colors.border,
                  borderWidth: 2,
                  borderBottomWidth: 3,
                  borderRadius: radius.pill,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 13,
                    color: active ? '#FFFFFF' : colors['text-soft'],
                  }}
                >
                  {m.short}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Progresso da sequência do dia */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
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
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted }}>
              {activeLaw?.nome ?? 'Sequência de hoje'}
            </Text>
            <Text
              style={{
                fontFamily: fonts.displayBold,
                fontSize: 22,
                color: colors.text,
                marginTop: 2,
              }}
            >
              {done} de {total} concluídos
            </Text>

            <View
              style={{
                height: 12,
                backgroundColor: colors.border,
                borderRadius: radius.pill,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: total > 0 ? `${(done / total) * 100}%` : '0%',
                  backgroundColor: meta.color,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          </View>
        </View>

        {error ? (
          <Text
            style={{
              fontFamily: fonts.body,
              color: colors['danger-dark'],
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            {error}
          </Text>
        ) : null}

        {/* Trilha zigzag */}
        {sequenceLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : trail.length === 0 ? (
          <Text
            style={{
              fontFamily: fonts.body,
              color: colors.muted,
              textAlign: 'center',
              marginTop: 40,
              paddingHorizontal: 40,
            }}
          >
            Nenhuma sequência para hoje nesta lei.
          </Text>
        ) : (
          <View style={{ alignItems: 'center', marginTop: 32, gap: 20 }}>
            {trail.map((node, i) => (
              <TrailNodeView
                key={node.item.id}
                node={node}
                offset={ZIGZAG_OFFSETS[i % ZIGZAG_OFFSETS.length]}
                color={meta.color}
                dark={meta.dark}
                onPress={() => openLesson(node)}
              />
            ))}
          </View>
        )}

        {isDone ? (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <Text
              style={{
                fontFamily: fonts.bodyBold,
                fontSize: 16,
                color: colors['success-dark'],
                textAlign: 'center',
              }}
            >
              Sequência de hoje concluída ✓
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <PushButton
              label="Continuar sequência"
              onPress={() =>
                activeSlug && router.push({ pathname: '/leitura', params: { law: activeSlug } })
              }
              disabled={trail.length === 0}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TrailNodeView({
  node,
  offset,
  color,
  dark,
  onPress,
}: {
  node: TrailNode;
  offset: number;
  color: string;
  dark: string;
  onPress: () => void;
}) {
  const locked = node.status === 'locked';
  const boss = node.kind === 'boss';

  const bg = locked ? '#E8DFCE' : boss ? colors.text : color;
  const depth = locked ? '#D5C9B2' : boss ? '#000000' : dark;

  return (
    <View style={{ transform: [{ translateX: offset }], alignItems: 'center' }}>
      {node.status === 'current' ? <PulseRing size={72} color={color} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={node.label}
        accessibilityState={{ disabled: locked }}
        onPress={onPress}
        disabled={locked}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: bg,
          borderBottomWidth: 6,
          borderBottomColor: depth,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 26 }}>
          {node.status === 'done' ? '✓' : boss ? '👑' : node.kind === 'chest' ? '🎁' : '📖'}
        </Text>
      </Pressable>
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 11,
          color: locked ? colors['muted-soft'] : colors['text-soft'],
          marginTop: 6,
        }}
      >
        {node.label}
      </Text>
    </View>
  );
}
