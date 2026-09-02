/**
 * Primitivas de animacao — porte dos @keyframes de frontend/src/app.css.
 *
 * A web tem 33 keyframes; o app nao tinha nenhum, apesar do Reanimated ja estar
 * instalado. Cada componente daqui espelha um keyframe nomeado da web, com a
 * mesma duracao e os mesmos valores, para as duas plataformas nao divergirem
 * visualmente.
 *
 * O plugin do Reanimated ja vem ligado pelo babel-preset-expo no SDK 57 — nao
 * ha nada a acrescentar no babel.config.js.
 */
import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../hooks/useReducedMotion';

interface MotionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Atraso em ms — usado para escalonar entradas em lista. */
  delay?: number;
}

/**
 * `lexaFlame`: scale(1) rotate(-2deg) <-> scale(1.07) rotate(2deg), 2s, infinito.
 * A chama da tela de sequencia.
 */
export function Flicker({ children, style }: MotionProps) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + t.value * 0.07 },
      { rotate: `${-2 + t.value * 4}deg` },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * `slideUp`: opacity 0 -> 1 com translateY 12px -> 0, 300ms, uma vez.
 * Entrada da barra de feedback e dos blocos de passo.
 */
export function SlideUp({ children, style, delay = 0 }: MotionProps) {
  // Nasce no estado FINAL, nao no inicial. Se por qualquer motivo a animacao
  // nao rodar, o conteudo aparece do mesmo jeito; comecar em opacity 0 faria a
  // falha da animacao virar conteudo invisivel para sempre.
  const t = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withDelay(delay, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(t);
  }, [delay, reduced, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: 12 * (1 - t.value) }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * `lexaPop`: scale 0.5 -> 1.08 -> 1 com fade, 400ms, uma vez.
 * Entrada de cards e itens de lista.
 */
export function Pop({ children, style, delay = 0 }: MotionProps) {
  // `p` E a escala, nao um progresso de 0 a 1: assim os valores batem com o
  // keyframe (0.5 -> 1.08 -> 1) sem uma conversao no meio que ja tinha comido
  // o overshoot. Comeca em 1 (estado final) pelo mesmo motivo do SlideUp: uma
  // animacao que nao roda nao pode esconder o conteudo.
  const p = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return;
    }
    p.value = 0.5;
    p.value = withDelay(
      delay,
      withSequence(
        withTiming(1.08, { duration: 240, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 160, easing: Easing.inOut(Easing.ease) }),
      ),
    );
    return () => cancelAnimation(p);
  }, [delay, reduced, p]);

  const animated = useAnimatedStyle(() => ({
    // Satura cedo para o item nao passar a maior parte da entrada translucido.
    opacity: Math.min(1, (p.value - 0.5) * 3.5),
    transform: [{ scale: p.value }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * `lexaPulseRing`: scale 1 -> 1.5 com opacity 0.55 -> 0, 1.6s, infinito.
 * O halo em volta do no atual da trilha. Fica atras do conteudo, entao e
 * posicionado em absoluto pelo chamador.
 */
export function PulseRing({ size, color }: { size: number; color: string }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 0.5 }],
  }));

  // Sem animacao o halo estatico so poluiria o no; melhor nao desenhar.
  if (reduced) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
        },
        animated,
      ]}
    />
  );
}

/**
 * Barra que cresce de 0 ate `pct` (0-1) na montagem. Usada na barra de XP e nos
 * degraus do podio, onde a web anima a altura via transition CSS.
 */
export function GrowBar({
  pct,
  duration = 700,
  delay = 0,
  style,
  horizontal = true,
  children,
}: {
  pct: number;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
  horizontal?: boolean;
  /** Conteudo que acompanha a barra — o numero do degrau, no podio. */
  children?: React.ReactNode;
}) {
  const v = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const target = Math.max(0, Math.min(1, pct));
    if (reduced) {
      v.value = target;
      return;
    }
    v.value = withDelay(delay, withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(v);
  }, [pct, duration, delay, reduced, v]);

  const animated = useAnimatedStyle(() =>
    horizontal ? { width: `${v.value * 100}%` } : { height: `${v.value * 100}%` },
  );

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
