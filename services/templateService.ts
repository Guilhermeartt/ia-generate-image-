// ── Biblioteca global de modelos de cena (SVG + slots) ───────────────────────
// CRUD contra /api/templates. Ao carregar, o markup é re-sanitizado no cliente
// antes de entrar no estado/render — o sanitizer (allowlist) é a fronteira de
// confiança, então conteúdo vindo do servidor nunca é renderizado cru.

import { sanitizeSvg } from '../components/svg-editor/svgDocument';
import { apiFetchJson } from './httpClient';
import { getAuthToken } from './saasService';

const apiFetch = <T>(url: string, options: RequestInit = {}): Promise<T> =>
  apiFetchJson<T>(url, { ...options, authToken: getAuthToken() || undefined });

export interface TemplateSummary {
  id: string;
  name: string;
  view_w: number | null;
  view_h: number | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateRecord extends TemplateSummary {
  markup: string;
}

interface SaveTemplateInput {
  name: string;
  markup: string;
  viewW?: number;
  viewH?: number;
}

export const listTemplates = async (): Promise<TemplateSummary[]> => {
  const payload = await apiFetch<{ templates: TemplateSummary[] }>('/api/templates');
  return payload.templates;
};

export const loadTemplate = async (templateId: string): Promise<TemplateRecord> => {
  const payload = await apiFetch<{ template: TemplateRecord }>(`/api/templates/${templateId}`);
  return { ...payload.template, markup: sanitizeSvg(payload.template.markup) };
};

export const createTemplate = async (input: SaveTemplateInput): Promise<TemplateSummary> => {
  const payload = await apiFetch<{ template: TemplateSummary }>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  invalidateTemplateCache();
  return payload.template;
};

export const updateTemplate = async (
  templateId: string,
  input: SaveTemplateInput,
): Promise<TemplateSummary> => {
  const payload = await apiFetch<{ template: TemplateSummary }>(`/api/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  invalidateTemplateCache();
  return payload.template;
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  await apiFetch(`/api/templates/${templateId}`, { method: 'DELETE' });
  invalidateTemplateCache();
};

// ── Cache compartilhado (para consumo nos cards de cena) ─────────────────────
// Evita N requisições quando vários cards usam o mesmo modelo. Invalidado a cada
// mutação (create/update/delete) na biblioteca.

let listCache: Promise<TemplateSummary[]> | null = null;
const markupCache = new Map<string, Promise<TemplateRecord>>();

export const getTemplatesCached = (): Promise<TemplateSummary[]> => (listCache ??= listTemplates());

export const getTemplateCached = (templateId: string): Promise<TemplateRecord> => {
  const cached = markupCache.get(templateId);
  if (cached) return cached;
  const pending = loadTemplate(templateId);
  markupCache.set(templateId, pending);
  return pending;
};

export const invalidateTemplateCache = (): void => {
  listCache = null;
  markupCache.clear();
};
