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
├── App.tsx                 # ⚠️ God component (2.7k linhas) — alvo de refatoração
├── index.tsx               # entry: importa CSS, inicia Sentry, monta React
├── index.html              # shell mínimo (CSS agora é buildado)
├── styles/main.css         # design tokens + classes utilitárias + @tailwind
│
├── components/             # 36 componentes (atualmente flat — ver "Alvo" abaixo)
├── hooks/                  # lógica de estado reutilizável (useScenes, useCharacters…)
├── services/               # acesso a API e SDKs
│   ├── geminiService.ts    # chamadas /api/gemini/*
│   ├── saasService.ts      # auth, billing, projetos, admin
│   ├── httpClient.ts       # fetch com CSRF automático
│   └── sentryClient.ts     # Sentry (dynamic import)
├── utils/                  # puro, sem React (promptCoherence, localDraft…)
├── config/                 # prompts e constantes
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

## Qualidade — comandos

```bash
npm run check        # typecheck + lint + testes (gate completo)
npm run test         # Vitest
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # build de produção
```

## Dívida técnica conhecida (priorizada)

1. **`App.tsx` (2.715 linhas, 44 useState)** — quebrar em contexts
   (auth, projeto, settings) + mover handlers para hooks. É a maior dívida.
2. **`SceneCard.tsx` (2.340 linhas)** — decompor em subcomponentes.
3. **Reorganização de `components/` em features/** — fazer JUNTO de (1) e (2),
   pois a quebra realoca os arquivos naturalmente (evita churn duplo).
4. **TypeScript strict completo** — hoje parcial (`noImplicitReturns` etc.);
   `strictNullChecks`/`noImplicitAny` exigem esforço dedicado (~5k erros).
5. **Rate limiter persistente** — hoje in-memory (ok para 1 instância).
6. **SQLite → Postgres** — quando precisar escalar horizontalmente.

## Estrutura-alvo de `components/` (a aplicar na refatoração de App.tsx)

```
components/
├── ui/           # primitivos: Loader, Toast, BatchProgressBar, icons, CreditAlert…
├── storyboard/   # SceneCard, CharacterCard, SceneTableView, *ReviewView, *ReportView
├── editor/       # ImageRegionSelectorModal, StyleSelectionModal, *ReferenceModal
├── modals/       # ScriptPasteModal, ProjectGalleryModal, TextAnalysisModal…
└── account/      # AuthModal, AccountModal, SettingsModal, AdminPanel
```
