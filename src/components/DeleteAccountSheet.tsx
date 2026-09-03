/**
 * "Excluir conta" — confirmacao em duas etapas, mesmo bottom sheet do
 * RoadmapSubmitSheet.tsx. Nao usa Alert.alert nativo (nenhuma tela do app
 * usa) para manter a mesma linguagem visual do resto do produto.
 */
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors, fonts, radius } from '../theme/tokens';
import { Pressed } from './Pressed';
import { PushButton } from './PushButton';

export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { deleteAccount } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setStep(1);
    setBusy(false);
    setError('');
  }

  function close() {
    if (busy) return;
    onClose();
    reset();
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      // O RouteGuard em app/_layout.tsx redireciona para (auth)/login assim
      // que `token` vira null — nao precisa navegar aqui.
    } catch (e) {
      const data = e instanceof ApiError ? e.data : null;
      setError(data?.error || 'Não foi possível excluir sua conta agora. Tente de novo em instantes.');
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,23,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Fechar" />

        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 16,
            }}
          />

          {step === 1 ? (
            <View style={{ gap: 14 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>
                Tem certeza que quer excluir sua conta?
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  'Você perde o acesso agora mesmo, em todos os dispositivos.',
                  'Seus dados pessoais são apagados após um período de carência.',
                  'Não é possível reativar entrando de novo — fale com o suporte se mudar de ideia dentro desse período.',
                ].map((line) => (
                  <Text
                    key={line}
                    style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 }}
                  >
                    •  {line}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <PushButton label="Cancelar" variant="ghost" onPress={close} style={{ flex: 1 }} />
                <PushButton
                  label="Continuar"
                  variant="danger"
                  onPress={() => setStep(2)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>
                Confirmação final
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
                Sua conta e seu progresso deixam de estar acessíveis assim que você confirmar.
              </Text>

              {error ? (
                <View style={{ backgroundColor: colors['danger-soft'], borderRadius: radius.md, padding: 12 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors['danger-dark'] }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <PushButton label="Cancelar" variant="ghost" onPress={close} disabled={busy} style={{ flex: 1 }} />
                <Pressed
                  onPress={confirm}
                  disabled={busy}
                  accessibilityLabel="Confirmar exclusão da conta"
                  outerStyle={{ flex: 1 }}
                  style={(held) => ({
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: radius.lg,
                    backgroundColor: colors.danger,
                    borderBottomWidth: held ? 2 : 4,
                    borderBottomColor: colors['danger-dark'],
                  })}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' }}>
                      Sim, excluir minha conta
                    </Text>
                  )}
                </Pressed>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
