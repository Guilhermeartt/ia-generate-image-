import { useEffect, useState } from 'react';
import {
  getTemplateCached,
  getTemplatesCached,
  type TemplateSummary,
} from '../services/templateService';

/** Lista de modelos do usuário (cacheada). Vazia se não autenticado / sem modelos. */
export const useTemplates = (): { templates: TemplateSummary[]; loading: boolean } => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTemplatesCached()
      .then((list) => {
        if (active) setTemplates(list);
      })
      .catch(() => {
        if (active) setTemplates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { templates, loading };
};

/** Mapa id→markup para um conjunto de modelos (ex.: todos os usados num vídeo). */
export const useTemplateMarkups = (
  templateIds: (string | undefined)[],
): Record<string, string> => {
  const key = Array.from(new Set(templateIds.filter((id): id is string => !!id)))
    .sort()
    .join(',');
  const [markups, setMarkups] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setMarkups({});
      return;
    }
    let active = true;
    Promise.allSettled(ids.map((id) => getTemplateCached(id))).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') next[ids[index]] = result.value.markup;
      });
      setMarkups(next);
    });
    return () => {
      active = false;
    };
  }, [key]);

  return markups;
};

/** Markup (re-sanitizado) de um modelo por id, ou null enquanto carrega / sem id. */
export const useTemplateMarkup = (templateId: string | undefined): string | null => {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) {
      setMarkup(null);
      return;
    }
    let active = true;
    getTemplateCached(templateId)
      .then((template) => {
        if (active) setMarkup(template.markup);
      })
      .catch(() => {
        if (active) setMarkup(null);
      });
    return () => {
      active = false;
    };
  }, [templateId]);

  return markup;
};
