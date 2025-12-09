/**
 * V3 Brush Engine
 * High-performance brush and eraser tools
 */

import { Point, Color, ToolOptions } from './types';

interface BrushStroke {
  points: Point[];
  color: Color;
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  isEraser: boolean;
}

/**
 * Generate brush tip mask with hardness
 */
function generateBrushTip(size: number, hardness: number): ImageData {
  const diameter = Math.ceil(size);
  const center = diameter / 2;
  const imageData = new ImageData(diameter, diameter);
  
  const hardnessNorm = hardness / 100;
  const innerRadius = center * hardnessNorm;
  
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter; x++) {
      const dist = Math.sqrt((x - center + 0.5) ** 2 + (y - center + 0.5) ** 2);
      let alpha = 0;
      
      if (dist <= innerRadius) {
        alpha = 255;
      } else if (dist <= center) {
        // Smooth falloff from inner to outer radius
        const t = (dist - innerRadius) / (center - innerRadius);
        alpha = Math.round(255 * (1 - t * t)); // Quadratic falloff
      }
      
      const index = (y * diameter + x) * 4;
      imageData.data[index] = 255;
      imageData.data[index + 1] = 255;
      imageData.data[index + 2] = 255;
      imageData.data[index + 3] = alpha;
    }
  }
  
  return imageData;
}

/**
 * Interpolate points for smooth strokes
 */
function interpolatePoints(p1: Point, p2: Point, spacing: number): Point[] {
  const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const steps = Math.ceil(distance / spacing);
  
  if (steps <= 1) return [p2];
  
  const points: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    });
  }
  
  return points;
}

export class BrushEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private brushTipCache: Map<string, ImageData> = new Map();
  private currentStroke: BrushStroke | null = null;
  private lastPoint: Point | null = null;
  
  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }
  
  /**
   * Get or create cached brush tip
   */
  private getBrushTip(size: number, hardness: number): ImageData {
    const key = `${Math.round(size)}_${Math.round(hardness)}`;
    
    if (!this.brushTipCache.has(key)) {
      this.brushTipCache.set(key, generateBrushTip(size, hardness));
      
      // Limit cache size
      if (this.brushTipCache.size > 50) {
        const firstKey = this.brushTipCache.keys().next().value;
        if (firstKey) this.brushTipCache.delete(firstKey);
      }
    }
    
    return this.brushTipCache.get(key)!;
  }
  
  /**
   * Start a new brush stroke
   */
  startStroke(
    point: Point,
    options: ToolOptions,
    isEraser: boolean = false
  ): void {
    this.currentStroke = {
      points: [point],
      color: options.brushColor,
      size: options.size,
      hardness: options.hardness,
      opacity: options.opacity,
      flow: options.brushFlow,
      isEraser,
    };
    this.lastPoint = point;
    
    // Draw first dab
    this.drawDab(point, options, isEraser);
  }
  
  /**
   * Continue stroke to new point
   */
  continueStroke(point: Point, options: ToolOptions, isEraser: boolean = false): void {
    if (!this.currentStroke || !this.lastPoint) return;
    
    // Calculate spacing based on brush size
    const spacing = Math.max(1, options.size * (options.brushSpacing / 100));
    const points = interpolatePoints(this.lastPoint, point, spacing);
    
    for (const p of points) {
      this.drawDab(p, options, isEraser);
      this.currentStroke.points.push(p);
    }
    
    this.lastPoint = point;
  }
  
  /**
   * End current stroke
   */
  endStroke(): BrushStroke | null {
    const stroke = this.currentStroke;
    this.currentStroke = null;
    this.lastPoint = null;
    return stroke;
  }
  
  /**
   * Draw single brush dab
   */
  private drawDab(point: Point, options: ToolOptions, isEraser: boolean): void {
    const brushTip = this.getBrushTip(options.size, options.hardness);
    const radius = brushTip.width / 2;
    
    const x = Math.round(point.x - radius);
    const y = Math.round(point.y - radius);
    
    this.ctx.save();
    this.ctx.globalAlpha = (options.opacity / 100) * (options.brushFlow / 100);
    
    if (isEraser) {
      this.ctx.globalCompositeOperation = 'destination-out';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
    }
    
    // Create colored brush tip
    const coloredTip = new ImageData(brushTip.width, brushTip.height);
    const { r, g, b } = options.brushColor;
    
    for (let i = 0; i < brushTip.data.length; i += 4) {
      coloredTip.data[i] = isEraser ? 0 : r;
      coloredTip.data[i + 1] = isEraser ? 0 : g;
      coloredTip.data[i + 2] = isEraser ? 0 : b;
      coloredTip.data[i + 3] = brushTip.data[i + 3];
    }
    
    // Draw to temp canvas first
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = brushTip.width;
    tempCanvas.height = brushTip.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(coloredTip, 0, 0);
    
    this.ctx.drawImage(tempCanvas, x, y);
    this.ctx.restore();
  }
  
  /**
   * Apply brush strokes to layer ImageData
   */
  applyToLayer(layerImageData: ImageData): ImageData {
    // Get current drawing state
    const brushData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Composite onto layer
    const result = new ImageData(
      new Uint8ClampedArray(layerImageData.data),
      layerImageData.width,
      layerImageData.height
    );
    
    for (let i = 0; i < brushData.data.length; i += 4) {
      const brushAlpha = brushData.data[i + 3] / 255;
      
      if (brushAlpha > 0) {
        const srcR = brushData.data[i];
        const srcG = brushData.data[i + 1];
        const srcB = brushData.data[i + 2];
        
        const dstR = result.data[i];
        const dstG = result.data[i + 1];
        const dstB = result.data[i + 2];
        const dstA = result.data[i + 3] / 255;
        
        // Alpha compositing
        const outA = brushAlpha + dstA * (1 - brushAlpha);
        
        if (outA > 0) {
          result.data[i] = Math.round((srcR * brushAlpha + dstR * dstA * (1 - brushAlpha)) / outA);
          result.data[i + 1] = Math.round((srcG * brushAlpha + dstG * dstA * (1 - brushAlpha)) / outA);
          result.data[i + 2] = Math.round((srcB * brushAlpha + dstB * dstA * (1 - brushAlpha)) / outA);
          result.data[i + 3] = Math.round(outA * 255);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get current brush canvas ImageData
   */
  getBrushImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Clear brush canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    const currentData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.putImageData(currentData, 0, 0);
  }
}
