import { useEffect, useRef, useState } from 'react';
import { saveDraft, type DraftState } from '../utils/localDraft';
import { saveCloudProject, type CurrentUser } from '../services/saasService';
import type { ProjectState } from '../types';

export type AutosaveStatus =
  | 'idle'
  | 'saving-local'
  | 'saved-local'
  | 'saving-cloud'
  | 'saved-cloud'
  | 'error';

interface AutosaveOptions {
  enabled: boolean;
  draft: DraftState;
  currentUser: CurrentUser | null;
  cloudProjectId: string | null;
  setCloudProjectId: (id: string) => void;
  localDelay?: number;
  cloudDelay?: number;
}

const draftIsEmpty = (d: DraftState): boolean =>
  d.characters.length === 0 && d.scenes.length === 0 && d.storyboardRows.length === 0;

export function useAutosave({
  enabled,
  draft,
  currentUser,
  cloudProjectId,
  setCloudProjectId,
  localDelay = 1000,
  cloudDelay = 5000,
}: AutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudInFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    if (draftIsEmpty(draft)) return undefined;

    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(async () => {
      setStatus('saving-local');
      await saveDraft({ ...draft, updatedAt: Date.now() });
      setLastSavedAt(Date.now());
      setStatus('saved-local');
    }, localDelay);

    if (currentUser) {
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(async () => {
        if (cloudInFlight.current) return;
        cloudInFlight.current = true;
        setStatus('saving-cloud');
        try {
          const projectState: ProjectState = {
            version: 1,
            fileName: draft.fileMeta?.name || 'Rascunho',
            generalContext: draft.generalContext,
            characters: draft.characters,
            scenes: draft.scenes,
            settings: {
              imageModel: draft.imageModel,
              characterImageModel: draft.characterImageModel,
              aspectRatio: draft.aspectRatio,
              numberOfImages: draft.numberOfImages,
              resolution: draft.resolution,
            },
          };
          const saved = await saveCloudProject(cloudProjectId, projectState);
          if (!cloudProjectId) setCloudProjectId(saved.id);
          setStatus('saved-cloud');
          setLastSavedAt(Date.now());
        } catch (e) {
          console.warn('[useAutosave] cloud save failed', e);
          setStatus('error');
        } finally {
          cloudInFlight.current = false;
        }
      }, cloudDelay);
    }

    return () => {
      if (localTimer.current) clearTimeout(localTimer.current);
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
    };
  }, [enabled, draft, currentUser, cloudProjectId, setCloudProjectId, localDelay, cloudDelay]);

  return { status, lastSavedAt };
}
