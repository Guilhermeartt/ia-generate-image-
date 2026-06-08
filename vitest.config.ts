import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,mjs}'],
    exclude: ['node_modules', 'dist', '.venv-sam2'],
    // Testes nunca tocam no banco real: usam SQLite em memória.
    env: {
      DATABASE_FILE: ':memory:',
      NODE_ENV: 'test',
      APP_SECRET: 'test-secret-com-mais-de-32-caracteres-aqui-ok',
      APP_ENCRYPTION_KEY: 'test-encryption-key-com-32-chars-ok-vai',
      ADMIN_EMAILS: 'admin@test.dev',
    },
    // Cada arquivo de teste roda em seu próprio processo, isolando o estado do
    // módulo db.mjs (singleton SQLite) entre suites.
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
  },
});
