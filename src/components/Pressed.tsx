/**
 * Botao com estado de pressionado — a forma que funciona neste projeto.
 *
 * O `style` do Pressable do RN aceita uma funcao `({pressed}) => estilo`, mas
 * o NativeWind esta no meio do caminho: o interop trata `props.style` como
 * objeto (`props.style ??= {}` e `props.style?.[chave]` em
 * react-native-css-interop/dist/runtime/native/native-interop.js), entao um
 * style em funcao nao chega inteiro do outro lado — propriedades de layout como
 * `flexDirection` se perdem e o conteudo cai empilhado.
 *
 * Por isso todo botao daqui (PushButton, GoogleButton) usa Pressable como
 * casca com estilo simples e um View interno cuidando do visual. Este
 * componente encapsula esse arranjo mantendo a ergonomia do estilo por estado.
 */
import { useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';

interface PressedProps {
  /** Estilo do miolo; `held` diz se o dedo esta em cima agora. */
  style: (held: boolean) => ViewStyle;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  /** Vai na casca, nao no miolo — util para largura e opacidade. */
  outerStyle?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
  hitSlop?: number;
}

export function Pressed({
  style,
  onPress,
  children,
  disabled = false,
  outerStyle,
  accessibilityLabel,
  accessibilityHint,
  selected,
  hitSlop,
}: PressedProps) {
  const [held, setHeld] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      hitSlop={hitSlop}
      style={outerStyle}
    >
      <View style={style(held && !disabled)}>{children}</View>
    </Pressable>
  );
}
