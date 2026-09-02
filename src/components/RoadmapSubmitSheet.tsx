/**
 * "Sugerir ideia" — porte do modal de submissao do roadmap web.
 *
 * Bottom sheet em vez de modal centralizado: o formulario tem teclado, e um
 * card no meio da tela ficaria escondido atras dele.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/client';
import { ApiError } from '../api/types';
import type { RoadmapCategory, RoadmapIdea } from '../api/types';
import { colors, fonts, radius } from '../theme/tokens';
import { Pressed } from './Pressed';
import { CATS, FilterChip } from './roadmap';

const TITLE_MAX = 120;
const DESC_MAX = 500;

export function SubmitIdeaSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (idea: RoadmapIdea) => void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoadmapCategory>('studies');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setTitle('');
    setDescription('');
    setCategory('studies');
    setError('');
  }

  async function submit() {
    if (!title.trim() || !description.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const idea = await api.createRoadmapIdea({
        title: title.trim(),
        description: description.trim(),
        category,
      });
      reset();
      onCreated(idea);
    } catch (e) {
      // O DRF devolve erro por campo; a web pega o primeiro de title/description.
      const data = e instanceof ApiError ? e.data : null;
      const first = (k: string) => {
        const v = data?.[k];
        return Array.isArray(v) ? String(v[0]) : undefined;
      };
      setError(first('title') || first('description') || data?.error || 'Erro ao publicar ideia.');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !busy;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,23,0.45)' }}
      >
        {/* Tocar fora fecha; o sheet abaixo nao propaga o toque. */}
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />

        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
            maxHeight: '88%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 12,
            }}
          />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text }}>
              Manda aí.
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: -8 }}>
              Sua ideia entra na fila e a galera vota. Você já sai com um voto.
            </Text>

            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
                TÍTULO
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={TITLE_MAX}
                placeholder="Resumo em uma linha"
                placeholderTextColor={colors['muted-soft']}
                style={{
                  marginTop: 6,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 2,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.text,
                }}
              />
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11,
                  color: colors['muted-soft'],
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {title.length}/{TITLE_MAX}
              </Text>
            </View>

            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
                DESCRIÇÃO
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={DESC_MAX}
                multiline
                placeholder="O que resolveria? Para quem?"
                placeholderTextColor={colors['muted-soft']}
                style={{
                  marginTop: 6,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 2,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: colors.text,
                }}
              />
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 11,
                  color: colors['muted-soft'],
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {description.length}/{DESC_MAX}
              </Text>
            </View>

            <View>
              <Text
                style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted, marginBottom: 8 }}
              >
                CATEGORIA
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(CATS) as RoadmapCategory[]).map((k) => (
                  <FilterChip
                    key={k}
                    label={`${CATS[k].emoji} ${CATS[k].label}`}
                    color={CATS[k].color}
                    active={category === k}
                    onPress={() => setCategory(k)}
                  />
                ))}
              </View>
            </View>

            {error ? (
              <View
                style={{
                  backgroundColor: colors['danger-soft'],
                  borderRadius: radius.md,
                  padding: 12,
                }}
              >
                <Text
                  style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors['danger-dark'] }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  backgroundColor: colors.card,
                  borderWidth: 2,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors['text-soft'] }}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressed
                onPress={submit}
                disabled={!canSubmit}
                accessibilityLabel="Publicar ideia"
                outerStyle={{ flex: 2, opacity: canSubmit ? 1 : 0.5 }}
                style={(held) => ({
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  backgroundColor: colors.primary,
                  borderBottomWidth: held ? 2 : 4,
                  borderBottomColor: colors['primary-dark'],
                })}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: '#FFFFFF' }}>
                    Publicar ideia
                  </Text>
                )}
              </Pressed>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
