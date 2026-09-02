/**
 * Botao "3D push" do Lexa.
 *
 * A web consegue isso com `box-shadow: 0 4px 0 0 <cor-escura>` mais
 * `active:translate-y-[3px]` (ver os tokens shadow-btn* em
 * frontend/tailwind.config.js e as classes .btn-* em frontend/src/app.css).
 * RN nao tem box-shadow confiavel entre plataformas, entao reproduzimos a
 * profundidade com borderBottomWidth e a "afundada" movendo o conteudo e
 * encolhendo a borda na mesma medida — assim o botao inteiro nao muda de
 * altura e nada pula no layout ao redor.
 */
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useState } from 'react';

import { colors, fonts, pushDepth, radius } from '../theme/tokens';

export type PushButtonVariant = 'primary' | 'success' | 'danger' | 'neutral' | 'ghost';

const VARIANTS: Record<PushButtonVariant, { bg: string; depth: string; label: string }> = {
  primary: { bg: colors.primary, depth: colors['primary-dark'], label: '#FFFFFF' },
  success: { bg: colors.success, depth: colors['success-dark'], label: '#FFFFFF' },
  danger: { bg: colors.danger, depth: colors['danger-dark'], label: '#FFFFFF' },
  neutral: { bg: colors.card, depth: '#D5C9B2', label: colors.text },
  ghost: { bg: 'transparent', depth: colors.border, label: colors.text },
};

interface PushButtonProps {
  label: string;
  onPress?: () => void;
  variant?: PushButtonVariant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PushButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  small = false,
  style,
}: PushButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const depth = small ? pushDepth.buttonSm : pushDepth.button;
  // Ao pressionar, a borda encolhe e o conteudo desce o mesmo tanto.
  const sink = pressed && !disabled ? depth - 1 : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View
        style={{
          backgroundColor: v.bg,
          borderBottomColor: v.depth,
          borderBottomWidth: depth - sink,
          borderRadius: radius.lg,
          paddingVertical: (small ? 10 : 14) + sink,
          paddingHorizontal: small ? 16 : 20,
          alignItems: 'center',
          justifyContent: 'center',
          ...(variant === 'ghost'
            ? { borderWidth: 2, borderColor: colors.border, borderBottomWidth: depth - sink }
            : null),
        }}
      >
        <Text
          style={{
            color: v.label,
            fontFamily: fonts.bodyBold,
            fontSize: small ? 14 : 16,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
