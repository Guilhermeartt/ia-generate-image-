import React, { useMemo } from 'react';

interface SafeTaggedDescriptionProps {
  text: string;
  className?: string;
}

interface Token {
  type: 'text' | 'tag';
  value: string;
}

const TAG_REGEX = /\[([^\]]+)\]/g;

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: 'tag', value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return tokens;
};

/**
 * Renderiza uma descrição que pode conter marcadores `[Nome]` como `<strong>`,
 * sem `dangerouslySetInnerHTML`. Texto livre do usuário entra como `textContent`,
 * eliminando o vetor de XSS.
 */
const SafeTaggedDescription: React.FC<SafeTaggedDescriptionProps> = ({ text, className }) => {
  const tokens = useMemo(() => tokenize(text), [text]);

  return (
    <p className={className}>
      {tokens.map((token, index) =>
        token.type === 'tag' ? (
          <strong key={index} aria-label={`marcador ${token.value}`}>
            [{token.value}]
          </strong>
        ) : (
          <React.Fragment key={index}>{token.value}</React.Fragment>
        ),
      )}
    </p>
  );
};

export default SafeTaggedDescription;
