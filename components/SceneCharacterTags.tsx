import React, { useState } from 'react';
import type { Character, Scene } from '../types';

interface SceneCharacterTagsProps {
  scene: Scene;
  characters: Character[];
  isBusy: boolean;
  onSceneCharacterEdit?: (
    id: number,
    edit:
      | { type: 'add'; name: string }
      | { type: 'remove'; name: string }
      | { type: 'replace'; from: string; to: string },
  ) => void;
}

/**
 * Tags de personagens de uma cena: lista os presentes, permite trocar,
 * remover e adicionar. Deriva os nomes da cena (detected_characters + tags
 * [Nome]) e do elenco disponível. Extraído do SceneCard.
 */
const SceneCharacterTags: React.FC<SceneCharacterTagsProps> = ({
  scene,
  characters,
  isBusy,
  onSceneCharacterEdit,
}) => {
  const [characterToAdd, setCharacterToAdd] = useState('');

  const characterTags: string[] = Array.from(
    new Set<string>(scene.tagged_description.match(/\[(.*?)\]/g) ?? []),
  );
  const sceneCharacterNames = Array.from(
    new Set(
      [...(scene.detected_characters ?? []), ...characterTags.map((tag) => tag.slice(1, -1))]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );
  const availableCharacterNames = characters.map((char) => char.name).filter(Boolean);
  const addableCharacterNames = availableCharacterNames.filter(
    (name) => !sceneCharacterNames.some((current) => current.toLowerCase() === name.toLowerCase()),
  );

  if (!onSceneCharacterEdit || availableCharacterNames.length === 0) return null;

  const disabled = isBusy || scene.isUpdatingPrompt;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginRight: 2,
        }}
      >
        Personagens:
      </span>

      {sceneCharacterNames.map((name) => (
        <span
          key={name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minHeight: 23,
            padding: '2px 4px 2px 8px',
            borderRadius: 999,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.28)',
            color: '#A5B4FC',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>{name}</span>
          {addableCharacterNames.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const nextName = e.target.value;
                if (!nextName) return;
                onSceneCharacterEdit(scene.id, { type: 'replace', from: name, to: nextName });
              }}
              disabled={disabled}
              title={`Trocar ${name} por outro personagem`}
              style={{
                width: 22,
                height: 18,
                border: 'none',
                borderLeft: '1px solid rgba(165,180,252,0.25)',
                background: 'transparent',
                color: '#C4B5FD',
                fontSize: 10,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">↔</option>
              {addableCharacterNames.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => onSceneCharacterEdit(scene.id, { type: 'remove', name })}
            disabled={disabled}
            title={`Remover ${name} desta cena`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: '#C4B5FD',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              lineHeight: 1,
              opacity: disabled ? 0.5 : 0.9,
            }}
          >
            ×
          </button>
        </span>
      ))}

      {sceneCharacterNames.length === 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Nenhum na cena</span>
      )}

      {addableCharacterNames.length > 0 && (
        <select
          value={characterToAdd}
          onChange={(e) => {
            const nextName = e.target.value;
            setCharacterToAdd('');
            if (!nextName) return;
            onSceneCharacterEdit(scene.id, { type: 'add', name: nextName });
          }}
          disabled={disabled}
          className="field"
          title="Adicionar personagem nesta cena"
          style={{
            width: sceneCharacterNames.length === 0 ? 190 : 150,
            height: 26,
            minHeight: 26,
            padding: '2px 8px',
            fontSize: 11,
          }}
        >
          <option value="">
            {sceneCharacterNames.length === 0 ? '+ Adicionar personagem' : '+ Adicionar'}
          </option>
          {addableCharacterNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default SceneCharacterTags;
