import React from 'react';
import type { Scene } from '../../types';
import { useTemplates } from '../../hooks/useTemplates';

interface SceneTemplateControlProps {
  scene: Scene;
  disabled?: boolean;
  onChange: (templateId: string | undefined) => void;
}

/**
 * Seletor compacto que associa um modelo da biblioteca a uma cena. Não renderiza
 * nada se o usuário não tiver modelos (ou não estiver autenticado).
 */
const SceneTemplateControl: React.FC<SceneTemplateControlProps> = ({
  scene,
  disabled,
  onChange,
}) => {
  const { templates } = useTemplates();
  if (templates.length === 0) return null;

  return (
    <label
      className="sc-template-control"
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginTop: 8 }}
    >
      <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>Modelo</span>
      <select
        value={scene.templateId ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
        style={{ flex: 1, fontSize: 11 }}
      >
        <option value="">Sem modelo</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
    </label>
  );
};

export default SceneTemplateControl;
