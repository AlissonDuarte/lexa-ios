/**
 * Liga o app ao ciclo de vida das notificacoes: registro, exibicao em
 * foreground e o deep link do toque.
 *
 * Fica separado do registerDevice.ts porque sao dois assuntos: la e "como o
 * backend descobre este aparelho", aqui e "o que acontece quando algo chega".
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../auth/AuthContext';
import { registerForPush } from './registerDevice';

/**
 * No escopo do modulo, nao dentro do componente: o iOS pode entregar uma
 * notificacao antes do primeiro render, e sem handler registrado ela e
 * descartada em silencio. O handler tem 3s para responder.
 *
 * shouldSetBadge fica false de proposito — o `aps.badge` e um numero absoluto
 * que o servidor teria que calcular e manter zerado quando o usuario abre o
 * app. Sem isso o badge gruda num numero errado para sempre.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * As URLs vem do backend no formato da web ('/', '/leitura?lei=cf88'), que por
 * sorte e o mesmo das rotas do expo-router. Validamos mesmo assim: um payload
 * malformado nao pode derrubar o app na abertura.
 */
function toRoute(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || !url.startsWith('/')) return null;
  return url;
}

export function usePushNotifications(): void {
  const { user } = useAuth();
  const router = useRouter();

  // Registro depende do Bearer, entao so roda com sessao. E roda a CADA boot
  // autenticado, nao uma vez so: o device token muda em reinstalacao e em
  // restore de backup, e um token velho no banco vira entrega perdida.
  useEffect(() => {
    if (!user) return;
    void registerForPush({ promptIfNeeded: false });
  }, [user]);

  // Toque na notificacao com o app vivo (foreground ou background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = toRoute(response.notification.request.content.data);
      if (route) router.push(route as never);
    });
    return () => sub.remove();
  }, [router]);

  // Cold start: o app foi aberto pelo toque, entao o listener acima nem existia
  // quando a resposta chegou. O hook devolve a ultima resposta retroativamente.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse) return;
    // O hook mantem a mesma resposta enquanto o app viver; sem esta guarda, um
    // re-render qualquer navegaria de novo por cima do que o usuario estivesse
    // fazendo.
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const route = toRoute(lastResponse.notification.request.content.data);
    if (route) router.push(route as never);
  }, [lastResponse, router]);
}
