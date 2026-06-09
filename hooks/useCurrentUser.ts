import { useState, useEffect } from 'react';
import {
  getGeminiServerStatus,
  registerUserEmitter,
  type PlatformProvider,
} from '../services/geminiService';
import { getCurrentUser, type CurrentUser } from '../services/saasService';

/**
 * Gerencia o usuário autenticado e o status do provedor de IA da plataforma.
 * Centraliza a inicialização (status do servidor + sessão atual) e mantém o
 * `currentUser` sincronizado via emitter disparado pelas chamadas de API.
 * Extraído de App.tsx.
 */
export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hasServerPlatformKey, setHasServerPlatformKey] = useState(false);
  const [platformProvider, setPlatformProvider] = useState<PlatformProvider>(null);

  useEffect(() => {
    // Qualquer chamada de API que retorne um usuário atualizado o propaga aqui.
    registerUserEmitter((user) => setCurrentUser(user));

    getGeminiServerStatus()
      .then((status) => {
        setHasServerPlatformKey(status.hasPlatformKey);
        setPlatformProvider(status.platformProvider ?? null);
        if (status.user) setCurrentUser(status.user as CurrentUser);
      })
      .catch(() => {
        setHasServerPlatformKey(false);
        setPlatformProvider(null);
      });

    getCurrentUser().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  return {
    currentUser,
    setCurrentUser,
    hasServerPlatformKey,
    platformProvider,
  };
}
