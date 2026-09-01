/**
 * Rota raiz.
 *
 * Existe porque `/` precisa casar com algum arquivo: sem isto o app abre na
 * tela "Unmatched Route" do expo-router. O guard do _layout.tsx nao cobre este
 * caso — ele redireciona via useEffect, que num build de producao chega a rodar
 * antes do navegador estar montado e e descartado. `<Redirect>` e declarativo e
 * o router o resolve na ordem certa.
 */
import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthContext';

export default function Index() {
  const { token, loading } = useAuth();

  // A splash ainda esta na tela enquanto a sessao persistida carrega.
  if (loading) {
    return null;
  }

  return <Redirect href={token ? '/(tabs)/dashboard' : '/(auth)/login'} />;
}
