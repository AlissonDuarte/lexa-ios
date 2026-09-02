/**
 * Botao "Continuar com o Google".
 *
 * O SDK traz um `GoogleSigninButton` pronto, mas ele ignora o visual do Lexa.
 * Aqui reaproveitamos a profundidade do PushButton (variante neutral) e so
 * acrescentamos o logo, para o botao ficar irmao do "Entrar" logo acima.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { colors, fonts, pushDepth, radius } from '../theme/tokens';

const DEPTH_COLOR = '#D5C9B2';

interface GoogleButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function GoogleButton({ onPress, disabled = false, loading = false }: GoogleButtonProps) {
  const [pressed, setPressed] = useState(false);
  const depth = pushDepth.button;
  const sink = pressed && !disabled ? depth - 1 : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continuar com o Google"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderBottomColor: DEPTH_COLOR,
          borderBottomWidth: depth - sink,
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: radius.lg,
          paddingVertical: 14 + sink,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontFamily: fonts.bodyBold,
                fontSize: 16,
                letterSpacing: 0.3,
              }}
            >
              Continuar com o Google
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

/** Separador "ou" entre o formulario e o login social. */
export function OrDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>ou</Text>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.border }} />
    </View>
  );
}
