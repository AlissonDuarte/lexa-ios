import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/api/client';
import { ApiError } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { useAppleAuth } from '../../src/auth/useAppleAuth';
import { useGoogleAuth } from '../../src/auth/useGoogleAuth';
import { AppleButton } from '../../src/components/AppleButton';
import { Field } from '../../src/components/Field';
import { GoogleButton, OrDivider } from '../../src/components/GoogleButton';
import { PushButton } from '../../src/components/PushButton';
import { colors, fonts, radius } from '../../src/theme/tokens';

export default function Register() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // O RegisterSerializer exige min_length=6 na senha.
  const google = useGoogleAuth(setError);
  const apple = useAppleAuth(setError);

  const canSubmit =
    form.username.trim().length > 0 &&
    form.password.length >= 6 &&
    !submitting &&
    !google.busy && !apple.busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.register({ ...form, username: form.username.trim() });
      await signIn(data);
    } catch (e) {
      let msg = 'Não foi possível criar a conta.';
      if (e instanceof ApiError && e.data) {
        // O DRF devolve erros de validacao como {campo: [mensagens]}.
        const first = Object.entries(e.data).find(([, v]) => Array.isArray(v) && v.length);
        if (first) {
          msg = String((first[1] as unknown[])[0]);
        } else if (e.data.error || e.data.detail) {
          msg = String(e.data.error || e.data.detail);
        }
      } else if (!(e instanceof ApiError)) {
        msg = 'Sem conexão com o servidor.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            fontFamily: fonts.displayBold,
            fontSize: 28,
            color: colors.text,
            marginBottom: 24,
          }}
        >
          Criar conta
        </Text>

        <Field
          label="Usuário"
          value={form.username}
          onChangeText={set('username')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="E-mail"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Field label="Nome" value={form.first_name} onChangeText={set('first_name')} />
        <Field label="Sobrenome" value={form.last_name} onChangeText={set('last_name')} />
        <Field
          label="Senha (mínimo 6 caracteres)"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
        />

        {error ? (
          <View
            style={{
              backgroundColor: colors['danger-soft'],
              borderRadius: radius.md,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, color: colors['danger-dark'], fontSize: 14 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {submitting ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <PushButton label="Criar conta" onPress={handleSubmit} disabled={!canSubmit} />
        )}

        {apple.available || google.available ? (
          <>
            <OrDivider />
            {/* Apple acima do Google: a HIG pede proeminencia ao menos
                equivalente a dos outros provedores. */}
            {apple.available ? (
              <View style={{ marginBottom: google.available ? 12 : 0 }}>
                <AppleButton
                  onPress={apple.start}
                  loading={apple.busy}
                  disabled={submitting || google.busy}
                />
              </View>
            ) : null}
            {google.available ? (
              <GoogleButton
                onPress={google.start}
                loading={google.busy}
                disabled={submitting || apple.busy}
              />
            ) : null}
          </>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14 }}>
            Já tem conta?{' '}
          </Text>
          <Link href="/(auth)/login" style={{ fontFamily: fonts.bodyBold, fontSize: 14 }}>
            <Text style={{ color: colors.primary }}>Entrar</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
