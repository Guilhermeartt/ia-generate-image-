# Arquitetura — Vycena (Estúdio de Roteiro Visual)

Documento de referência da estrutura do projeto, convenções e decisões.
Mantenha-o atualizado quando mover/adicionar módulos relevantes.

## Visão geral

SaaS de geração de storyboards com IA (Gemini/Vertex). SPA React servida pelo
próprio backend Express, que também faz proxy autenticado para as APIs de IA,
billing por créditos e gestão de usuários.

```
Browser (SPA React 19 + Vite)
        │  /api/*  (cookie httpOnly + CSRF)
        ▼
Express (server/geminiProxy.mjs)
        │
        ├── auth / billing / créditos       → SQLite (node:sqlite)
        ├── proxy Gemini / Vertex (BYOK ou plataforma)
        ├── Stripe (checkout + webhooks)
        └── SAM2 (serviço Python opcional)
```

## Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19, Tailwind v3 (PostCSS), CSS tokens em `styles/main.css` |
| Vídeo | Remotion 4 + `@remotion/player` para preview programático do storyboard |
| Build | Vite 6 (code-splitting por `React.lazy`) |
| Backend | Express 4, `node:sqlite` (DatabaseSync) |
| Auth | HMAC token + cookie httpOnly, pbkdf2, AES-256-GCM, CSRF double-submit |
| Pagamento | Stripe (assinatura + webhooks idempotentes) |
| Validação | Zod (`server/validation.mjs`) |
| Observabilidade | Sentry (opcional via DSN), logs ndjson (Cloud Logging) |
| Qualidade | ESLint flat, Prettier, TypeScript (strict incremental), Vitest |

## Estrutura de diretórios

```
projeto/
├── App.tsx                 # orquestração da SPA (~2.8k linhas; ver dívida técnica)
├── index.tsx               # entry: importa CSS, inicia Sentry, monta React
├── index.html              # shell mínimo (CSS agora é buildado)
├── styles/main.css         # design tokens + classes utilitárias + @tailwind
│
├── components/             # componentes (flat — ver "Alvo" abaixo)
│   ├── layout/             # Sidebar, Topbar, MobileBottomNav (navegação)
│   └── video/              # composição Remotion e estúdio de preview
├── hooks/                  # lógica de estado reutilizável (useScenes, useCharacters…)
│   └── useNavigation.ts    # view ativa, hash da URL (#/cenas), painéis
├── services/               # acesso a API e SDKs
│   ├── geminiService.ts    # chamadas /api/gemini/*
│   ├── saasService.ts      # auth, billing, projetos, admin
│   ├── httpClient.ts       # fetch com CSRF automático
│   └── sentryClient.ts     # Sentry (dynamic import)
├── utils/                  # puro, sem React (promptCoherence, localDraft…)
├── config/                 # prompts, constantes e registry de views
│   └── views.tsx           # fonte única das views (id, slug, rótulos, ícone)
│
├── server/                 # backend Node
│   ├── geminiProxy.mjs     # entry: middlewares, registro de rotas
│   ├── db.mjs              # conexão SQLite + schema + helper transaction()
│   ├── auth.mjs           # cripto, tokens, middlewares de auth
│   ├── billing.mjs        # cálculo de custo, reserva/débito de crédito
│   ├── stripe.mjs         # cliente Stripe + grant de créditos
│   ├── validation.mjs     # schemas Zod
│   ├── csrf.mjs           # middleware CSRF
│   ├── requestLogger.mjs  # log estruturado (Cloud Logging)
│   ├── sentry.mjs         # Sentry backend
│   └── routes/            # auth, account, project, admin, gemini, sam2, stripe, health
│
├── deploy/                 # scripts de deploy GCE (setup, deploy, nginx, systemd)
└── *.test.mjs              # testes Vitest (server/*.test.mjs)
```

## Convenções

- **Imports**: alias `@/*` configurado (tsconfig + vite) aponta para a raiz.
  Prefira `@/services/...` a `../../services/...` em código novo.
- **Estado de servidor é a fonte da verdade** para créditos/plano; o front
  espelha via `publicUser`.
- **Toda escrita que toca crédito/dinheiro passa por `transaction()`** (atômica).
- **Toda rota POST/PUT/PATCH/DELETE exige CSRF** (exceto webhook Stripe, que
  valida assinatura própria).
- **Entrada de rota crítica é validada com Zod** antes de tocar o banco.
- **Segredos nunca em log** (`requestLogger` mascara campos sensíveis).
- **Navegação**: as views de produção vivem no registry `config/views.tsx`
  (id, slug, rótulos, ícone). Sidebar, Topbar, MobileBottomNav e o hash da
  URL derivam de lá — para criar uma view nova, adicione uma entrada no
  registry e o bloco de conteúdo correspondente em `App.tsx`. Navegação do
  usuário usa `navigateTo` (empilha histórico → voltar/avançar funciona);
  mudanças programáticas usam `setActiveView` (substitui o hash).

## Qualidade — comandos

```bash
npm run check        # typecheck + lint + testes (gate completo)
npm run test         # Vitest
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # build de produção
```

## Dívida técnica

### Resolvida ✅
- **`SceneCard.tsx`: 2.340 → 1.120 linhas (−52%)** — decomposto em
  `SceneActionButtons`, `SceneSplitGrid`, `SceneReferencePanel`,
  `SceneCharacterTags`, `SceneLettering`, `SceneContinuation`,
  `SceneSplitSuggestion` + helpers (`utils/imageHelpers`),
  primitivos (`ui/Spinner`, `ui/ImgBtn`) e constantes. Com rede de testes
  de render (`SceneCard.test.tsx`).
- **`App.tsx`: 2.715 → 2.466 linhas** — concerns extraídos para hooks
  (`useToast`, `useTheme`, `useCurrentUser`, `useAnalysisHistory`,
  `usePresets`, `useTextCosts`) e utils puros (`csv`, `docx`).
- **Navegação extraída de `App.tsx` (−~250 linhas)** — layout em
  `components/layout/` (Sidebar, Topbar, MobileBottomNav), estado em
  `hooks/useNavigation.ts` (com hash routing `#/cenas`) e registry único de
  views em `config/views.tsx` (antes a definição era triplicada).

### Pendente (priorizada)
1. **`App.tsx` em ~2.8k linhas** (cresceu com a integração do estúdio de
   vídeo) — o fluxo de análise (`handleAnalyze`)
   e os handlers de imagem orquestram vários hooks; extração exige lift de
   estado. Menor prioridade agora que está sob controle.
2. **TypeScript strict completo** — hoje parcial (`noImplicitReturns` etc.);
   `strictNullChecks`/`noImplicitAny` exigem esforço dedicado (~5k erros).
3. **Rate limiter persistente** — hoje in-memory (ok para 1 instância).
4. **SQLite → Postgres** — quando precisar escalar horizontalmente.

## Estrutura de `components/`

A pasta `ui/` foi iniciada (primitivos sem estado). Sub-componentes de cena
ficam colocados (`Scene*.tsx`). Uma reorganização completa em features/
(storyboard, editor, account…) pode ser feita quando conveniente — agora é
churn de imports, não pré-requisito.
