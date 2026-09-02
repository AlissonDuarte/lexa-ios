/**
 * Lexa — o gato de smoking. Porte de frontend/src/components/Mascot.svelte.
 *
 * O SVG e o mesmo, coordenada por coordenada (viewBox 200x200), para o app e o
 * site mostrarem o mesmo desenho. Ate aqui o mobile usava 🐱 como stand-in, o
 * que perdia a identidade em todas as telas onde o mascote aparece.
 *
 * Os keyframes viraram Reanimated: lexaWiggle no `wave` e lexaBlink nos olhos.
 */
import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';

const BLACK = '#1F1A17';
const WHITE = '#FFFAF2';
const PINK = '#FF9FB8';
const SHINE = '#FFFFFF';
const LINE = '#1F1A17';

export type MascotVariant = 'idle' | 'happy' | 'wave' | 'celebrate' | 'sleep';

// Animar `ry` da elipse encolhe o olho em torno do proprio centro, que e o que
// o transform-origin do keyframe fazia — e `ry` e uma prop animavel de primeira
// classe no react-native-svg, ao contrario de scaleY+origin num <G>.
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MascotProps {
  size?: number;
  variant?: MascotVariant;
  /** Cor da gravata e das faiscas. */
  accent?: string;
  bow?: boolean;
  animate?: boolean;
  style?: ViewStyle;
}

/** Um olho que pisca: scaleY 1 -> 0.05 -> 1, uma vez a cada 4s (lexaBlink). */
function Eye({ cx, blink }: { cx: number; blink: boolean }) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!blink || reduced) {
      s.value = 1;
      return;
    }
    s.value = withRepeat(
      withSequence(
        // 92% dos 4s parado, depois a piscada — os mesmos tempos do keyframe.
        withTiming(1, { duration: 3680, easing: Easing.linear }),
        withTiming(0.05, { duration: 120, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(s);
  }, [blink, reduced, s]);

  const eyeProps = useAnimatedProps(() => ({ ry: 8 * s.value }));
  // O brilho some junto: um ponto branco flutuando sobre o olho fechado
  // denunciaria o truque.
  const shineProps = useAnimatedProps(() => ({ opacity: s.value }));

  return (
    <G>
      <AnimatedEllipse cx={cx} cy={85} rx={6} ry={8} fill={LINE} animatedProps={eyeProps} />
      <AnimatedCircle cx={cx + 2} cy={82} r={2.2} fill={SHINE} animatedProps={shineProps} />
    </G>
  );
}

export function Mascot({
  size = 160,
  variant = 'idle',
  accent = '#FF8C42',
  bow = true,
  animate = true,
  style,
}: MascotProps) {
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);

  const smile = ['happy', 'wave', 'celebrate', 'sleep'].includes(variant);
  const sleeping = variant === 'sleep';
  const waving = variant === 'wave';
  const celebrating = variant === 'celebrate';
  const moving = animate && !reduced;

  useEffect(() => {
    if (!moving || !waving) {
      wiggle.value = 0;
      return;
    }
    wiggle.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(wiggle);
  }, [moving, waving, wiggle]);

  // lexaWiggle: vai e volta entre -3deg e 3deg.
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-3 + wiggle.value * 6}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style, wrapStyle]}>
      <Svg viewBox="0 0 200 200" width={size} height={size}>
        {/* sombra */}
        <Ellipse cx={100} cy={186} rx={48} ry={6} fill={BLACK} opacity={0.12} />

        {/* corpo */}
        <Path
          d="M55 175 Q50 130 70 110 Q100 95 130 110 Q150 130 145 175 Z"
          fill={BLACK}
          stroke={LINE}
          strokeWidth={2}
        />
        {/* barriga */}
        <Path d="M80 175 Q75 145 95 130 Q105 128 115 135 Q125 145 122 175 Z" fill={WHITE} />

        {/* patas */}
        <Ellipse cx={72} cy={178} rx={13} ry={8} fill={BLACK} stroke={LINE} strokeWidth={2} />
        <Ellipse cx={128} cy={178} rx={13} ry={8} fill={BLACK} stroke={LINE} strokeWidth={2} />
        <Ellipse cx={68} cy={180} rx={3} ry={2} fill={WHITE} opacity={0.85} />
        <Ellipse cx={74} cy={181} rx={3} ry={2} fill={WHITE} opacity={0.85} />
        <Ellipse cx={124} cy={180} rx={3} ry={2} fill={WHITE} opacity={0.85} />
        <Ellipse cx={130} cy={181} rx={3} ry={2} fill={WHITE} opacity={0.85} />

        {/* braco acenando */}
        {waving ? (
          <G>
            <Path
              d="M138 130 Q160 110 170 80"
              stroke={BLACK}
              strokeWidth={14}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={170} cy={78} r={11} fill={BLACK} stroke={LINE} strokeWidth={2} />
            <Ellipse cx={170} cy={80} rx={6} ry={4} fill={WHITE} opacity={0.85} />
          </G>
        ) : null}

        {/* bracos comemorando */}
        {celebrating ? (
          <G>
            <Path
              d="M70 130 Q55 95 50 65"
              stroke={BLACK}
              strokeWidth={13}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={50} cy={62} r={11} fill={BLACK} stroke={LINE} strokeWidth={2} />
            <Path
              d="M130 130 Q145 95 150 65"
              stroke={BLACK}
              strokeWidth={13}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={150} cy={62} r={11} fill={BLACK} stroke={LINE} strokeWidth={2} />
            <Path d="M35 50 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" fill={accent} />
            <Path d="M165 45 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill={accent} />
          </G>
        ) : null}

        {/* rabo */}
        <Path
          d="M50 160 Q20 150 25 120 Q30 105 45 110"
          stroke={BLACK}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={28} cy={118} r={5} fill={WHITE} />

        {/* orelhas */}
        <Path
          d="M55 65 L45 25 L80 55 Z"
          fill={BLACK}
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path
          d="M145 65 L155 25 L120 55 Z"
          fill={BLACK}
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path d="M58 60 L52 35 L73 55 Z" fill={PINK} />
        <Path d="M142 60 L148 35 L127 55 Z" fill={PINK} />

        {/* cabeca */}
        <Circle cx={100} cy={80} r={48} fill={BLACK} stroke={LINE} strokeWidth={2} />
        <Path d="M70 85 Q72 60 100 58 Q128 60 130 85 Q128 110 100 115 Q72 110 70 85 Z" fill={WHITE} />

        {/* bochechas */}
        <Ellipse cx={78} cy={95} rx={7} ry={4} fill={PINK} opacity={0.7} />
        <Ellipse cx={122} cy={95} rx={7} ry={4} fill={PINK} opacity={0.7} />

        {/* olhos */}
        {sleeping ? (
          <G>
            <Path
              d="M82 82 Q88 86 94 82"
              stroke={LINE}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M106 82 Q112 86 118 82"
              stroke={LINE}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        ) : (
          <>
            <Eye cx={88} blink={moving} />
            <Eye cx={112} blink={moving} />
          </>
        )}

        {/* focinho */}
        <Path
          d="M96 96 L104 96 L100 101 Z"
          fill={PINK}
          stroke={LINE}
          strokeWidth={1}
          strokeLinejoin="round"
        />

        {/* boca */}
        {smile ? (
          <Path
            d="M93 102 Q100 110 107 102"
            stroke={LINE}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <G>
            <Path
              d="M100 101 Q97 105 93 105"
              stroke={LINE}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M100 101 Q103 105 107 105"
              stroke={LINE}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}

        {/* bigodes */}
        <G stroke={LINE} strokeWidth={1.2} strokeLinecap="round" opacity={0.6}>
          <Line x1={55} y1={96} x2={72} y2={98} />
          <Line x1={55} y1={102} x2={72} y2={103} />
          <Line x1={128} y1={98} x2={145} y2={96} />
          <Line x1={128} y1={103} x2={145} y2={102} />
        </G>

        {/* gravata borboleta */}
        {bow ? (
          <G>
            <Path
              d="M85 125 L100 132 L115 125 L113 140 L100 135 L87 140 Z"
              fill={accent}
              stroke={LINE}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <Circle cx={100} cy={132} r={3} fill={LINE} />
          </G>
        ) : null}

        {/* zzz dormindo */}
        {sleeping ? (
          <G>
            <SvgText x={140} y={50} fontSize={20} fontWeight="700" fill={LINE} opacity={0.6}>
              z
            </SvgText>
            <SvgText x={150} y={35} fontSize={14} fontWeight="700" fill={LINE} opacity={0.4}>
              z
            </SvgText>
          </G>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
