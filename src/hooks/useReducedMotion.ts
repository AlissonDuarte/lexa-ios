/**
 * "Reduzir movimento" do iOS.
 *
 * As animacoes daqui sao decorativas: quem liga essa opcao no sistema costuma
 * fazer por enjoo ou sensibilidade vestibular, e um loop infinito de chama e
 * exatamente o tipo de coisa que a opcao existe para desligar. O Reanimated tem
 * um hook proprio, mas ele nao cobre o caso de o valor mudar com o app aberto.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
