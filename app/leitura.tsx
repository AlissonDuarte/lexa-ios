import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Mascot } from '../src/components/Mascot';
import type { MascotVariant } from '../src/components/Mascot';
import { SlideUp } from '../src/components/motion';
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

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
  const [mascotVariant, setMascotVariant] = useState<MascotVariant>('idle');
  const [skipRefused, setSkipRefused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (skipRef.current) clearTimeout(skipRef.current);
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

  /**
   * "Ja li": corta o countdown visual para quem le rapido nao ficar esperando.
   *
   * Nao burla o tempo minimo — o servidor ainda pode responder
   * {error:'reading_time', wait_seconds} no complete_item, e ai o countdown
   * volta com o valor que ele mandou. Por isso o botao so aparece enquanto
   * sobram mais de 3s, e nunca mais depois de uma recusa (`skipRefused`).
   */
  const skipTimer = useCallback(() => {
    // Nao zera countdownLeft de proposito: ha um efeito que avanca sozinho
    // quando ele chega a zero, e ele atropelaria a comemoracao de 400ms.
    // A web tambem so para o intervalo.
    clearTimer();
    setMascotVariant('happy');
    // O gato comemora por um instante antes de a tela virar — mesmos 400ms da web.
    skipRef.current = setTimeout(() => {
      setMascotVariant('idle');
      advanceStep(current);
    }, 400);
  }, [advanceStep, clearTimer, current]);

  // Abre o item corrente: registra a exibicao e dispara o countdown.
  const startItem = useCallback(
    async (item: SequenceItem | undefined) => {
      if (!item) return;
      setSkipRefused(false);
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
        // Ja sabemos que o servidor esta cobrando o tempo deste item: reoferecer
        // "Ja li" so levaria a uma segunda recusa. Aqui divergimos da web de
        // proposito — la o botao reaparece e o usuario bate na mesma parede.
        setSkipRefused(true);
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
        <View style={{ alignItems: 'center' }}>
          <Mascot size={140} variant="celebrate" />
        </View>
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
        contentContainerStyle={{
          paddingHorizontal: 20,
          // A barra de feedback flutua por cima do scroll; sem esta folga ela
          // taparia as ultimas alternativas justamente quando o usuario quer
          // conferir qual era a certa.
          paddingBottom: insets.bottom + (answerResult ? 132 : 32),
        }}
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
          <SlideUp style={{ marginTop: 24 }}>
            {/* Enunciado */}
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors['primary-light'],
                borderWidth: 2,
                borderRadius: radius.lg,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: colors['primary-tint'],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="help-circle" size={18} color={colors.primary} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    marginTop: 6,
                    fontFamily: fonts.bodyBold,
                    fontSize: 12,
                    color: colors.muted,
                    letterSpacing: 0.3,
                  }}
                >
                  {question.num_lacunas > 1 ? 'Complete a expressão:' : 'Complete o trecho:'}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 14,
                  lineHeight: 25,
                  color: colors['text-soft'],
                }}
              >
                {question.texto_lacuna}
              </Text>
            </View>

            {/* Alternativas */}
            <View style={{ gap: 12 }}>
              {question.alternativas.map((alt, i) => {
                const revealed = answerResult !== null;
                const isRight = revealed && alt === answerResult.resposta_correta;
                const isWrongPick = revealed && alt === selectedAnswer && !answerResult.correto;
                // Depois de responder, as alternativas que nao sao nem a certa
                // nem a escolhida apagam, para o olho ir direto ao que importa.
                const dimmed = revealed && !isRight && !isWrongPick;

                // Entre o toque e a resposta do servidor a alternativa fica
                // so marcada, sem cor de certo/errado — na web ela pisca de
                // vermelho nesse intervalo, porque o teste de "errada" nao
                // espera o resultado chegar.
                const pending = !revealed && alt === selectedAnswer;

                const border = isRight
                  ? colors.success
                  : isWrongPick
                    ? colors.danger
                    : pending
                      ? colors.primary
                      : colors.border;
                const depth = isRight
                  ? colors['success-dark']
                  : isWrongPick
                    ? colors['danger-dark']
                    : pending
                      ? colors['primary-dark']
                      : colors.border;
                const bg = isRight
                  ? colors['success-soft']
                  : isWrongPick
                    ? colors['danger-soft']
                    : colors.card;
                const fg = isRight
                  ? colors['success-dark']
                  : isWrongPick
                    ? colors['danger-dark']
                    : colors.text;

                const badgeBg = isRight
                  ? colors.success
                  : isWrongPick
                    ? colors.danger
                    : dimmed
                      ? colors.border
                      : pending
                        ? colors.primary
                        : colors['primary-light'];
                const badgeFg = isRight || isWrongPick || pending
                  ? '#FFFFFF'
                  : dimmed
                    ? colors.muted
                    : colors.primary;

                return (
                  <Pressable
                    key={alt}
                    accessibilityRole="button"
                    accessibilityLabel={`Alternativa ${LETTERS[i] ?? i + 1}: ${alt}`}
                    accessibilityState={{ disabled: revealed || submitting }}
                    disabled={revealed || submitting}
                    onPress={() => handleAnswer(alt)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: bg,
                      borderColor: border,
                      borderWidth: 2,
                      // O "afundar" ao tocar: a profundidade vira zero.
                      borderBottomWidth: pressed ? 2 : 4,
                      borderBottomColor: depth,
                      borderRadius: radius.lg,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      opacity: dimmed ? 0.4 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: badgeBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: badgeFg }}>
                        {LETTERS[i] ?? String.fromCharCode(65 + i)}
                      </Text>
                    </View>

                    <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: fg }}>
                      {alt}
                    </Text>

                    {isRight ? (
                      <Ionicons name="checkmark" size={20} color={colors['success-dark']} />
                    ) : isWrongPick ? (
                      <Ionicons name="close" size={20} color={colors['danger-dark']} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </SlideUp>
        ) : null}

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
          <View style={{ marginTop: 24, gap: 16 }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 2,
                borderBottomWidth: 4,
                borderRadius: radius.lg,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Mascot size={52} variant={mascotVariant} bow={false} />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.text }}>
                  Lendo artigo…
                </Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted }}>
                  {countdownLeft > 0 ? `Aguarde ${countdownLeft}s` : 'Pronto!'}
                </Text>
              </View>

              {/* Some perto do fim (com 3s ou menos, esperar sai mais barato que
                  arriscar a recusa) e some de vez depois de o servidor ja ter
                  recusado este item. */}
              {countdownLeft > 3 && !skipRefused ? (
                <Pressable
                  onPress={skipTimer}
                  accessibilityRole="button"
                  accessibilityLabel="Já li este artigo"
                  hitSlop={6}
                  style={({ pressed }) => ({
                    backgroundColor: colors['primary-tint'],
                    borderColor: colors['primary-light'],
                    borderWidth: 1,
                    borderRadius: radius.pill,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary }}>
                    Já li →
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Previa apagada dos botoes de avaliacao, como na web: mostra o
                que vem a seguir sem deixar tocar. */}
            <View style={{ flexDirection: 'row', gap: 10, opacity: 0.4 }} pointerEvents="none">
              <View style={{ flex: 1 }}>
                <PushButton label="Fácil" variant="success" onPress={() => {}} disabled />
              </View>
              <View style={{ flex: 1 }}>
                <PushButton label="Médio" variant="primary" onPress={() => {}} disabled />
              </View>
              <View style={{ flex: 1 }}>
                <PushButton label="Difícil" variant="danger" onPress={() => {}} disabled />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Barra de feedback da resposta ──────────────────────────────────
          Fica ancorada no rodape, fora do ScrollView: em questao longa o
          resultado apareceria abaixo da dobra se rolasse junto. */}
      {answerResult ? (
        <SlideUp
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View
            style={{
              backgroundColor: answerResult.correto ? colors.success : colors.danger,
              borderColor: answerResult.correto ? colors['success-dark'] : colors['danger-dark'],
              borderWidth: 2,
              borderBottomWidth: 4,
              borderRadius: radius.lg,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={answerResult.correto ? 'checkmark' : 'close'}
                  size={22}
                  color="#FFFFFF"
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: '#FFFFFF' }}>
                  {answerResult.correto ? 'Mandou bem! 🎉' : 'Não foi dessa vez 😔'}
                </Text>
                {!answerResult.correto ? (
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.9)',
                      marginTop: 2,
                    }}
                  >
                    Certo: {answerResult.resposta_correta}
                  </Text>
                ) : answerResult.xp_bonus > 0 ? (
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.9)',
                      marginTop: 2,
                    }}
                  >
                    +{answerResult.xp_bonus} XP bônus!
                  </Text>
                ) : null}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAnswerResult(null);
                setSelectedAnswer(null);
                setStep('evaluation');
              }}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: radius.lg,
                paddingHorizontal: 20,
                paddingVertical: 10,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.displayBold,
                  fontSize: 14,
                  color: answerResult.correto ? colors['success-dark'] : colors['danger-dark'],
                }}
              >
                Continuar
              </Text>
            </Pressable>
          </View>
        </SlideUp>
      ) : null}

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
