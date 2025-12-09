/**
 * V3 Project Context
 * Global state for project, layers, and canvas
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Project, 
  Layer, 
  Transform, 
  SegmentationResult,
  ToolType,
  ToolOptions,
  DEFAULT_TOOL_OPTIONS,
  CANVAS_CONSTANTS,
} from '@/lib/canvas/types';

// ============================================
// STATE TYPES
// ============================================

interface ProjectState {
  project: Project;
  transform: Transform;
  activeTool: ToolType;
  toolOptions: ToolOptions;
  hoverPreview: SegmentationResult | null;
  activeSelection: SegmentationResult | null;
  cursorPosition: { x: number; y: number } | null;
  isLoading: boolean;
  isPainting: boolean;
}

// ============================================
// ACTION TYPES
// ============================================

type ProjectAction =
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'SET_LAYERS'; payload: Layer[] }
  | { type: 'ADD_LAYER'; payload: Layer }
  | { type: 'REMOVE_LAYER'; payload: string }
  | { type: 'UPDATE_LAYER'; payload: { id: string; updates: Partial<Layer> } }
  | { type: 'REORDER_LAYERS'; payload: string[] }
  | { type: 'SELECT_LAYER'; payload: string | null }
  | { type: 'SET_TRANSFORM'; payload: Partial<Transform> }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType }
  | { type: 'SET_TOOL_OPTIONS'; payload: Partial<ToolOptions> }
  | { type: 'SET_HOVER_PREVIEW'; payload: SegmentationResult | null }
  | { type: 'SET_ACTIVE_SELECTION'; payload: SegmentationResult | null }
  | { type: 'SET_CURSOR_POSITION'; payload: { x: number; y: number } | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PAINTING'; payload: boolean };

// ============================================
// INITIAL STATE
// ============================================

const createInitialProject = (): Project => ({
  id: uuidv4(),
  name: 'Untitled Project',
  width: CANVAS_CONSTANTS.DEFAULT_WIDTH,
  height: CANVAS_CONSTANTS.DEFAULT_HEIGHT,
  layers: [],
  selectedLayerIds: [],
  activeLayerId: null,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
});

const initialState: ProjectState = {
  project: createInitialProject(),
  transform: { panX: 0, panY: 0, zoom: 1 },
  activeTool: 'magic-wand',
  toolOptions: { ...DEFAULT_TOOL_OPTIONS },
  hoverPreview: null,
  activeSelection: null,
  cursorPosition: null,
  isLoading: false,
  isPainting: false,
};

// ============================================
// REDUCER
// ============================================

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload };

    case 'SET_LAYERS':
      return {
        ...state,
        project: {
          ...state.project,
          layers: action.payload,
          modifiedAt: Date.now(),
        },
      };

    case 'ADD_LAYER': {
      const newLayers = [...state.project.layers, action.payload];
      return {
        ...state,
        project: {
          ...state.project,
          layers: newLayers,
          selectedLayerIds: [action.payload.id],
          activeLayerId: action.payload.id,
          modifiedAt: Date.now(),
        },
      };
    }

    case 'REMOVE_LAYER': {
      const newLayers = state.project.layers.filter(l => l.id !== action.payload);
      const newSelectedIds = state.project.selectedLayerIds.filter(id => id !== action.payload);
      return {
        ...state,
        project: {
          ...state.project,
          layers: newLayers,
          selectedLayerIds: newSelectedIds,
          activeLayerId: newSelectedIds[0] || null,
          modifiedAt: Date.now(),
        },
      };
    }

    case 'UPDATE_LAYER': {
      const newLayers = state.project.layers.map(layer =>
        layer.id === action.payload.id
          ? { ...layer, ...action.payload.updates, modifiedAt: Date.now() }
          : layer
      );
      return {
        ...state,
        project: {
          ...state.project,
          layers: newLayers,
          modifiedAt: Date.now(),
        },
      };
    }

    case 'REORDER_LAYERS': {
      const layerMap = new Map(state.project.layers.map(l => [l.id, l]));
      const newLayers = action.payload
        .map(id => layerMap.get(id))
        .filter((l): l is Layer => l !== undefined);
      return {
        ...state,
        project: {
          ...state.project,
          layers: newLayers,
          modifiedAt: Date.now(),
        },
      };
    }

    case 'SELECT_LAYER':
      return {
        ...state,
        project: {
          ...state.project,
          selectedLayerIds: action.payload ? [action.payload] : [],
          activeLayerId: action.payload,
        },
      };

    case 'SET_TRANSFORM':
      return {
        ...state,
        transform: { ...state.transform, ...action.payload },
      };

    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload };

    case 'SET_TOOL_OPTIONS':
      return {
        ...state,
        toolOptions: { ...state.toolOptions, ...action.payload },
      };

    case 'SET_HOVER_PREVIEW':
      return { ...state, hoverPreview: action.payload };

    case 'SET_ACTIVE_SELECTION':
      return { ...state, activeSelection: action.payload };

    case 'SET_CURSOR_POSITION':
      return { ...state, cursorPosition: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_PAINTING':
      return { ...state, isPainting: action.payload };

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface ProjectContextValue extends ProjectState {
  dispatch: React.Dispatch<ProjectAction>;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  selectLayer: (id: string | null) => void;
  setLayers: (layers: Layer[]) => void;
  setTransform: (transform: Partial<Transform>) => void;
  setActiveTool: (tool: ToolType) => void;
  setToolOptions: (options: Partial<ToolOptions>) => void;
  setHoverPreview: (preview: SegmentationResult | null) => void;
  setActiveSelection: (selection: SegmentationResult | null) => void;
  setCursorPosition: (position: { x: number; y: number } | null) => void;
  setIsPainting: (isPainting: boolean) => void;
  getActiveLayer: () => Layer | null;
  getCompositeImageData: () => ImageData | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const addLayer = useCallback((layer: Layer) => {
    dispatch({ type: 'ADD_LAYER', payload: layer });
  }, []);

  const removeLayer = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_LAYER', payload: id });
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    dispatch({ type: 'UPDATE_LAYER', payload: { id, updates } });
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_LAYER', payload: id });
  }, []);

  const setLayers = useCallback((layers: Layer[]) => {
    dispatch({ type: 'SET_LAYERS', payload: layers });
  }, []);

  const setTransform = useCallback((transform: Partial<Transform>) => {
    dispatch({ type: 'SET_TRANSFORM', payload: transform });
  }, []);

  const setActiveTool = useCallback((tool: ToolType) => {
    dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
  }, []);

  const setToolOptions = useCallback((options: Partial<ToolOptions>) => {
    dispatch({ type: 'SET_TOOL_OPTIONS', payload: options });
  }, []);

  const setHoverPreview = useCallback((preview: SegmentationResult | null) => {
    dispatch({ type: 'SET_HOVER_PREVIEW', payload: preview });
  }, []);

  const setActiveSelection = useCallback((selection: SegmentationResult | null) => {
    dispatch({ type: 'SET_ACTIVE_SELECTION', payload: selection });
  }, []);

  const setCursorPosition = useCallback((position: { x: number; y: number } | null) => {
    dispatch({ type: 'SET_CURSOR_POSITION', payload: position });
  }, []);

  const setIsPainting = useCallback((isPainting: boolean) => {
    dispatch({ type: 'SET_PAINTING', payload: isPainting });
  }, []);

  const getActiveLayer = useCallback((): Layer | null => {
    const { activeLayerId, layers } = state.project;
    if (!activeLayerId) return null;
    return layers.find(l => l.id === activeLayerId) || null;
  }, [state.project]);

  const getCompositeImageData = useCallback((): ImageData | null => {
    const { layers, width, height } = state.project;
    if (layers.length === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    for (const layer of layers.filter(l => l.visible)) {
      if (!layer.imageData) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);

      const x = (width - layer.imageData.width) / 2;
      const y = (height - layer.imageData.height) / 2;
      ctx.drawImage(tempCanvas, x, y);

      ctx.restore();
    }

    return ctx.getImageData(0, 0, width, height);
  }, [state.project]);

  const value: ProjectContextValue = {
    ...state,
    dispatch,
    addLayer,
    removeLayer,
    updateLayer,
    selectLayer,
    setLayers,
    setTransform,
    setActiveTool,
    setToolOptions,
    setHoverPreview,
    setActiveSelection,
    setCursorPosition,
    setIsPainting,
    getActiveLayer,
    getCompositeImageData,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
