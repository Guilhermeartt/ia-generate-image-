# Migração SQLite → Postgres

Guia para quando o app precisar **escalar horizontalmente** (mais de uma
instância) ou quiser backups gerenciados. Enquanto rodar em **uma** instância
GCE, o SQLite atual atende bem — esta migração não é urgente.

## Por que migrar (e quando NÃO)

| Situação | Banco recomendado |
|---|---|
| 1 instância GCE, tráfego baixo/médio | **SQLite** (atual) — simples, rápido, zero custo |
| 2+ instâncias (load balancer / autoscaling) | **Postgres** — SQLite é por-processo, não compartilha estado |
| Precisa de backup gerenciado / PITR | **Postgres** (Cloud SQL faz snapshot automático) |

O rate limiter e o billing já são transacionais; a lógica não muda — só o driver.

## Pré-requisitos (você provisiona)

1. **Instância Postgres** — opções no GCP:
   - **Cloud SQL for PostgreSQL** (gerenciado, ~US$ 10/mês no menor tier)
   - Postgres na própria VM (`apt install postgresql` — já previsto no `setup.sh`)
2. `DATABASE_URL=postgres://user:senha@host:5432/vycena` no `/etc/vycena/env`

## O trabalho de código (estimativa: 1–2 dias)

O `node:sqlite` (`DatabaseSync`) é **síncrono**; o driver `pg` é **assíncrono**.
A migração exige tornar a camada de dados `async`:

### 1. Driver + pool
```bash
npm install pg
```
```js
// server/db.mjs
import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```

### 2. Adaptar a API `db.prepare(...).get/run/all`
Hoje o código usa `db.prepare(sql).get(...)` (síncrono). Com `pg`, vira
`await pool.query(sql, params)`. Duas abordagens:

- **(A) Refactor explícito** — trocar cada chamada por `await pool.query(...)`.
  Mais verboso, mas explícito. Toca ~10 arquivos de rota.
- **(B) Adapter fino** — um wrapper `query(sql).get/all/run` que retorna Promises,
  minimizando o diff. Esconde a assincronicidade (cuidado com `await`).

Recomendado: **(A)**, aceitando tornar as rotas `async` de fato.

### 3. Diferenças de SQL a ajustar
| SQLite | Postgres |
|---|---|
| `INTEGER PRIMARY KEY` | `SERIAL` / `BIGSERIAL` ou `TEXT` (já usamos TEXT ids) |
| `?` placeholders | `$1, $2, …` |
| `INSERT … ON CONFLICT(col) DO UPDATE` | igual (Postgres suporta) ✅ |
| `datetime('now')` | `now()` |
| booleano como `INTEGER 0/1` | `BOOLEAN` |
| `PRAGMA journal_mode/foreign_keys` | remover (Postgres não tem) |

O schema atual usa `TEXT` para ids (UUID) e ISO strings para datas, o que
**facilita** — a maior parte do DDL é portável.

### 4. Migrations versionadas
Trocar o `CREATE TABLE IF NOT EXISTS` inline do `db.mjs` por migrations
(`node-pg-migrate` ou arquivos `.sql` numerados rodados no deploy).

### 5. Migrar os dados existentes
```bash
# Dump do SQLite e carga no Postgres (script único, roda uma vez)
# Para cada tabela: SELECT do SQLite → INSERT no Postgres
```
Como os tipos são simples (TEXT/INTEGER/REAL), um script Node que lê do
`saas.sqlite` e insere no Postgres resolve.

### 6. Transações
O helper `transaction(fn)` (BEGIN/COMMIT/ROLLBACK) vira `async` com
`pool.connect()` + `client.query('BEGIN')`. A lógica de negócio não muda.

## Checklist de corte

- [ ] Postgres provisionado + `DATABASE_URL` no env
- [ ] `pg` instalado, `db.mjs` com pool
- [ ] Camada de dados async (rotas viram `async`)
- [ ] Schema portado + migrations
- [ ] Dados migrados do SQLite
- [ ] `transaction()` async
- [ ] Testes ajustados (hoje usam `DATABASE_FILE=:memory:`; criar um Postgres
      de teste ou manter SQLite só para os testes unitários da lógica pura)
- [ ] Deploy: rodar migrations antes de subir o app

## Estado atual (referência)

Tabelas em `server/db.mjs`: `users`, `plans`, `user_api_keys`, `projects`,
`usage_logs`, `credit_transactions`, `subscriptions`, `payments`,
`password_reset_tokens`, `email_verifications`, `stripe_events`, `rate_limits`.
Todas com ids `TEXT` (UUID) e timestamps ISO — portáveis para Postgres.
