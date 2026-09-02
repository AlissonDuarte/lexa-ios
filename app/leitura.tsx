import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../src/api/client';
import { ApiError } from '../src/api/types';
import type {
  AnswerItemResponse,
  Avaliacao,
  CompleteItemResponse,
  DailySequence,
  SequenceItem,
} from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { PushButton } from '../src/components/PushButton';
import { colors, fonts, radius } from '../src/theme/tokens';

/**
 * Tela de leitura — porte de frontend/src/routes/leitura/+page.svelte.
 *
 * Maquina de estados por item:
 *   reading  -> countdown obrigatorio (min_read_seconds vindo do servidor)
 *   question -> lacuna de multipla escolha (quando o artigo tem questao)
 *   evaluation -> autoavaliacao facil/medio/dificil, que fecha o item
 *
 * O tempo minimo e reimposto no servidor: complete_item devolve
 * 400 {error:'reading_time', wait_seconds} se o cliente se adiantar. Nesse caso
 * reiniciamos o countdown com o valor que o servidor mandou, igual a web.
 */
type Step = 'reading' | 'question' | 'evaluation';

export default function Leitura() {
  const { law } = useLocalSearchParams<{ law?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();

  const [sequence, setSequence] = useState<DailySequence | null>(null);
  const [items, setItems] = useState<SequenceItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('reading');
  const [countdownTotal, setCountdownTotal] = useState(0);
  const [countdownLeft, setCountdownLeft] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerItemResponse | null>(null);

  const [completion, setCompletion] = useState<CompleteItemResponse | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = items[currentIndex];
  const question = current?.article?.question ?? null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Limpa timers no unmount: sem isso, sair da tela no meio do countdown
  // deixaria um setInterval vivo tentando dar setState em componente morto.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (toastRef.current) clearTimeout(toastRef.current);
    },
    [],
  );

  const startCountdown = useCallback(
    (seconds: number) => {
      clearTimer();
      setCountdownTotal((t) => Math.max(t, seconds));
      setCountdownLeft(seconds);
      timerRef.current = setInterval(() => {
        setCountdownLeft((left) => {
          if (left <= 1) {
            clearTimer();
            return 0;
          }
          return left - 1;
        });
      }, 1000);
    },
    [clearTimer],
  );

  const advanceStep = useCallback(
    (item: SequenceItem | undefined) => {
      const q = item?.article?.question ?? null;
      setStep(q && !item?.respondido ? 'question' : 'evaluation');
    },
    [],
  );

  // Abre o item corrente: registra a exibicao e dispara o countdown.
  const startItem = useCallback(
    async (item: SequenceItem | undefined) => {
      if (!item) return;
      setStep('reading');
      setSelectedAnswer(null);
      setAnswerResult(null);
      clearTimer();

      try {
        const res = await api.showItem(item.id);
        const minSec = res.min_read_seconds ?? item.article?.min_read_seconds ?? 10;

        // Item ja aberto antes (voltou para a tela): nao repete a espera.
        if (res.already_shown) {
          advanceStep(item);
          return;
        }
        setCountdownTotal(minSec);
        startCountdown(minSec);
      } catch {
        // Falha ao registrar nao pode prender o usuario na leitura; o servidor
        // ainda valida o tempo no complete.
        advanceStep(item);
      }
    },
    [advanceStep, clearTimer, startCountdown],
  );

  // Quando o countdown zera durante a leitura, avanca.
  useEffect(() => {
    if (step === 'reading' && countdownLeft === 0 && countdownTotal > 0) {
      advanceStep(current);
    }
  }, [step, countdownLeft, countdownTotal, current, advanceStep]);

  // Carga inicial: pega a sequencia do dia e posiciona no primeiro pendente.
  useEffect(() => {
    (async () => {
      if (!law) {
        setError('Lei não informada.');
        setLoading(false);
        return;
      }
      try {
        const seq = await api.getTodaySequence(law);
        setSequence(seq);
        setItems(seq.items);
        const firstPending = seq.items.findIndex((it) => !it.concluido);
        const index = firstPending === -1 ? 0 : firstPending;
        setCurrentIndex(index);
        setLoading(false);
        void startItem(seq.items[index]);
      } catch {
        setError('Não foi possível carregar a sequência.');
        setLoading(false);
      }
    })();
    // Roda uma vez por lei.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [law]);

  function showXpToast(xp: number) {
    setXpToast(xp);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setXpToast(null), 1800);
  }

  async function handleAnswer(alternativa: string) {
    if (selectedAnswer !== null || submitting || !current) return;
    setSelectedAnswer(alternativa);
    setSubmitting(true);
    try {
      const res = await api.answerItem(current.id, alternativa);
      setAnswerResult(res);
      setItems((prev) =>
        prev.map((it, i) =>
          i === currentIndex ? { ...it, respondido: true, resposta_correta: res.correto } : it,
        ),
      );
      if (res.xp_bonus > 0) showXpToast(res.xp_bonus);
    } catch {
      setStep('evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  async function evaluate(avaliacao: Avaliacao) {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.completeItem(current.id, avaliacao);

      setItems((prev) =>
        prev.map((it, i) => (i === currentIndex ? { ...it, concluido: true, avaliacao } : it)),
      );

      const xpEarned = (res.xp_ganho ?? 0) + (res.bonus_xp ?? 0);
      if (xpEarned > 0) showXpToast(xpEarned);

      void refreshUser();

      if (res.sequencia_concluida) {
        setCompletion(res);
        return;
      }

      const next = currentIndex + 1;
      if (next < items.length) {
        setCurrentIndex(next);
        void startItem(items[next]);
      } else {
        setCompletion(res);
      }
    } catch (e) {
      // O servidor recusou por tempo de leitura: volta para a leitura com o
      // countdown que ele mandou.
      if (e instanceof ApiError && e.isReadingTime) {
        const wait = e.waitSeconds || 5;
        setStep('reading');
        startCountdown(wait);
      } else {
        setError('Não foi possível concluir este item.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 20,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.bodySemi,
            fontSize: 16,
            color: colors['danger-dark'],
            textAlign: 'center',
          }}
        >
          {error}
        </Text>
        <PushButton label="Voltar" variant="neutral" onPress={() => router.back()} />
      </View>
    );
  }

  // Tela final da sequência
  if (completion) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 56, textAlign: 'center' }}>🎉</Text>
        <Text
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 26,
            color: colors.text,
            textAlign: 'center',
          }}
        >
          {completion.sequencia_concluida ? 'Sequência concluída!' : 'Tudo certo por aqui'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 15,
            color: colors.muted,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {completion.total_xp} XP · streak de {completion.streak_atual} dia
          {completion.streak_atual === 1 ? '' : 's'}
        </Text>
        <PushButton
          label="Voltar ao início"
          variant="success"
          onPress={() => router.replace('/(tabs)/dashboard')}
        />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>
          Nada para estudar agora.
        </Text>
      </View>
    );
  }

  const progressPct = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;
  const countdownPct =
    countdownTotal > 0 ? ((countdownTotal - countdownLeft) / countdownTotal) * 100 : 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Cabeçalho: sair + progresso da sequência */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Sair da sequência" hitSlop={8}>
          <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
        </Pressable>
        <View
          style={{
            flex: 1,
            height: 12,
            backgroundColor: colors.border,
            borderRadius: radius.pill,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progressPct}%`,
              backgroundColor: colors.success,
              borderRadius: radius.pill,
            }}
          />
        </View>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted }}>
          {currentIndex + 1}/{items.length}
        </Text>
      </View>

      {/* Barra do tempo mínimo de leitura */}
      {step === 'reading' && countdownLeft > 0 ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <View
            style={{
              height: 6,
              backgroundColor: colors['primary-light'],
              borderRadius: radius.pill,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${countdownPct}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
      >
        <Text
          style={{
            fontFamily: fonts.bodyBold,
            fontSize: 13,
            color: current.tipo === 'novo' ? colors.primary : colors.gem,
            marginBottom: 4,
          }}
        >
          {current.tipo === 'novo' ? 'ARTIGO NOVO' : 'REVISÃO'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 20,
            color: colors.text,
            marginBottom: 12,
          }}
        >
          {current.article?.numero}
        </Text>

        {/* Texto legal em monoespaçada: Agents.md exige fidelidade visual ao
            documento oficial — nunca reformatar nem resumir. */}
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
              fontFamily: fonts.mono,
              fontSize: 14,
              lineHeight: 22,
              color: colors.text,
            }}
          >
            {current.article?.texto}
          </Text>
          {current.article?.children?.map((child) => (
            <Text
              key={child.id}
              style={{
                fontFamily: fonts.mono,
                fontSize: 13,
                lineHeight: 21,
                color: colors['text-soft'],
                marginTop: 12,
              }}
            >
              {child.texto}
            </Text>
          ))}
        </View>

        {/* Passo: questão de lacuna */}
        {step === 'question' && question ? (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 15,
                color: colors['text-soft'],
                marginBottom: 12,
              }}
            >
              {question.texto_lacuna}
            </Text>

            <View style={{ gap: 10 }}>
              {question.alternativas.map((alt) => {
                const isSelected = selectedAnswer === alt;
                const revealed = answerResult !== null;
                const isRight = revealed && alt === answerResult.resposta_correta;
                const isWrongPick = revealed && isSelected && !answerResult.correto;

                let borderColor = colors.border;
                let bg = colors.card;
                if (isRight) {
                  borderColor = colors['success-dark'];
                  bg = colors['success-soft'];
                } else if (isWrongPick) {
                  borderColor = colors['danger-dark'];
                  bg = colors['danger-soft'];
                } else if (isSelected) {
                  borderColor = colors.primary;
                }

                return (
                  <Pressable
                    key={alt}
                    accessibilityRole="button"
                    disabled={revealed || submitting}
                    onPress={() => handleAnswer(alt)}
                    style={{
                      backgroundColor: bg,
                      borderColor,
                      borderWidth: 2,
                      borderBottomWidth: 3,
                      borderRadius: radius.md,
                      padding: 14,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text }}>
                      {alt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {answerResult ? (
              <View style={{ marginTop: 20 }}>
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 15,
                    color: answerResult.correto ? colors['success-dark'] : colors['danger-dark'],
                    marginBottom: 12,
                  }}
                >
                  {answerResult.correto ? 'Correto!' : `Resposta: ${answerResult.resposta_correta}`}
                </Text>
                <PushButton
                  label="Continuar"
                  variant={answerResult.correto ? 'success' : 'primary'}
                  onPress={() => {
                    setAnswerResult(null);
                    setSelectedAnswer(null);
                    setStep('evaluation');
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Passo: autoavaliação */}
        {step === 'evaluation' ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            <Text
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 15,
                color: colors['text-soft'],
                marginBottom: 4,
              }}
            >
              Quão bem você lembrava deste artigo?
            </Text>
            <PushButton label="Fácil" variant="success" onPress={() => evaluate('facil')} disabled={submitting} />
            <PushButton label="Médio" variant="primary" onPress={() => evaluate('medio')} disabled={submitting} />
            <PushButton label="Difícil" variant="danger" onPress={() => evaluate('dificil')} disabled={submitting} />
          </View>
        ) : null}

        {/* Passo: leitura, aguardando o tempo mínimo */}
        {step === 'reading' ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.muted }}>
              {countdownLeft > 0 ? `Aguarde ${countdownLeft}s` : 'Pronto!'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Toast de XP */}
      {xpToast !== null ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 60,
            alignSelf: 'center',
            backgroundColor: colors.gem,
            borderRadius: radius.pill,
            paddingHorizontal: 18,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: '#FFFFFF' }}>
            +{xpToast} XP
          </Text>
        </View>
      ) : null}
    </View>
  );
}
