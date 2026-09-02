# Lexa Mobile

App nativo (iOS/Android) em React Native + Expo, consumindo a mesma API DRF que
o frontend SvelteKit.

## Requisitos

- **Node 22** (o SDK 57 exige 20+; a 20 saiu do suporte em abril/2026).
  `nvm use 22`
- Para iOS **não é preciso Mac**: o build roda no runner `macos-26` do GitHub
  Actions. Ver `.github/workflows/ios.yml`.

## Rodar em desenvolvimento

```bash
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

- `ios-credentials.yml` — `workflow_dispatch`, roda **uma vez**. Cria
  certificado e provisioning profile via `fastlane match` e guarda cifrados num
  repo git privado separado.
- `ios.yml` — `workflow_dispatch` (seletor de lane, **default `beta`**) ou push
  de tag `v*`. O lane `beta` faz `expo prebuild`, `pod install`, assina e envia
  para o TestFlight; `build_only` para antes do upload, útil para validar
  prebuild, pods e assinatura sem consumir número de build. Tag sempre publica.

O repo é privado, e runner macOS consome minutos com **multiplicador 10x**: os
2.000 min/mês gratuitos equivalem a ~200 min de macOS, e um build leva 15–25
min. Por isso nenhum dos dois roda em push comum. Valide o que der localmente
(`npm run typecheck`, `npx expo export`, `npx expo run:android`) antes de
gastar minuto de macOS.

### Login com Google

O botão "Continuar com o Google" só aparece quando os dois client IDs estão
configurados; sem eles o app funciona normalmente, só com usuário e senha.

Isso é o certo dentro do app — melhor nenhum botão do que um que só falharia ao
ser tocado —, mas foi exatamente o que já fez sair um TestFlight sem login
social, sem erro nenhum no log: o `.env` não é versionado, então numa build de
CI os valores só chegam pelos **secrets do repositório**. Por isso `ios.yml`
agora confere os secrets antes do prebuild e o Info.plist depois dele, e falha
o build em vez de esconder o botão.

1. No Google Cloud Console (**APIs e serviços › Credenciais**), no mesmo projeto
   que já atende o site, crie um **client ID OAuth do tipo iOS** com o bundle
   `com.lexaclub.app`.
2. Preencha `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` com ele e
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` com o client **web** que o site já usa
   (`PUBLIC_GOOGLE_CLIENT_ID`). O URL scheme do callback é derivado do client
   iOS automaticamente, em `app.config.ts`.
3. No backend, `GOOGLE_CLIENT_ID` e `GOOGLE_IOS_CLIENT_ID` são passados **os
   dois** como audiência para `id_token.verify_oauth2_token`
   (`apps/users/views.py`), porque o `aud` do token muda conforme a origem: o
   site manda o client web e o app manda o client iOS.

O módulo é **nativo**: não funciona no Expo Go. Em desenvolvimento use um
development build (`npx expo run:ios`) para testar esta tela.

### Sign in with Apple

Obrigatório pela **Guideline 4.8** da App Store: um app que oferece login social
de terceiros (aqui, o Google) precisa oferecer o da Apple também.

Diferente do Google, não há client ID para configurar — o `aud` do identity
token é o próprio bundle (`com.lexaclub.app`), então o botão não depende de
secret nenhum. A disponibilidade é decidida em runtime por
`AppleAuthentication.isAvailableAsync()`: aparece no iOS 13+, some no Android.

O que precisa de atenção é a **assinatura**. `usesAppleSignIn: true` faz o
prebuild escrever o entitlement `com.apple.developer.applesignin`, e um
provisioning profile sem essa capability quebra o archive. Na primeira build
depois desta mudança, nesta ordem:

1. No Apple Developer portal, habilite **Sign In with Apple** no App ID
   `com.lexaclub.app`.
2. Rode o workflow `ios-credentials.yml` — ele chama `fastlane certificates`
   com `readonly: false` e `force: true`, regenerando o profile com a
   capability nova.
3. Só então rode `ios.yml`. Sem o passo 2, o `match(readonly: true)` devolve o
   profile antigo e o archive falha com *"Provisioning profile ... doesn't
   include the com.apple.developer.applesignin entitlement"*.

A ordem importa e o `force: true` também. O profile é gerado a partir das
capabilities que o App ID tem **no momento em que nasce**: rodar o passo 2 antes
do 1 só regenera o mesmo profile incompleto, e sem `force` o `match` nem
regenera — ele vê que o profile guardado ainda é válido (ele não olha
capabilities), diz "All required keys, certificates and provisioning profiles
are installed 🙌" e o build seguinte falha idêntico.

Nome e e-mail só chegam na **primeira** autorização de cada usuário; depois
disso a Apple manda apenas o `sub`. É por isso que o app envia esses campos no
corpo do `POST /auth/apple/` e o backend só os usa ao criar a conta.

O módulo também é nativo: não funciona no Expo Go.

### Secrets necessários

| Secret | O que é |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://lexaclub.com.br/api` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | client OAuth **web** (o mesmo do site) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | client OAuth **iOS** do bundle `com.lexaclub.app` |
| `APPLE_TEAM_ID` | Team ID da conta Apple Developer |
| `ASC_KEY_ID` / `ASC_ISSUER_ID` | App Store Connect API Key |
| `ASC_KEY_P8` | o arquivo `.p8` da chave, em base64 |
| `MATCH_GIT_URL` | repo **privado e separado** para os certificados |
| `MATCH_PASSWORD` | senha que cifra esse repo |
| `MATCH_GIT_BASIC_AUTHORIZATION` | base64 de `usuario:token` com acesso a ele |
