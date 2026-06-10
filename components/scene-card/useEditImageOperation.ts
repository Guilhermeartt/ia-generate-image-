import { useCallback, useState } from 'react';

export interface EditImageResult {
  base64Data: string;
  mimeType: string;
}

export type EditImageService = (base64: string, prompt: string) => Promise<EditImageResult>;

interface UseEditImageOperationOptions {
  editImageService: EditImageService;
  sceneId: number;
  imageUrl: string | undefined;
  onImageUpdate: (id: number, newImageUrl: string, newMimeType: string) => void;
  onSuccess?: () => void;
}

interface UseEditImageOperationResult {
  isLoading: boolean;
  error: string | null;
  run: (prompt: string) => Promise<void>;
  reset: () => void;
}

/**
 * Encapsula a operação "editar a imagem da cena via serviço de IA + emitir update".
 * Substitui o pattern duplicado de handleConfirmEdit / handleRemoveVisualElements.
 */
export const useEditImageOperation = ({
  editImageService,
  sceneId,
  imageUrl,
  onImageUpdate,
  onSuccess,
}: UseEditImageOperationOptions): UseEditImageOperationResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (prompt: string) => {
      if (!imageUrl) return;
      setIsLoading(true);
      setError(null);
      try {
        const { base64Data, mimeType } = await editImageService(imageUrl, prompt);
        onImageUpdate(sceneId, `data:${mimeType};base64,${base64Data}`, mimeType);
        setIsLoading(false);
        onSuccess?.();
      } catch (e) {
        setIsLoading(false);
        setError(e instanceof Error ? e.message : 'Falha ao editar a imagem.');
      }
    },
    [editImageService, imageUrl, onImageUpdate, sceneId, onSuccess],
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return { isLoading, error, run, reset };
};
