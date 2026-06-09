import React, { useState } from 'react';
import type { Character, Scene } from '../types';

interface SceneGenerationChecklistProps {
  scene: Scene;
  characters: Character[];
  referenceSceneData: { isValid: boolean; isImageMissing: boolean };
}

type CheckStatus = 'ok' | 'warning' | 'blocked';

interface GenerationCheck {
  label: string;
  detail: string;
  status: CheckStatus;
}

const SceneGenerationChecklist: React.FC<SceneGenerationChecklistProps> = ({
  scene,
  characters,
  referenceSceneData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const letteringNotes = (scene.lettering_notes ?? []).filter(note => note.trim());
  const detectedCharacters = scene.detected_characters ?? [];
  const missingCharacterReferences = detectedCharacters.filter(name => {
    const character = characters.find(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    return !character?.imageUrl;
  });
  const enabledReferences = (scene.references ?? []).filter(reference => reference.enabled !== false);
  const impreciseReferences = enabledReferences.filter(reference =>
    (reference.kind === 'object' || reference.kind === 'screen') && !reference.target?.trim()
  );

  const checks: GenerationCheck[] = [
    {
      label: 'Prompt',
      detail: scene.image_prompt.trim() ? 'Prompt pronto para geração.' : 'Preencha o prompt antes de gerar.',
      status: scene.image_prompt.trim() ? 'ok' : 'blocked',
    },
    {
      label: 'Texto visível',
      detail: scene.includeLettering !== false && letteringNotes.length > 0
        ? `Somente o lettering indicado será permitido (${letteringNotes.length} ${letteringNotes.length === 1 ? 'linha' : 'linhas'}).`
        : 'Nenhum lettering permitido; a geração receberá uma proibição explícita de texto.',
      status: 'ok',
    },
    {
      label: 'Continuidade',
      detail: !scene.isContinuation
        ? 'Cena independente.'
        : !referenceSceneData.isValid
          ? 'A ordem de referência é inválida ou aponta para a própria cena.'
          : referenceSceneData.isImageMissing
            ? 'A cena de referência ainda não tem imagem.'
            : 'Referência de continuidade pronta.',
      status: !scene.isContinuation
        ? 'ok'
        : !referenceSceneData.isValid || referenceSceneData.isImageMissing
          ? 'blocked'
          : 'ok',
    },
    {
      label: 'Personagens',
      detail: detectedCharacters.length === 0
        ? 'Nenhum personagem detectado nesta cena.'
        : missingCharacterReferences.length > 0
          ? `Sem imagem de referência: ${missingCharacterReferences.join(', ')}.`
          : 'Todos os personagens detectados têm referência visual.',
      status: missingCharacterReferences.length > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Referências extras',
      detail: enabledReferences.length === 0
        ? 'Nenhuma referência extra ativa.'
        : impreciseReferences.length > 0
          ? `${impreciseReferences.length} referência(s) de objeto/tela sem local de aplicação.`
          : `${enabledReferences.length} referência(s) ativa(s) e configurada(s).`,
      status: impreciseReferences.length > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Frame final',
      detail: scene.end_frame_prompt?.trim()
        ? 'Prompt de continuidade disponível e sujeito à mesma regra de texto.'
        : 'Sem prompt de frame final; a ação de vídeo ficará indisponível.',
      status: scene.end_frame_prompt?.trim() ? 'ok' : 'warning',
    },
  ];

  const blockedCount = checks.filter(check => check.status === 'blocked').length;
  const warningCount = checks.filter(check => check.status === 'warning').length;
  const summaryColor = blockedCount > 0 ? 'var(--red)' : warningCount > 0 ? 'var(--amber)' : '#34D399';

  return (
    <div style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-2)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Checklist de geração
        </span>
        <span aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: summaryColor, fontWeight: 700 }}>
          {blockedCount > 0 ? `${blockedCount} bloqueio(s)` : warningCount > 0 ? `${warningCount} atenção` : 'Pronto'}
          <span aria-hidden="true" style={{ color: 'var(--text-4)' }}>{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 10px 9px', display: 'grid', gap: 6 }}>
          {checks.map(check => {
            const color = check.status === 'blocked' ? 'var(--red)' : check.status === 'warning' ? 'var(--amber)' : '#34D399';
            return (
              <div className="scene-checklist-row" key={check.label} style={{ display: 'grid', gridTemplateColumns: '12px 92px 1fr', gap: 6, alignItems: 'start' }}>
                <span aria-hidden="true" style={{ color, fontSize: 11 }}>{check.status === 'ok' ? '✓' : check.status === 'warning' ? '!' : '×'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>{check.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.45 }}>{check.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SceneGenerationChecklist;
