/** Estado consolidado do SceneCard via reducer. Substitui 11 useState. */

export interface SceneCardLocalState {
  /** Modal de edição da imagem aberto. */
  isEditModalOpen: boolean;
  /** Modal de divisão de cena aberto. */
  isSplitModalOpen: boolean;
  /** Painel de refinamento expandido. */
  showRefinement: boolean;
  /** Controle 3D de câmera expandido. */
  isCameraControlOpen: boolean;
  /** Modal de referência aberto. */
  isRefPanelOpen: boolean;
  /** Modal de direção criativa aberto. */
  isCreativeOpen: boolean;
  /** Modal de comparação A/B aberto. */
  isCompareOpen: boolean;
  /** Split atualmente sendo editado (ou null). */
  editingSplit: { id: string; imageUrl: string } | null;
  /** Texto rascunho da direção criativa. */
  creativeDirection: string;
  /** Tooltip de referência aberto via clique (touch). */
  isRefTooltipOpen: boolean;
}

export const initialSceneCardState: SceneCardLocalState = {
  isEditModalOpen: false,
  isSplitModalOpen: false,
  showRefinement: false,
  isCameraControlOpen: false,
  isRefPanelOpen: false,
  isCreativeOpen: false,
  isCompareOpen: false,
  editingSplit: null,
  creativeDirection: '',
  isRefTooltipOpen: false,
};

export type SceneCardAction =
  | { type: 'OPEN_EDIT' }
  | { type: 'CLOSE_EDIT' }
  | { type: 'OPEN_SPLIT' }
  | { type: 'CLOSE_SPLIT' }
  | { type: 'TOGGLE_REFINEMENT' }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'OPEN_REF_PANEL' }
  | { type: 'CLOSE_REF_PANEL' }
  | { type: 'OPEN_CREATIVE' }
  | { type: 'CLOSE_CREATIVE' }
  | { type: 'OPEN_COMPARE' }
  | { type: 'CLOSE_COMPARE' }
  | { type: 'START_EDITING_SPLIT'; payload: { id: string; imageUrl: string } }
  | { type: 'STOP_EDITING_SPLIT' }
  | { type: 'SET_CREATIVE_DIRECTION'; payload: string }
  | { type: 'APPEND_CREATIVE_SUGGESTION'; payload: string }
  | { type: 'TOGGLE_REF_TOOLTIP' }
  | { type: 'CLOSE_REF_TOOLTIP' };

export function sceneCardReducer(
  state: SceneCardLocalState,
  action: SceneCardAction,
): SceneCardLocalState {
  switch (action.type) {
    case 'OPEN_EDIT': return { ...state, isEditModalOpen: true };
    case 'CLOSE_EDIT': return { ...state, isEditModalOpen: false };
    case 'OPEN_SPLIT': return { ...state, isSplitModalOpen: true };
    case 'CLOSE_SPLIT': return { ...state, isSplitModalOpen: false };
    case 'TOGGLE_REFINEMENT': return { ...state, showRefinement: !state.showRefinement };
    case 'TOGGLE_CAMERA': return { ...state, isCameraControlOpen: !state.isCameraControlOpen };
    case 'OPEN_REF_PANEL': return { ...state, isRefPanelOpen: true };
    case 'CLOSE_REF_PANEL': return { ...state, isRefPanelOpen: false };
    case 'OPEN_CREATIVE': return { ...state, isCreativeOpen: true };
    case 'CLOSE_CREATIVE': return { ...state, isCreativeOpen: false, creativeDirection: '' };
    case 'OPEN_COMPARE': return { ...state, isCompareOpen: true };
    case 'CLOSE_COMPARE': return { ...state, isCompareOpen: false };
    case 'START_EDITING_SPLIT': return { ...state, editingSplit: action.payload };
    case 'STOP_EDITING_SPLIT': return { ...state, editingSplit: null };
    case 'SET_CREATIVE_DIRECTION': return { ...state, creativeDirection: action.payload };
    case 'APPEND_CREATIVE_SUGGESTION': {
      const current = state.creativeDirection.trim();
      const next = current ? `${current}; ${action.payload.toLowerCase()}` : action.payload;
      return { ...state, creativeDirection: next };
    }
    case 'TOGGLE_REF_TOOLTIP': return { ...state, isRefTooltipOpen: !state.isRefTooltipOpen };
    case 'CLOSE_REF_TOOLTIP': return { ...state, isRefTooltipOpen: false };
    default: return state;
  }
}
