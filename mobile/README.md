# Lexa Mobile

App nativo (iOS/Android) em React Native + Expo, consumindo a mesma API DRF que
o frontend SvelteKit.

## Requisitos

- **Node 22** (o SDK 57 exige 20+; a 20 saiu do suporte em abril/2026).
  `nvm use 22`
- Para iOS **não é preciso Mac**: o build roda no runner `macos-15` do GitHub
  Actions. Ver `.github/workflows/mobile-ios.yml`.

## Rodar em desenvolvimento

```bash
cd mobile
npm install
cp .env.example .env      # ajuste EXPO_PUBLIC_API_URL
npm start                 # leia o QR code com o Expo Go
```

`EXPO_PUBLIC_API_URL` **não pode ser `localhost`** quando o app roda num
aparelho físico — o telefone resolveria para ele mesmo. Use o IP da máquina na
LAN, e adicione esse IP ao `ALLOWED_HOSTS` no `.env` da raiz do repo.

O `app.config.ts` injeta a exceção de App Transport Security
(`NSAllowsLocalNetworking`) automaticamente **apenas** quando a URL configurada
é `http://`. Um build apontando para `https://lexaclub.com.br/api` sai sem
nenhuma brecha de cleartext.

## Estrutura

```
app/                    rotas (expo-router, file-based)
  _layout.tsx           AuthProvider, fontes e o guard central de rota
  (auth)/               login, registro
  (tabs)/               dashboard, sequencia, perfil
  leitura.tsx           o fluxo de estudo (fora das tabs, tela cheia)
src/
  api/types.ts          contrato da API, derivado dos serializers DRF
  api/client.ts         fetch tipado, com refresh de token
  auth/                 AuthContext + persistencia (SecureStore)
  theme/palette.js      paleta (CommonJS: o tailwind.config.js consome)
  theme/tokens.ts       tokens tipados + metadados por lei
  components/           PushButton, Field
```

`ios/` e `android/` **não são versionados**: são gerados por `expo prebuild` no
CI (continuous native generation).

## Escopo

v1 cobre o core loop: autenticação, dashboard com a trilha, leitura, streak e
perfil. Ficaram para depois: ranking, conquistas, roadmap, push nativo e
offline.

## Relação com o frontend web

O `src/api/client.ts` é um porte de `frontend/src/lib/api.js` com três
diferenças deliberadas:

1. **Persiste o refresh token.** A web recebe `{user, access, refresh}` e
   descarta o refresh; com `ACCESS_TOKEN_LIFETIME` de 7 dias isso forçaria
   re-login semanal num app nativo. Depende da rota `/api/token/refresh/`,
   ligada em `backend/lexa/urls.py`.
2. **Sem `window.location`** no 401: o AuthContext reseta a sessão e o
   expo-router navega.
3. **Lança `ApiError`** (subclasse de `Error`) em vez de um objeto cru,
   preservando `status` e `data`.

O guard de rota também é centralizado em `app/_layout.tsx`, em vez de repetido
no `onMount` de cada página como na web.

Como o backend não expõe OpenAPI, `src/api/types.ts` é a documentação de facto
do contrato — ao mexer num serializer, atualize esse arquivo.

## Build iOS

Dois workflows, ambos em runner macOS:

- `mobile-ios-credentials.yml` — `workflow_dispatch`, roda **uma vez**. Cria
  certificado e provisioning profile via `fastlane match` e guarda cifrados num
  repo git privado separado.
- `mobile-ios.yml` — `workflow_dispatch` (lane `build_only` ou `beta`) ou push
  de tag `mobile-v*`. Faz `expo prebuild`, `pod install`, assina e envia para o
  TestFlight.

O repo é privado, e runner macOS consome minutos com **multiplicador 10x**: os
2.000 min/mês gratuitos equivalem a ~200 min de macOS, e um build leva 15–25
min. Por isso nenhum dos dois roda em push comum. Valide o que der localmente
(`npm run typecheck`, `npx expo export`, `npx expo run:android`) antes de
gastar minuto de macOS.

### Secrets necessários

| Secret | O que é |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://lexaclub.com.br/api` |
| `APPLE_TEAM_ID` | Team ID da conta Apple Developer |
| `ASC_KEY_ID` / `ASC_ISSUER_ID` | App Store Connect API Key |
| `ASC_KEY_P8` | o arquivo `.p8` da chave, em base64 |
| `MATCH_GIT_URL` | repo **privado e separado** para os certificados |
| `MATCH_PASSWORD` | senha que cifra esse repo |
| `MATCH_GIT_BASIC_AUTHORIZATION` | base64 de `usuario:token` com acesso a ele |
