/**
 * V3 Magnetic Lasso Engine
 * Core engine with multiple lasso variations
 */

import { v4 as uuid } from 'uuid';
import { 
  Point, 
  LassoOptions, 
  LassoState, 
  LassoPath, 
  LassoAnchor, 
  LazyCursor,
  LassoMetrics,
  LassoVariation,
} from './types';
import { 
  dijkstra, 
  astar, 
  CostMap, 
  createCostMapFromEdges,
  PathfindingOptions,
  simplifyPath,
  smoothPath,
  getPathLength,
} from './Pathfinding';
import { applyEdgeDetection } from './ImageProcessing';

// ============================================
// DEFAULT OPTIONS
// ============================================

export const DEFAULT_LASSO_OPTIONS: LassoOptions = {
  variation: 'classic-dijkstra',
  cursorRadius: 15,
  edgeSearchRadius: 20,
  smoothingFactor: 0.5,
  trajectoryLookback: 5,
  edgeMethod: 'canny',
  edgeSensitivity: 50,
  edgeThreshold: 30,
  hysteresisThreshold: 60,
  nonMaxSuppression: true,
  gaussianBlur: true,
  gaussianRadius: 1.5,
  adaptiveEdge: false,
  anchorMode: 'manual',
  autoAnchorDistance: 50,
  autoAnchorTimeInterval: 500,
  anchorPositionOnPath: 100,
  elasticZoneLength: 100,
  elasticStrengthCurve: 'linear',
  pathfindingAlgorithm: 'dijkstra',
  neighborMode: 8,
  directionContinuityCost: 0.5,
  cursorInfluence: 20,
  predictionConeAngle: 45,
  predictionConfidenceWeight: 0.7,
  curveConsistencyWindow: 10,
  pathColor: '#00ffff',
  nodeColor: '#ffffff',
  nodeSize: 6,
  showEdgeTrailNode: true,
  showElasticGradient: true,
  showPredictionZone: true,
  showMetricsOverlay: true,
};

// ============================================
// LASSO ENGINE CLASS
// ============================================

export class LassoEngine {
  private options: LassoOptions;
  private state: LassoState;
  private costMap: CostMap | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private trajectoryHistory: Point[] = [];
  private lastAnchorTime: number = 0;
  private lastAnchorDistance: number = 0;

  constructor(options: Partial<LassoOptions> = {}) {
    this.options = { ...DEFAULT_LASSO_OPTIONS, ...options };
    this.state = this.createInitialState();
  }

  private createInitialState(): LassoState {
    return {
      isActive: false,
      currentPath: null,
      lazyCursor: {
        outerPosition: { x: 0, y: 0 },
        innerPosition: { x: 0, y: 0 },
        radius: this.options.cursorRadius,
        smoothingFactor: this.options.smoothingFactor,
      },
      previewPath: [],
      pendingSegments: [],
      edgeMap: null,
      gradientMap: null,
      metrics: {
        fps: 0,
        pathComputationTime: 0,
        totalPathPoints: 0,
        anchorCount: 0,
        edgeQuality: 0,
        cursorSpeed: 0,
      },
    };
  }

  // ============================================
  // EDGE MAP COMPUTATION
  // ============================================

  computeEdgeMap(imageData: ImageData): void {
    const edgeOptions = {
      algorithm: this.options.edgeMethod === 'scharr' ? 'sobel' : this.options.edgeMethod as any,
      threshold: this.options.edgeThreshold,
      lowThreshold: this.options.edgeThreshold * 0.4,
      highThreshold: this.options.hysteresisThreshold,
      kernelSize: 3 as const,
      direction: 'both' as const,
    };

    this.state.edgeMap = applyEdgeDetection(imageData, edgeOptions);
    this.costMap = createCostMapFromEdges(this.state.edgeMap);
  }

  // ============================================
  // LAZY CURSOR SYSTEM
  // ============================================

  updateLazyCursor(mousePosition: Point): Point {
    const cursor = this.state.lazyCursor;
    cursor.outerPosition = mousePosition;

    const dx = mousePosition.x - cursor.innerPosition.x;
    const dy = mousePosition.y - cursor.innerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only move inner cursor when mouse is outside the dead zone
    if (distance > cursor.radius) {
      const moveDistance = distance - cursor.radius;
      const angle = Math.atan2(dy, dx);
      
      cursor.innerPosition = {
        x: cursor.innerPosition.x + Math.cos(angle) * moveDistance * cursor.smoothingFactor,
        y: cursor.innerPosition.y + Math.sin(angle) * moveDistance * cursor.smoothingFactor,
      };
    }

    // Update trajectory history
    this.trajectoryHistory.push({ ...cursor.innerPosition });
    if (this.trajectoryHistory.length > this.options.trajectoryLookback) {
      this.trajectoryHistory.shift();
    }

    // Calculate cursor speed
    if (this.trajectoryHistory.length >= 2) {
      const recent = this.trajectoryHistory[this.trajectoryHistory.length - 1];
      const prev = this.trajectoryHistory[this.trajectoryHistory.length - 2];
      this.state.metrics.cursorSpeed = Math.sqrt(
        (recent.x - prev.x) ** 2 + (recent.y - prev.y) ** 2
      );
    }

    return cursor.innerPosition;
  }

  // ============================================
  // LASSO OPERATIONS
  // ============================================

  startLasso(startPoint: Point): void {
    this.state.isActive = true;
    this.state.currentPath = {
      points: [startPoint],
      anchors: [this.createAnchor(startPoint, 1.0)],
      isClosed: false,
      totalLength: 0,
    };
    this.state.lazyCursor.innerPosition = startPoint;
    this.state.lazyCursor.outerPosition = startPoint;
    this.trajectoryHistory = [startPoint];
    this.lastAnchorTime = performance.now();
    this.lastAnchorDistance = 0;
  }

  private createAnchor(point: Point, strength: number = 0.0): LassoAnchor {
    const edgeQuality = this.getEdgeQualityAt(point);
    return {
      id: uuid(),
      point,
      strength,
      timestamp: performance.now(),
      isEdgeSnapped: edgeQuality > 0.5,
      edgeQuality,
    };
  }

  private getEdgeQualityAt(point: Point): number {
    if (!this.costMap) return 0;
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || x >= this.costMap.width || y < 0 || y >= this.costMap.height) return 0;
    
    // Sample a small area around the point
    let totalQuality = 0;
    let samples = 0;
    const radius = 3;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < this.costMap.width && py >= 0 && py < this.costMap.height) {
          // Low cost = high quality edge
          totalQuality += 1 - this.costMap.costs[py * this.costMap.width + px];
          samples++;
        }
      }
    }
    
    return samples > 0 ? totalQuality / samples : 0;
  }

  updateLasso(currentPoint: Point): void {
    if (!this.state.isActive || !this.state.currentPath) return;

    const stabilizedPoint = this.updateLazyCursor(currentPoint);
    const startTime = performance.now();

    // Get path from last anchor to current position
    const lastAnchor = this.state.currentPath.anchors[this.state.currentPath.anchors.length - 1];
    const previewPath = this.computePath(lastAnchor.point, stabilizedPoint);
    
    this.state.previewPath = previewPath;
    this.state.metrics.pathComputationTime = performance.now() - startTime;

    // Check for auto-anchoring based on variation
    this.checkAutoAnchor(stabilizedPoint, previewPath);

    // Update edge quality metric
    this.state.metrics.edgeQuality = this.getEdgeQualityAt(stabilizedPoint);

    // Update FPS
    this.updateFPS();
  }

  private computePath(start: Point, end: Point): Point[] {
    if (!this.costMap) {
      // No edge map - return straight line
      return [start, end];
    }

    const pathOptions: PathfindingOptions = {
      neighborMode: this.options.neighborMode,
      directionContinuityCost: this.options.directionContinuityCost,
      cursorInfluence: this.getCursorInfluenceForVariation(),
      maxIterations: 50000,
    };

    const result = this.options.pathfindingAlgorithm === 'astar'
      ? astar(start, end, this.costMap, pathOptions)
      : dijkstra(start, end, this.costMap, pathOptions);

    if (!result.success || result.path.length === 0) {
      return [start, end];
    }

    // Simplify and smooth based on variation
    let path = simplifyPath(result.path, 1.0);
    if (this.options.variation === 'elastic-progressive') {
      path = smoothPath(path, 1);
    }

    return path;
  }

  private getCursorInfluenceForVariation(): number {
    switch (this.options.variation) {
      case 'classic-dijkstra':
        return this.options.cursorInfluence * 0.5; // Low influence
      case 'photoshop-style':
        return this.options.cursorInfluence * 1.5; // Higher influence
      case 'elastic-progressive':
        return this.options.cursorInfluence;
      case 'predictive-directional':
        return this.options.cursorInfluence * 0.8;
      default:
        return this.options.cursorInfluence;
    }
  }

  private checkAutoAnchor(point: Point, previewPath: Point[]): void {
    if (!this.state.currentPath) return;

    const now = performance.now();
    const pathLength = getPathLength(previewPath);
    const timeSinceLastAnchor = now - this.lastAnchorTime;
    const lastAnchor = this.state.currentPath.anchors[this.state.currentPath.anchors.length - 1];
    const distanceFromLastAnchor = Math.sqrt(
      (point.x - lastAnchor.point.x) ** 2 + (point.y - lastAnchor.point.y) ** 2
    );

    let shouldAddAnchor = false;

    switch (this.options.anchorMode) {
      case 'manual':
        // Only add anchors on click
        break;
      case 'distance':
        shouldAddAnchor = distanceFromLastAnchor >= this.options.autoAnchorDistance;
        break;
      case 'time':
        shouldAddAnchor = timeSinceLastAnchor >= this.options.autoAnchorTimeInterval;
        break;
      case 'hybrid':
        shouldAddAnchor = 
          distanceFromLastAnchor >= this.options.autoAnchorDistance ||
          timeSinceLastAnchor >= this.options.autoAnchorTimeInterval;
        break;
      case 'edge-quality':
        const quality = this.getEdgeQualityAt(point);
        shouldAddAnchor = quality > 0.7 && distanceFromLastAnchor >= this.options.autoAnchorDistance * 0.5;
        break;
      case 'elastic':
        // Elastic mode strengthens existing anchors, doesn't auto-add
        this.updateElasticStrengths();
        break;
      case 'predictive':
        shouldAddAnchor = this.checkPredictiveAnchor(point);
        break;
    }

    if (shouldAddAnchor && this.state.metrics.cursorSpeed > 1) {
      this.addAnchor(point);
    }
  }

  private updateElasticStrengths(): void {
    if (!this.state.currentPath) return;

    const now = performance.now();
    const elasticZone = this.options.elasticZoneLength;

    for (const anchor of this.state.currentPath.anchors) {
      if (anchor.strength >= 1.0) continue;

      const age = now - anchor.timestamp;
      let newStrength: number;

      switch (this.options.elasticStrengthCurve) {
        case 'linear':
          newStrength = Math.min(1.0, age / 2000);
          break;
        case 'exponential':
          newStrength = Math.min(1.0, 1 - Math.exp(-age / 1000));
          break;
        case 'ease-in-out':
          const t = Math.min(1, age / 2000);
          newStrength = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          break;
        default:
          newStrength = anchor.strength;
      }

      anchor.strength = newStrength;
    }
  }

  private checkPredictiveAnchor(point: Point): boolean {
    if (this.trajectoryHistory.length < 3) return false;

    // Analyze movement direction consistency
    const recent = this.trajectoryHistory.slice(-5);
    let totalAngleDiff = 0;

    for (let i = 2; i < recent.length; i++) {
      const angle1 = Math.atan2(recent[i - 1].y - recent[i - 2].y, recent[i - 1].x - recent[i - 2].x);
      const angle2 = Math.atan2(recent[i].y - recent[i - 1].y, recent[i].x - recent[i - 1].x);
      totalAngleDiff += Math.abs(angle2 - angle1);
    }

    const avgAngleDiff = totalAngleDiff / (recent.length - 2);
    
    // Add anchor when direction becomes unstable
    return avgAngleDiff > Math.PI / 4;
  }

  addAnchor(point?: Point): void {
    if (!this.state.currentPath) return;

    const anchorPoint = point || this.state.lazyCursor.innerPosition;
    
    // Add preview path points to main path
    if (this.state.previewPath.length > 0) {
      this.state.currentPath.points.push(...this.state.previewPath.slice(1));
    }

    // Create new anchor
    const strength = this.options.anchorMode === 'elastic' ? 0.0 : 1.0;
    const anchor = this.createAnchor(anchorPoint, strength);
    this.state.currentPath.anchors.push(anchor);

    // Update tracking
    this.lastAnchorTime = performance.now();
    this.lastAnchorDistance = 0;

    // Update metrics
    this.state.metrics.anchorCount = this.state.currentPath.anchors.length;
    this.state.metrics.totalPathPoints = this.state.currentPath.points.length;
  }

  completeLasso(autoClose: boolean = true): LassoPath | null {
    if (!this.state.isActive || !this.state.currentPath) return null;

    // Add final preview path
    if (this.state.previewPath.length > 0) {
      this.state.currentPath.points.push(...this.state.previewPath.slice(1));
    }

    // Auto-close path
    if (autoClose && this.state.currentPath.points.length > 2) {
      const first = this.state.currentPath.points[0];
      const last = this.state.currentPath.points[this.state.currentPath.points.length - 1];
      const closingPath = this.computePath(last, first);
      
      if (closingPath.length > 0) {
        this.state.currentPath.points.push(...closingPath.slice(1));
      }
      
      this.state.currentPath.isClosed = true;
    }

    this.state.currentPath.totalLength = getPathLength(this.state.currentPath.points);

    const result = this.state.currentPath;
    this.state.isActive = false;
    this.state.currentPath = null;
    this.state.previewPath = [];

    return result;
  }

  cancelLasso(): void {
    this.state.isActive = false;
    this.state.currentPath = null;
    this.state.previewPath = [];
    this.trajectoryHistory = [];
  }

  // ============================================
  // FPS TRACKING
  // ============================================

  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.fpsUpdateTime >= 1000) {
      this.state.metrics.fps = Math.round(this.frameCount * 1000 / (now - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  // ============================================
  // GETTERS & SETTERS
  // ============================================

  getState(): LassoState {
    return this.state;
  }

  getOptions(): LassoOptions {
    return this.options;
  }

  setOptions(options: Partial<LassoOptions>): void {
    this.options = { ...this.options, ...options };
    this.state.lazyCursor.radius = this.options.cursorRadius;
    this.state.lazyCursor.smoothingFactor = this.options.smoothingFactor;
  }

  setVariation(variation: LassoVariation): void {
    this.options.variation = variation;
    
    // Apply variation-specific defaults
    switch (variation) {
      case 'classic-dijkstra':
        this.options.anchorMode = 'manual';
        this.options.cursorInfluence = 10;
        break;
      case 'photoshop-style':
        this.options.anchorMode = 'hybrid';
        this.options.cursorInfluence = 40;
        break;
      case 'elastic-progressive':
        this.options.anchorMode = 'elastic';
        this.options.cursorInfluence = 25;
        break;
      case 'predictive-directional':
        this.options.anchorMode = 'predictive';
        this.options.cursorInfluence = 30;
        break;
    }
  }

  getEdgeMap(): ImageData | null {
    return this.state.edgeMap;
  }
}

// ============================================
// PATH TO MASK CONVERSION
// ============================================

export function lassoPathToMask(
  path: LassoPath,
  width: number,
  height: number
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  
  if (!path.isClosed || path.points.length < 3) {
    return mask;
  }

  // Scanline fill algorithm
  const points = path.points;
  
  for (let y = 0; y < height; y++) {
    const intersections: number[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const x = p1.x + (y - p1.y) / (p2.y - p1.y) * (p2.x - p1.x);
        intersections.push(x);
      }
    }
    
    intersections.sort((a, b) => a - b);
    
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 < intersections.length) {
        const xStart = Math.max(0, Math.ceil(intersections[i]));
        const xEnd = Math.min(width - 1, Math.floor(intersections[i + 1]));
        
        for (let x = xStart; x <= xEnd; x++) {
          mask[y * width + x] = 255;
        }
      }
    }
  }

  return mask;
}
