/**
 * Detalhe da ideia com comentarios — porte do modal de detalhe do roadmap web.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
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
import type { RoadmapComment, RoadmapIdea } from '../api/types';
import { colors, fonts, radius } from '../theme/tokens';
import { Pressed } from './Pressed';
import { AvatarStack, CategoryTag, STATUS_META, VoteButton, avatarColor, formatDate } from './roadmap';

const COMMENT_MAX = 500;

export function IdeaDetailSheet({
  idea,
  voting,
  isAuth,
  onClose,
  onVote,
  onCommented,
  onRequireAuth,
}: {
  idea: RoadmapIdea | null;
  voting: boolean;
  isAuth: boolean;
  onClose: () => void;
  onVote: () => void;
  onCommented: (ideaId: number) => void;
  onRequireAuth: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<RoadmapComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const ideaId = idea?.id ?? null;

  useEffect(() => {
    if (ideaId === null) return;
    let active = true;
    setComments([]);
    setText('');
    setError('');
    setLoading(true);
    api
      .getRoadmapComments(ideaId)
      .then((c) => {
        if (active) setComments(c);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ideaId]);

  if (!idea) return null;

  const meta = STATUS_META[idea.status];

  async function send() {
    if (!idea) return;
    if (!isAuth) {
      onRequireAuth();
      return;
    }
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const c = await api.addRoadmapComment(idea.id, body);
      setComments((list) => [...list, c]);
      setText('');
      onCommented(idea.id);
    } catch (e) {
      setError(
        (e instanceof ApiError ? e.data?.error : null) ?? 'Erro ao enviar comentário.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,26,23,0.45)' }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />

        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
            maxHeight: '90%',
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
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: `${meta.color}24`,
                borderColor: `${meta.color}38`,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: meta.color }}>
                {meta.emoji} {meta.short}
              </Text>
            </View>

            <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>
              {idea.title}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: -6 }}>
              por {idea.author_display} · {formatDate(idea.created_at)}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <VoteButton idea={idea} busy={voting} onPress={onVote} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 11,
                    color: colors.muted,
                    letterSpacing: 0.4,
                  }}
                >
                  {idea.voters_display.length} APOIADOR
                  {idea.voters_display.length === 1 ? '' : 'ES'}
                </Text>
                {idea.voters_display.length > 0 ? (
                  <View style={{ marginTop: 6 }}>
                    <AvatarStack voters={idea.voters_display} max={6} size={24} />
                  </View>
                ) : null}
              </View>
            </View>

            <Text
              style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors['text-soft'] }}
            >
              {idea.description}
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <CategoryTag category={idea.category} />
              {idea.status === 'progress' && idea.eta ? (
                <View
                  style={{
                    backgroundColor: `${STATUS_META.progress.color}24`,
                    borderColor: `${STATUS_META.progress.color}38`,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 11,
                      color: STATUS_META.progress.color,
                    }}
                  >
                    ⏱ ETA {idea.eta}
                  </Text>
                </View>
              ) : null}
              {idea.status === 'shipped' && idea.version ? (
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>
                  {idea.version}
                </Text>
              ) : null}
            </View>

            {idea.status === 'progress' && idea.progress_pct !== null ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 14,
                }}
              >
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}
                >
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted }}>
                    Progresso
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.bodyBold,
                      fontSize: 12,
                      color: STATUS_META.progress.color,
                    }}
                  >
                    {idea.progress_pct}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    backgroundColor: colors['border-soft'],
                    borderRadius: radius.pill,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${idea.progress_pct}%`,
                      backgroundColor: STATUS_META.progress.color,
                      borderRadius: radius.pill,
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* ── Comentários ────────────────────────────────────────────── */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.bodyBold,
                  fontSize: 11,
                  color: colors.muted,
                  letterSpacing: 0.4,
                }}
              >
                {idea.comments_count} COMENTÁRIO{idea.comments_count === 1 ? '' : 'S'}
              </Text>

              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : comments.length === 0 ? (
                <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors['muted-soft'] }}>
                  Nenhum comentário ainda. Seja o primeiro.
                </Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: avatarColor(c.author_name),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: '#FFFFFF' }}>
                        {c.author_initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text }}>
                        {c.author_name}
                        <Text style={{ fontFamily: fonts.body, color: colors['muted-soft'] }}>
                          {'  '}
                          {formatDate(c.created_at)}
                        </Text>
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 14,
                          lineHeight: 20,
                          color: colors['text-soft'],
                        }}
                      >
                        {c.text}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              {error ? (
                <Text
                  style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors['danger-dark'] }}
                >
                  {error}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Campo de comentário fixo no rodapé do sheet. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 20,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              maxLength={COMMENT_MAX}
              multiline
              placeholder={isAuth ? 'Escreva um comentário…' : 'Entre para comentar'}
              placeholderTextColor={colors['muted-soft']}
              editable={isAuth}
              style={{
                flex: 1,
                maxHeight: 100,
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.text,
              }}
            />
            <Pressed
              onPress={send}
              disabled={sending || (isAuth && !text.trim())}
              accessibilityLabel="Enviar comentário"
              outerStyle={{ opacity: sending || (isAuth && !text.trim()) ? 0.5 : 1 }}
              style={(held) => ({
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: held ? 0.94 : 1 }],
              })}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </Pressed>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
