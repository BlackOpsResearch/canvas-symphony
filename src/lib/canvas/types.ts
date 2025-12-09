/**
 * V3 Image Editor - Core Types
 * Single source of truth for all type definitions
 */

// ============================================
// COORDINATE SYSTEM TYPES
// ============================================

export interface Point {
  x: number;
  y: number;
}

export interface ScreenPoint extends Point {
  readonly _brand: 'screen';
}

export interface WorldPoint extends Point {
  readonly _brand: 'world';
}

export interface CanvasPoint extends Point {
  readonly _brand: 'canvas';
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  panX: number;
  panY: number;
  zoom: number;
}

// ============================================
// LAYER SYSTEM TYPES
// ============================================

export type LayerType = 'raster' | 'text' | 'shape' | 'group';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export interface LayerTransform {
  rotation: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  imageData: ImageData | null;
  bounds: Rectangle;
  transform: LayerTransform;
  modifiers: Modifier[];
  createdAt: number;
  modifiedAt: number;
}

// ============================================
// MODIFIER SYSTEM TYPES
// ============================================

export type ModifierType = 
  | 'transparency-mask'
  | 'color-adjustment'
  | 'blur'
  | 'sharpen'
  | 'noise';

export interface Modifier {
  id: string;
  type: ModifierType;
  enabled: boolean;
  opacity: number;
  parameters: Record<string, unknown>;
}

export interface TransparencyMaskModifier extends Modifier {
  type: 'transparency-mask';
  parameters: {
    mask: Uint8ClampedArray;
    bounds: Rectangle;
    inverted: boolean;
  };
}

// ============================================
// SELECTION TYPES
// ============================================

export interface SelectionMask {
  id: string;
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  width: number;
  height: number;
  pixels: Set<number>;
  feathered: boolean;
}

export interface SegmentationResult {
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  pixels: number[];
  hitLimit: boolean;
  metadata: {
    seedColor: [number, number, number, number];
    tolerance: number;
    pixelCount: number;
    processingTime: number;
  };
}

// ============================================
// TOOL TYPES
// ============================================

export type ToolType = 
  | 'select'
  | 'move'
  | 'magic-wand'
  | 'brush'
  | 'eraser'
  | 'text'
  | 'shape'
  | 'hand'
  | 'zoom';

export interface ToolState {
  activeTool: ToolType;
  isActive: boolean;
  options: ToolOptions;
}

export interface ToolOptions {
  size: number;
  hardness: number;
  opacity: number;
  tolerance: number;
  contiguous: boolean;
  antiAlias: boolean;
}

// ============================================
// PROJECT TYPES
// ============================================

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  selectedLayerIds: string[];
  activeLayerId: string | null;
  createdAt: number;
  modifiedAt: number;
}

// ============================================
// CANVAS STATE TYPES
// ============================================

export interface CanvasState {
  transform: Transform;
  isRendering: boolean;
  isDragging: boolean;
  isPanning: boolean;
  cursorPosition: WorldPoint | null;
  hoverPreview: SegmentationResult | null;
}

// ============================================
// HISTORY TYPES
// ============================================

export interface HistorySnapshot {
  id: string;
  description: string;
  project: Project;
  canvasState: Pick<CanvasState, 'transform'>;
  timestamp: number;
}

// ============================================
// WORKER MESSAGE TYPES
// ============================================

export type WorkerMessageType = 
  | 'segment'
  | 'segment-result'
  | 'preview'
  | 'preview-result'
  | 'cancel';

export interface WorkerMessage {
  type: WorkerMessageType;
  id: string;
  payload: unknown;
}

export interface SegmentMessage extends WorkerMessage {
  type: 'segment';
  payload: {
    imageData: {
      data: ArrayBuffer;
      width: number;
      height: number;
    };
    startPoint: Point;
    options: {
      tolerance: number;
      contiguous: boolean;
      maxPixels?: number;
    };
  };
}

export interface SegmentResultMessage extends WorkerMessage {
  type: 'segment-result';
  payload: SegmentationResult;
}

// ============================================
// CONSTANTS
// ============================================

export const CANVAS_CONSTANTS = {
  DEFAULT_WIDTH: 1920,
  DEFAULT_HEIGHT: 1080,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 32,
  ZOOM_STEP: 0.1,
  PAN_SPEED: 1,
  DEFAULT_TOLERANCE: 32,
  MAX_PREVIEW_PIXELS: 50000,
  PREVIEW_THROTTLE_MS: 16, // 60fps
} as const;

export const DEFAULT_LAYER_TRANSFORM: LayerTransform = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
};

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  size: 20,
  hardness: 100,
  opacity: 100,
  tolerance: 32,
  contiguous: true,
  antiAlias: true,
};
