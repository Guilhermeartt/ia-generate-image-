import type { CsvRow, StoryboardRow } from '../types';

/**
 * Tokeniza CSV compatível com RFC 4180: campos entre aspas com vírgulas/
 * ponto-e-vírgulas/quebras embutidas, aspas escapadas ("") e finais de linha
 * Windows (\r\n) ou Unix (\n).
 */
const tokeniseCSV = (src: string, delim: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row); // última linha sem \n final
  return rows;
};

/**
 * Faz o parse de um CSV de storyboard nas colunas esperadas
 * (scene_id, sub_id, order, loc, context, style?). Lança Error com mensagem
 * amigável em caso de CSV vazio, sem dados ou com colunas faltando.
 */
export const parseCSV = (text: string): CsvRow[] => {
  if (!text.trim()) {
    throw new Error('O arquivo CSV está vazio.');
  }

  // Detecta o delimitador pela 1ª linha (vírgula vs ponto-e-vírgula) para
  // evitar falsos positivos por dados em campos posteriores.
  const firstLineEnd = text.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolons > commas ? ';' : ',';

  const rows = tokeniseCSV(text.trim(), delimiter);
  if (rows.length < 2) {
    throw new Error('O arquivo CSV deve ter um cabeçalho e pelo menos uma linha de dados.');
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const sceneIdIndex = headers.indexOf('scene_id');
  const subIdIndex = headers.indexOf('sub_id');
  const orderIndex = headers.indexOf('order');
  const locIndex = headers.indexOf('loc');
  const contextIndex = headers.indexOf('context');
  const styleIndex = headers.indexOf('style'); // coluna opcional

  if ([sceneIdIndex, subIdIndex, orderIndex, locIndex, contextIndex].includes(-1)) {
    const missing: string[] = [];
    if (sceneIdIndex === -1) missing.push("'scene_id'");
    if (subIdIndex === -1) missing.push("'sub_id'");
    if (orderIndex === -1) missing.push("'order'");
    if (locIndex === -1) missing.push("'loc'");
    if (contextIndex === -1) missing.push("'context'");
    throw new Error(
      `Não foi possível encontrar as colunas necessárias. Cabeçalhos encontrados:\n${headers.join(', ')}\n` +
        `O CSV deve conter a(s) coluna(s) ${missing.join(', ')}. Verifique a ortografia e certifique-se de que o arquivo usa vírgula (,) ou ponto e vírgula (;) como delimitador.`,
    );
  }

  const data: CsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.every((v) => !v.trim())) continue; // pula linhas em branco
    data.push({
      scene_id: (values[sceneIdIndex] || '').trim(),
      sub_id: (values[subIdIndex] || '').trim(),
      order: (values[orderIndex] || '').trim(),
      loc: (values[locIndex] || '').trim(),
      context: (values[contextIndex] || '').trim(),
      style: (styleIndex > -1 ? values[styleIndex] || '' : '').trim(),
    });
  }
  return data;
};

/** Escapa um valor para CSV (aspas quando há caractere especial). */
export const escapeCsvValue = (value: string): string => {
  const safe = String(value ?? '');
  if (/[",\n\r;]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
};

/** Serializa linhas CsvRow para texto CSV com cabeçalho padrão. */
export const rowsToCsvText = (rows: CsvRow[]): string => {
  const header = ['scene_id', 'sub_id', 'order', 'loc', 'context', 'style'];
  const lines = rows.map((row) =>
    [row.scene_id, row.sub_id, row.order, row.loc, row.context, row.style || '']
      .map(escapeCsvValue)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
};

/** Converte linhas de storyboard (formato da IA) em CsvRow. */
export const storyboardRowsToCsvRows = (rows: StoryboardRow[]): CsvRow[] =>
  rows.map((r) => {
    const contextParts: string[] = [];
    if (r.locucao) contextParts.push(`LOCUÇÃO: ${r.locucao}`);
    if (r.imagem) contextParts.push(r.imagem);
    if (r.lettering) contextParts.push(`LETTERING: ${r.lettering}`);
    return {
      scene_id: String(r.ordem),
      sub_id: '1',
      order: String(r.ordem),
      loc: r.local || '',
      context: contextParts.join('\n') || r.imagem,
      style: r.tipo_cena || '',
    };
  });
