/**
 * Extrai o primeiro número de uma string (ex.: "Cena 3" → 3). Retorna NaN
 * quando não há dígitos. Usado para tolerar valores como "Cena 1" nas colunas
 * numéricas do CSV.
 */
export const extractNumberFromString = (value: string): number => {
  if (!value) return NaN;
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : NaN;
};

/**
 * Remove instruções de "LETTERING: ..." da descrição da cena, deixando só o
 * conteúdo visual. Limpa pontuação/espaços órfãos resultantes. Função pura
 * extraída do fluxo de análise (estava duplicada nos dois caminhos).
 */
export const stripLetteringFromDescription = (text: string): string => {
  if (!text) return '';
  return text
    // Remove "LETTERING: ..." até o fim da linha ou da string
    .replace(/\s*LETTERING\s*:\s*[^\n]*/gi, '')
    // Limpa pontuação/espaço órfão deixado nas quebras de linha
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\.\s*$/, '.')
    .trim();
};
