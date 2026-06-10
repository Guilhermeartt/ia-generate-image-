export type SceneErrorKind =
  | 'no-credits'
  | 'rate-limit'
  | 'prompt-rejected'
  | 'auth'
  | 'network'
  | 'server'
  | 'unknown';

export interface ClassifiedError {
  kind: SceneErrorKind;
  /** Mensagem amigável para o usuário. */
  message: string;
  /** Rótulo do CTA primário. */
  ctaLabel: string;
  /** Quando true, o CTA padrão é "Tentar novamente"; caso contrário, é específico. */
  retryable: boolean;
  /** Sugestão acionável adicional. */
  hint?: string;
}

const CREDIT_PATTERNS = /sem cr[eé]dito|insufficient (credits?|funds|balance)|saldo insuficiente|billing/i;
const RATE_LIMIT_PATTERNS = /rate.?limit|too many requests|429|throttle/i;
const PROMPT_PATTERNS = /prompt|policy|content (policy|filter|moderation)|safety|blocked content|unsafe/i;
const AUTH_PATTERNS = /unauthori[sz]ed|forbidden|401|403|invalid api key|api key/i;
const NETWORK_PATTERNS = /network|timeout|fetch failed|ENOTFOUND|ECONNRESET|connection|offline/i;
const SERVER_PATTERNS = /500|502|503|504|internal server|gateway/i;

export const classifyError = (raw: string | undefined): ClassifiedError => {
  const text = (raw ?? '').trim();
  if (!text) {
    return {
      kind: 'unknown',
      message: 'Não foi possível gerar a imagem.',
      ctaLabel: 'Tentar novamente',
      retryable: true,
    };
  }

  if (CREDIT_PATTERNS.test(text)) {
    return {
      kind: 'no-credits',
      message: 'Você está sem créditos suficientes para esta geração.',
      ctaLabel: 'Comprar créditos',
      retryable: false,
      hint: 'O custo desta cena pode ser visto no resumo acima.',
    };
  }

  if (RATE_LIMIT_PATTERNS.test(text)) {
    return {
      kind: 'rate-limit',
      message: 'Limite de requisições atingido.',
      ctaLabel: 'Aguardar e tentar de novo',
      retryable: true,
      hint: 'Aguarde de 30s a 1min antes de gerar novamente.',
    };
  }

  if (PROMPT_PATTERNS.test(text)) {
    return {
      kind: 'prompt-rejected',
      message: 'O prompt foi rejeitado pela política de conteúdo.',
      ctaLabel: 'Editar prompt',
      retryable: false,
      hint: 'Remova menções a violência, conteúdo sensível ou identifique melhor o contexto criativo.',
    };
  }

  if (AUTH_PATTERNS.test(text)) {
    return {
      kind: 'auth',
      message: 'Falha de autenticação com o provedor de IA.',
      ctaLabel: 'Verificar API Key',
      retryable: false,
      hint: 'Confira a chave Gemini nas configurações.',
    };
  }

  if (NETWORK_PATTERNS.test(text)) {
    return {
      kind: 'network',
      message: 'Falha de conexão com o servidor.',
      ctaLabel: 'Tentar novamente',
      retryable: true,
      hint: 'Verifique sua conexão de internet.',
    };
  }

  if (SERVER_PATTERNS.test(text)) {
    return {
      kind: 'server',
      message: 'O serviço de geração de IA está instável.',
      ctaLabel: 'Tentar novamente',
      retryable: true,
      hint: 'Aguarde alguns instantes e tente outra vez.',
    };
  }

  return {
    kind: 'unknown',
    message: text.length > 160 ? `${text.slice(0, 157)}…` : text,
    ctaLabel: 'Tentar novamente',
    retryable: true,
  };
};
