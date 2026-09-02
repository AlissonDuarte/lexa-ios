/**
 * Botao "Entrar com a Apple".
 *
 * Ao contrario do GoogleButton, este NAO e um PushButton customizado: usa o
 * AppleAuthenticationButton nativo. A Apple exige que o botao siga as Human
 * Interface Guidelines dela, e esta e exatamente a tela que a review olha —
 * o componente nativo e o unico jeito garantidamente conforme. O preco e nao
 * ter a profundidade do resto dos botoes; `cornerRadius` ao menos alinha o
 * arredondamento (backgroundColor e borderRadius via `style` sao proibidos
 * pelo proprio componente).
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, View } from 'react-native';

import { colors, radius } from '../theme/tokens';

/** Mesma altura resultante do PushButton/GoogleButton (14*2 + conteudo + borda). */
const HEIGHT = 54;

interface AppleButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AppleButton({ onPress, disabled = false, loading = false }: AppleButtonProps) {
  // O botao nativo nao tem estado de carregamento nem `disabled`; trocamos ele
  // por um placeholder da mesma altura para a tela nao pular.
  if (loading) {
    return (
      <View
        style={{
          height: HEIGHT,
          borderRadius: radius.lg,
          backgroundColor: colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.bg} />
      </View>
    );
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.lg}
      // Sem width/height explicitos o botao nativo simplesmente nao aparece.
      style={{ width: '100%', height: HEIGHT, opacity: disabled ? 0.5 : 1 }}
      onPress={() => {
        if (!disabled) onPress();
      }}
    />
  );
}
