/**
 * V3 History Context
 * Undo/Redo with snapshot-based history
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Project, Layer, Transform } from '@/lib/canvas/types';

// ============================================
// HISTORY TYPES
// ============================================

export interface HistorySnapshot {
  id: string;
  description: string;
  timestamp: number;
  projectSnapshot: {
    layers: Layer[];
    selectedLayerIds: string[];
    activeLayerId: string | null;
  };
  transform: Transform;
}

interface HistoryState {
  snapshots: HistorySnapshot[];
  currentIndex: number;
  maxSnapshots: number;
}

type HistoryAction =
  | { type: 'PUSH_SNAPSHOT'; payload: HistorySnapshot }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' }
  | { type: 'GO_TO_INDEX'; payload: number };

// ============================================
// INITIAL STATE
// ============================================

const MAX_HISTORY = 50;

const initialState: HistoryState = {
  snapshots: [],
  currentIndex: -1,
  maxSnapshots: MAX_HISTORY,
};

// ============================================
// REDUCER
// ============================================

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'PUSH_SNAPSHOT': {
      // Remove any snapshots after current index (redo stack cleared)
      const newSnapshots = state.snapshots.slice(0, state.currentIndex + 1);
      newSnapshots.push(action.payload);
      
      // Limit to max snapshots
      if (newSnapshots.length > state.maxSnapshots) {
        newSnapshots.shift();
        return {
          ...state,
          snapshots: newSnapshots,
          currentIndex: newSnapshots.length - 1,
        };
      }
      
      return {
        ...state,
        snapshots: newSnapshots,
        currentIndex: newSnapshots.length - 1,
      };
    }
    
    case 'UNDO': {
      if (state.currentIndex <= 0) return state;
      return {
        ...state,
        currentIndex: state.currentIndex - 1,
      };
    }
    
    case 'REDO': {
      if (state.currentIndex >= state.snapshots.length - 1) return state;
      return {
        ...state,
        currentIndex: state.currentIndex + 1,
      };
    }
    
    case 'GO_TO_INDEX': {
      if (action.payload < 0 || action.payload >= state.snapshots.length) return state;
      return {
        ...state,
        currentIndex: action.payload,
      };
    }
    
    case 'CLEAR':
      return initialState;
    
    default:
      return state;
  }
}

// ============================================
// DEEP CLONE HELPER
// ============================================

function deepCloneLayers(layers: Layer[]): Layer[] {
  return layers.map(layer => ({
    ...layer,
    imageData: layer.imageData 
      ? new ImageData(
          new Uint8ClampedArray(layer.imageData.data),
          layer.imageData.width,
          layer.imageData.height
        )
      : null,
    modifiers: layer.modifiers.map(m => ({ ...m, parameters: { ...m.parameters } })),
    transform: { ...layer.transform },
    bounds: { ...layer.bounds },
  }));
}

// ============================================
// CONTEXT
// ============================================

interface HistoryContextValue {
  snapshots: HistorySnapshot[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (description: string, layers: Layer[], selectedLayerIds: string[], activeLayerId: string | null, transform: Transform) => void;
  undo: () => HistorySnapshot | null;
  redo: () => HistorySnapshot | null;
  goToIndex: (index: number) => HistorySnapshot | null;
  getCurrentSnapshot: () => HistorySnapshot | null;
  clear: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface HistoryProviderProps {
  children: ReactNode;
}

export function HistoryProvider({ children }: HistoryProviderProps) {
  const [state, dispatch] = useReducer(historyReducer, initialState);

  const pushSnapshot = useCallback((
    description: string,
    layers: Layer[],
    selectedLayerIds: string[],
    activeLayerId: string | null,
    transform: Transform
  ) => {
    const snapshot: HistorySnapshot = {
      id: uuidv4(),
      description,
      timestamp: Date.now(),
      projectSnapshot: {
        layers: deepCloneLayers(layers),
        selectedLayerIds: [...selectedLayerIds],
        activeLayerId,
      },
      transform: { ...transform },
    };
    dispatch({ type: 'PUSH_SNAPSHOT', payload: snapshot });
  }, []);

  const undo = useCallback((): HistorySnapshot | null => {
    if (state.currentIndex <= 0) return null;
    dispatch({ type: 'UNDO' });
    return state.snapshots[state.currentIndex - 1] || null;
  }, [state.currentIndex, state.snapshots]);

  const redo = useCallback((): HistorySnapshot | null => {
    if (state.currentIndex >= state.snapshots.length - 1) return null;
    dispatch({ type: 'REDO' });
    return state.snapshots[state.currentIndex + 1] || null;
  }, [state.currentIndex, state.snapshots]);

  const goToIndex = useCallback((index: number): HistorySnapshot | null => {
    if (index < 0 || index >= state.snapshots.length) return null;
    dispatch({ type: 'GO_TO_INDEX', payload: index });
    return state.snapshots[index];
  }, [state.snapshots]);

  const getCurrentSnapshot = useCallback((): HistorySnapshot | null => {
    return state.snapshots[state.currentIndex] || null;
  }, [state.snapshots, state.currentIndex]);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const value: HistoryContextValue = {
    snapshots: state.snapshots,
    currentIndex: state.currentIndex,
    canUndo: state.currentIndex > 0,
    canRedo: state.currentIndex < state.snapshots.length - 1,
    pushSnapshot,
    undo,
    redo,
    goToIndex,
    getCurrentSnapshot,
    clear,
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
