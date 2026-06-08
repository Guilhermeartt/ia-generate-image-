import type { Character, Scene, StoryboardRow, ImageModel } from '../types';
import type { StyleOption } from '../components/StyleSelectionModal';

const DB_NAME = 'storyboard-app';
const STORE_NAME = 'drafts';
const KEY = 'current';
const DB_VERSION = 1;

export interface DraftState {
  version: 1;
  updatedAt: number;
  fileMeta: { name: string; type: string } | null;
  generalContext: string;
  forcePortugueseText: boolean;
  characters: Character[];
  scenes: Scene[];
  storyboardRows: StoryboardRow[];
  globalStyle: StyleOption | null;
  referenceImage: { base64: string; mimeType: string } | null;
  cloudProjectId: string | null;
  imageModel: ImageModel;
  characterImageModel: ImageModel;
  aspectRatio: string;
  resolution: '1K' | '2K' | '4K';
  numberOfImages: number;
  activeView: 'characters' | 'scenes' | 'costs';
  scenesViewMode: 'cards' | 'table';
  availableStyles: string[];
}

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const runOnStore = async <T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const req = op(tx.objectStore(STORE_NAME));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

export const saveDraft = async (state: DraftState): Promise<void> => {
  try {
    await runOnStore('readwrite', (s) => s.put(state, KEY));
  } catch (e) {
    console.warn('[localDraft] save failed', e);
  }
};

export const loadDraft = async (): Promise<DraftState | null> => {
  try {
    const result = await runOnStore<DraftState | undefined>('readonly', (s) => s.get(KEY));
    return result ?? null;
  } catch (e) {
    console.warn('[localDraft] load failed', e);
    return null;
  }
};

export const clearDraft = async (): Promise<void> => {
  try {
    await runOnStore('readwrite', (s) => s.delete(KEY));
  } catch (e) {
    console.warn('[localDraft] clear failed', e);
  }
};

export const draftHasContent = (d: DraftState | null): boolean =>
  !!d && (d.characters.length > 0 || d.scenes.length > 0 || d.storyboardRows.length > 0);
