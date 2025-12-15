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
// COLOR TYPES
// ============================================

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ============================================
// LAYER SYSTEM TYPES
// ============================================

export type LayerType = 'raster' | 'text' | 'shape' | 'group' | 'edge-map';
export type BlendMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'darken' 
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface LayerTransform {
  rotation: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

export interface LayerEffect {
  id: string;
  type: 'drop-shadow' | 'inner-shadow' | 'outer-glow' | 'inner-glow' | 'blur';
  enabled: boolean;
  parameters: Record<string, unknown>;
}

export interface DropShadowEffect extends LayerEffect {
  type: 'drop-shadow';
  parameters: {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: Color;
  };
}

export interface GlowEffect extends LayerEffect {
  type: 'outer-glow' | 'inner-glow';
  parameters: {
    blur: number;
    spread: number;
    color: Color;
  };
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
  effects: LayerEffect[];
  createdAt: number;
  modifiedAt: number;
}

// ============================================
// MODIFIER SYSTEM TYPES
// ============================================

export type ModifierType = 
  | 'transparency-mask'
  | 'segment-cutout'
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

export interface SegmentCutoutModifier extends Modifier {
  type: 'segment-cutout';
  parameters: {
    mask: Uint8ClampedArray;
    width: number;
    height: number;
    maskOpacity: number; // 0 = fully transparent (cutout), 100 = full original
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
// DIAGNOSTICS TYPES
// ============================================

export interface DiagnosticMetrics {
  lastPreviewTime: number;
  lastSegmentTime: number;
  pixelsProcessed: number;
  queueSize: number;
  iterationCount: number;
  memoryUsed: number;
}

export interface PerformanceLog {
  timestamp: number;
  operation: string;
  duration: number;
  pixels: number;
  details?: Record<string, unknown>;
}

// ============================================
// AI PIN SEGMENTATION TYPES
// ============================================

export interface SegmentPin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: Color;
  status: 'pending' | 'processing' | 'completed' | 'error';
  maskId?: string;
}

export interface AISegmentationState {
  pins: SegmentPin[];
  isProcessing: boolean;
  currentStep: 'idle' | 'placing-pins' | 'ai-detection' | 'ai-coloring' | 'mask-extraction' | 'complete';
  dyedImageData: ImageData | null;
  detectedObjects: { label: string; bounds: Rectangle }[];
}

// ============================================
// TOOL TYPES
// ============================================

export type ToolType = 
  | 'select'
  | 'move'
  | 'magic-wand'
  | 'lasso'
  | 'magnetic-lasso'
  | 'brush'
  | 'eraser'
  | 'text'
  | 'shape'
  | 'hand'
  | 'zoom'
  | 'ai-pin';

// ============================================
// LASSO TYPES
// ============================================

export type LassoVariation = 
  | 'classic-dijkstra'      // Pure edge-following with Dijkstra
  | 'photoshop-style'       // Auto-anchoring based on distance/time
  | 'elastic-progressive'   // Progressive anchor strength
  | 'predictive-directional'; // Movement pattern analysis

export type LassoAnchorMode = 
  | 'manual'
  | 'distance'
  | 'time'
  | 'hybrid'
  | 'elastic'
  | 'edge-quality'
  | 'predictive';

export type EdgeMethod = 
  | 'sobel'
  | 'prewitt'
  | 'scharr'
  | 'roberts'
  | 'laplacian'
  | 'canny';

export interface LassoAnchor {
  id: string;
  point: Point;
  strength: number;        // 0.0 (elastic) to 1.0 (locked)
  timestamp: number;
  isEdgeSnapped: boolean;
  edgeQuality: number;
}

export interface LassoPath {
  points: Point[];
  anchors: LassoAnchor[];
  isClosed: boolean;
  totalLength: number;
}

export interface LazyCursor {
  outerPosition: Point;    // Exact mouse position
  innerPosition: Point;    // Stabilized position
  radius: number;
  smoothingFactor: number;
}

export interface LassoOptions {
  // Variation
  variation: LassoVariation;
  
  // Cursor Settings
  cursorRadius: number;          // 5-50px
  edgeSearchRadius: number;      // 5-50px
  smoothingFactor: number;       // 0.1-1.0
  trajectoryLookback: number;    // 2-15 points
  
  // Edge Detection
  edgeMethod: EdgeMethod;
  edgeSensitivity: number;       // 0-100
  edgeThreshold: number;
  hysteresisThreshold: number;
  nonMaxSuppression: boolean;
  gaussianBlur: boolean;
  gaussianRadius: number;
  adaptiveEdge: boolean;
  
  // Anchoring
  anchorMode: LassoAnchorMode;
  autoAnchorDistance: number;
  autoAnchorTimeInterval: number;
  anchorPositionOnPath: number;  // 0-100%
  elasticZoneLength: number;
  elasticStrengthCurve: 'linear' | 'exponential' | 'ease-in-out';
  
  // Pathfinding
  pathfindingAlgorithm: 'dijkstra' | 'astar';
  neighborMode: 4 | 8;
  directionContinuityCost: number;
  cursorInfluence: number;       // 0-100
  
  // Prediction (for predictive-directional)
  predictionConeAngle: number;
  predictionConfidenceWeight: number;
  curveConsistencyWindow: number;
  
  // Visualization
  pathColor: string;
  nodeColor: string;
  nodeSize: number;
  showEdgeTrailNode: boolean;
  showElasticGradient: boolean;
  showPredictionZone: boolean;
  showMetricsOverlay: boolean;
}

export interface LassoState {
  isActive: boolean;
  currentPath: LassoPath | null;
  lazyCursor: LazyCursor;
  previewPath: Point[];
  pendingSegments: LassoPath[];
  edgeMap: ImageData | null;
  gradientMap: { magnitude: Float32Array; direction: Float32Array } | null;
  metrics: LassoMetrics;
}

export interface LassoMetrics {
  fps: number;
  pathComputationTime: number;
  totalPathPoints: number;
  anchorCount: number;
  edgeQuality: number;
  cursorSpeed: number;
}

export interface ToolState {
  activeTool: ToolType;
  isActive: boolean;
  options: ToolOptions;
}

export interface ToolOptions {
  // Common
  size: number;
  hardness: number;
  opacity: number;
  
  // Magic Wand
  tolerance: number;
  contiguous: boolean;
  antiAlias: boolean;
  
  // Advanced Wand
  maxPreviewPixels: number;
  maxSegmentPixels: number;
  connectivity: 4 | 8;
  sampleSize: 'point' | '3x3' | '5x5';
  featherRadius: number;
  expandContract: number;
  useAlphaChannel: boolean;
  colorSpace: 'rgb' | 'hsv' | 'lab';
  
  // Wand Visualization
  selectionBorderColor: Color;
  selectionBorderWidth: number;
  selectionBorderPattern: 'solid' | 'dashed' | 'marching-ants';
  selectionFillColor: Color;
  selectionFillOpacity: number;
  selectionFillPattern: 'none' | 'solid' | 'hatched' | 'dots';
  
  // Brush/Eraser
  brushColor: Color;
  brushFlow: number;
  brushSpacing: number;
  
  // Fill Effect
  fillEffect: 'solid' | 'gradient' | 'pattern';
}

// ============================================
// IMAGE PROCESSING TYPES
// ============================================

export type EdgeDetectionAlgorithm = 'sobel' | 'laplacian' | 'canny' | 'prewitt' | 'roberts';
export type ImageFilterType = 
  | 'grayscale'
  | 'invert'
  | 'threshold'
  | 'gaussian-blur'
  | 'sharpen'
  | 'emboss'
  | 'edge-enhance'
  | 'posterize'
  | 'sepia';

export interface EdgeDetectionOptions {
  algorithm: EdgeDetectionAlgorithm;
  threshold: number;
  lowThreshold?: number;
  highThreshold?: number;
  kernelSize: 3 | 5;
  direction?: 'horizontal' | 'vertical' | 'both';
}

export interface ImageFilterOptions {
  type: ImageFilterType;
  intensity: number;
  threshold?: number;
  levels?: number;
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
  MAX_PREVIEW_PIXELS: 100000,
  MAX_SEGMENT_PIXELS: 0, // 0 = unlimited
  PREVIEW_THROTTLE_MS: 16,
} as const;

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export const DEFAULT_LAYER_TRANSFORM: LayerTransform = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
};

export const DEFAULT_BRUSH_COLOR: Color = {
  r: 255,
  g: 255,
  b: 255,
  a: 1,
};

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  size: 20,
  hardness: 100,
  opacity: 100,
  tolerance: 32,
  contiguous: true,
  antiAlias: true,
  maxPreviewPixels: CANVAS_CONSTANTS.MAX_PREVIEW_PIXELS,
  maxSegmentPixels: 0,
  connectivity: 4,
  sampleSize: 'point',
  featherRadius: 0,
  expandContract: 0,
  useAlphaChannel: false,
  colorSpace: 'rgb',
  selectionBorderColor: { r: 255, g: 255, b: 255, a: 1 },
  selectionBorderWidth: 2,
  selectionBorderPattern: 'marching-ants',
  selectionFillColor: { r: 0, g: 150, b: 255, a: 0.3 },
  selectionFillOpacity: 30,
  selectionFillPattern: 'solid',
  brushColor: DEFAULT_BRUSH_COLOR,
  brushFlow: 100,
  brushSpacing: 25,
  fillEffect: 'solid',
};

export const EDGE_ALGORITHMS: { value: EdgeDetectionAlgorithm; label: string }[] = [
  { value: 'sobel', label: 'Sobel' },
  { value: 'laplacian', label: 'Laplacian' },
  { value: 'canny', label: 'Canny' },
  { value: 'prewitt', label: 'Prewitt' },
  { value: 'roberts', label: 'Roberts' },
];

export const IMAGE_FILTERS: { value: ImageFilterType; label: string }[] = [
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'invert', label: 'Invert' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'gaussian-blur', label: 'Gaussian Blur' },
  { value: 'sharpen', label: 'Sharpen' },
  { value: 'emboss', label: 'Emboss' },
  { value: 'edge-enhance', label: 'Edge Enhance' },
  { value: 'posterize', label: 'Posterize' },
  { value: 'sepia', label: 'Sepia' },
];
