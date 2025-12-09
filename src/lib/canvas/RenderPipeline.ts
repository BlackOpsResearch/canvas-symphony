/**
 * V3 Render Pipeline
 * 60fps rendering with efficient layer compositing
 */

import { Layer, Rectangle, Transform, SegmentationResult } from './types';
import { CoordinateSystem } from './CoordinateSystem';

interface RenderOptions {
  showGrid: boolean;
  showBounds: boolean;
  showSelection: boolean;
}

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  showGrid: true,
  showBounds: false,
  showSelection: true,
};

export class RenderPipeline {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private coordSystem: CoordinateSystem;
  private animationFrameId: number | null = null;
  private isDirty: boolean = true;
  private options: RenderOptions = DEFAULT_RENDER_OPTIONS;

  // Cached patterns
  private checkerboardPattern: CanvasPattern | null = null;

  constructor(coordSystem: CoordinateSystem) {
    this.coordSystem = coordSystem;
  }

  /**
   * Initialize with canvas element
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { 
      alpha: true,
      desynchronized: true, // Better performance
    });
    this.createCheckerboardPattern();
    this.markDirty();
  }

  /**
   * Mark canvas as needing re-render
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Set render options
   */
  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.markDirty();
  }

  /**
   * Create checkerboard pattern for transparency
   */
  private createCheckerboardPattern(): void {
    if (!this.ctx) return;

    const size = 8;
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size * 2;
    patternCanvas.height = size * 2;
    const patternCtx = patternCanvas.getContext('2d')!;

    // Light squares
    patternCtx.fillStyle = '#1a1d24';
    patternCtx.fillRect(0, 0, size * 2, size * 2);

    // Dark squares
    patternCtx.fillStyle = '#141619';
    patternCtx.fillRect(0, 0, size, size);
    patternCtx.fillRect(size, size, size, size);

    this.checkerboardPattern = this.ctx.createPattern(patternCanvas, 'repeat');
  }

  /**
   * Main render function
   */
  render(
    layers: Layer[],
    hoverPreview: SegmentationResult | null = null,
    activeSelection: SegmentationResult | null = null
  ): void {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Fill background
    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, width, height);

    // Apply coordinate transform
    this.coordSystem.applyTransformToContext(ctx);

    // Render layers
    const visibleLayers = layers.filter(l => l.visible);
    for (const layer of visibleLayers) {
      this.renderLayer(ctx, layer);
    }

    // Render hover preview
    if (hoverPreview && this.options.showSelection) {
      this.renderHoverPreview(ctx, hoverPreview, layers[0]?.imageData);
    }

    // Render active selection
    if (activeSelection && this.options.showSelection) {
      this.renderActiveSelection(ctx, activeSelection, layers[0]?.imageData);
    }

    this.isDirty = false;
  }

  /**
   * Render a single layer
   */
  private renderLayer(ctx: CanvasRenderingContext2D, layer: Layer): void {
    if (!layer.imageData) return;

    ctx.save();

    // Apply layer opacity
    ctx.globalAlpha = layer.opacity;

    // Apply blend mode
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

    // Calculate position (center image at world origin)
    const x = -layer.imageData.width / 2;
    const y = -layer.imageData.height / 2;

    // Draw checkerboard background (for transparency)
    if (this.checkerboardPattern) {
      ctx.fillStyle = this.checkerboardPattern;
      ctx.fillRect(x, y, layer.imageData.width, layer.imageData.height);
    }

    // Create temporary canvas for imageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layer.imageData.width;
    tempCanvas.height = layer.imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(layer.imageData, 0, 0);

    // Draw layer
    ctx.drawImage(tempCanvas, x, y);

    // Draw bounds if enabled
    if (this.options.showBounds) {
      ctx.strokeStyle = '#00d4ff40';
      ctx.lineWidth = 1 / this.coordSystem.getTransform().zoom;
      ctx.strokeRect(x, y, layer.imageData.width, layer.imageData.height);
    }

    ctx.restore();
  }

  /**
   * Render hover preview (semi-transparent overlay)
   */
  private renderHoverPreview(
    ctx: CanvasRenderingContext2D, 
    preview: SegmentationResult,
    baseImageData: ImageData | null
  ): void {
    if (!baseImageData) return;

    ctx.save();
    ctx.globalAlpha = 0.4;

    const x = -baseImageData.width / 2;
    const y = -baseImageData.height / 2;

    // Create preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = baseImageData.width;
    previewCanvas.height = baseImageData.height;
    const previewCtx = previewCanvas.getContext('2d')!;

    // Draw cyan overlay for selected pixels
    const previewImageData = previewCtx.createImageData(baseImageData.width, baseImageData.height);
    
    for (let i = 0; i < preview.mask.length; i++) {
      if (preview.mask[i] > 0) {
        const dataIndex = i * 4;
        previewImageData.data[dataIndex] = 0;     // R
        previewImageData.data[dataIndex + 1] = 212; // G
        previewImageData.data[dataIndex + 2] = 255; // B
        previewImageData.data[dataIndex + 3] = preview.mask[i]; // A
      }
    }

    previewCtx.putImageData(previewImageData, 0, 0);
    ctx.drawImage(previewCanvas, x, y);

    ctx.restore();
  }

  /**
   * Render active selection (marching ants border)
   */
  private renderActiveSelection(
    ctx: CanvasRenderingContext2D,
    selection: SegmentationResult,
    baseImageData: ImageData | null
  ): void {
    if (!baseImageData) return;

    ctx.save();

    const x = -baseImageData.width / 2;
    const y = -baseImageData.height / 2;
    const zoom = this.coordSystem.getTransform().zoom;

    // Draw selection fill
    ctx.globalAlpha = 0.3;
    const selectionCanvas = document.createElement('canvas');
    selectionCanvas.width = baseImageData.width;
    selectionCanvas.height = baseImageData.height;
    const selectionCtx = selectionCanvas.getContext('2d')!;

    const selectionImageData = selectionCtx.createImageData(baseImageData.width, baseImageData.height);
    
    for (let i = 0; i < selection.mask.length; i++) {
      if (selection.mask[i] > 0) {
        const dataIndex = i * 4;
        selectionImageData.data[dataIndex] = 0;
        selectionImageData.data[dataIndex + 1] = 212;
        selectionImageData.data[dataIndex + 2] = 255;
        selectionImageData.data[dataIndex + 3] = 100;
      }
    }

    selectionCtx.putImageData(selectionImageData, 0, 0);
    ctx.drawImage(selectionCanvas, x, y);

    // Draw selection bounds
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(
      x + selection.bounds.x,
      y + selection.bounds.y,
      selection.bounds.width,
      selection.bounds.height
    );

    ctx.restore();
  }

  /**
   * Start animation loop
   */
  startLoop(
    getLayers: () => Layer[],
    getHoverPreview: () => SegmentationResult | null,
    getActiveSelection: () => SegmentationResult | null
  ): void {
    const loop = () => {
      if (this.isDirty) {
        this.render(getLayers(), getHoverPreview(), getActiveSelection());
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop animation loop
   */
  stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  }
}
