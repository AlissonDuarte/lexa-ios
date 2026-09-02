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

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const google = useGoogleAuth(setError);
  const apple = useAppleAuth(setError);

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !submitting && !google.busy && !apple.busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.login({ username: username.trim(), password });
      await signIn(data);
      // A navegacao e do RouteGuard: ele reage ao token aparecer.
    } catch (e) {
      // O backend responde em pt-BR (ex.: "Credenciais inválidas."), entao a
      // mensagem vai crua para a tela, igual a web.
      const msg =
        e instanceof ApiError
          ? e.data?.error || e.data?.detail || 'Não foi possível entrar.'
          : 'Sem conexão com o servidor.';
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
            fontSize: 40,
            color: colors.primary,
            textAlign: 'center',
          }}
        >
          Lexa
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 15,
            color: colors.muted,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 32,
          }}
        >
          Lei seca, todo dia.
        </Text>

        <Field
          label="Usuário"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
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
          <PushButton label="Entrar" onPress={handleSubmit} disabled={!canSubmit} />
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
            Não tem conta?{' '}
          </Text>
          <Link href="/(auth)/register" style={{ fontFamily: fonts.bodyBold, fontSize: 14 }}>
            <Text style={{ color: colors.primary }}>Criar conta</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
