/**
 * V3 Coordinate System
 * Single source of truth for all coordinate transformations
 * 
 * Coordinate Spaces:
 * - Screen: Raw browser event coordinates (CSS pixels)
 * - Canvas: Physical canvas pixel coordinates (accounting for DPR)
 * - World: Infinite canvas space (0,0 at center, extends infinitely)
 * - Image: Pixel coordinates within an image (0,0 at top-left)
 */

import { Point, Transform, Rectangle, CANVAS_CONSTANTS } from './types';

export class CoordinateSystem {
  private canvas: HTMLCanvasElement | null = null;
  private transform: Transform = { panX: 0, panY: 0, zoom: 1 };
  private dpr: number = 1;

  /**
   * Initialize with canvas element
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * Update transform state
   */
  setTransform(transform: Partial<Transform>): void {
    this.transform = { ...this.transform, ...transform };
  }

  /**
   * Get current transform
   */
  getTransform(): Transform {
    return { ...this.transform };
  }

  /**
   * Get DPR
   */
  getDpr(): number {
    return this.dpr;
  }

  /**
   * Get viewport center in CSS pixel coordinates
   */
  getViewportCenter(): Point {
    if (!this.canvas) return { x: 0, y: 0 };
    // Use CSS dimensions, not physical canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.width / 2,
      y: rect.height / 2,
    };
  }

  /**
   * SCREEN → CANVAS (CSS pixels relative to canvas)
   * Convert raw browser event coordinates to canvas-relative CSS pixel coordinates
   */
  screenToCanvas(screenX: number, screenY: number): Point {
    if (!this.canvas) return { x: screenX, y: screenY };

    const rect = this.canvas.getBoundingClientRect();

    return {
      x: screenX - rect.left,
      y: screenY - rect.top,
    };
  }

  /**
   * CANVAS → WORLD
   * Convert canvas-relative CSS pixel coordinates to world space
   */
  canvasToWorld(canvasX: number, canvasY: number): Point {
    const center = this.getViewportCenter();
    const { panX, panY, zoom } = this.transform;

    return {
      x: (canvasX - center.x - panX) / zoom,
      y: (canvasY - center.y - panY) / zoom,
    };
  }

  /**
   * SCREEN → WORLD (shortcut)
   * Most common transformation for event handling
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const canvasPoint = this.screenToCanvas(screenX, screenY);
    return this.canvasToWorld(canvasPoint.x, canvasPoint.y);
  }

  /**
   * WORLD → CANVAS
   * Convert world coordinates to canvas-relative CSS pixel coordinates
   */
  worldToCanvas(worldX: number, worldY: number): Point {
    const center = this.getViewportCenter();
    const { panX, panY, zoom } = this.transform;

    return {
      x: worldX * zoom + panX + center.x,
      y: worldY * zoom + panY + center.y,
    };
  }

  /**
   * WORLD → SCREEN
   * Convert world coordinates to browser screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Point {
    if (!this.canvas) return { x: worldX, y: worldY };

    const canvasPoint = this.worldToCanvas(worldX, worldY);
    const rect = this.canvas.getBoundingClientRect();

    return {
      x: canvasPoint.x + rect.left,
      y: canvasPoint.y + rect.top,
    };
  }

  /**
   * WORLD → IMAGE
   * Convert world coordinates to image pixel indices
   * (In V3, world space IS image space for single-layer operations)
   */
  worldToImage(worldX: number, worldY: number, imageWidth: number, imageHeight: number): Point {
    // Offset so image is centered at world origin
    const imageX = worldX + imageWidth / 2;
    const imageY = worldY + imageHeight / 2;

    return {
      x: Math.floor(imageX),
      y: Math.floor(imageY),
    };
  }

  /**
   * IMAGE → WORLD
   * Convert image pixel indices to world coordinates
   */
  imageToWorld(imageX: number, imageY: number, imageWidth: number, imageHeight: number): Point {
    return {
      x: imageX - imageWidth / 2,
      y: imageY - imageHeight / 2,
    };
  }

  /**
   * IMAGE → PIXEL INDEX
   * Convert 2D image coordinates to 1D pixel index
   */
  imageToPixelIndex(imageX: number, imageY: number, imageWidth: number): number {
    return imageY * imageWidth + imageX;
  }

  /**
   * PIXEL INDEX → IMAGE
   * Convert 1D pixel index to 2D image coordinates
   */
  pixelIndexToImage(pixelIndex: number, imageWidth: number): Point {
    return {
      x: pixelIndex % imageWidth,
      y: Math.floor(pixelIndex / imageWidth),
    };
  }

  /**
   * Check if a world point is within image bounds
   */
  isWorldPointInImage(worldX: number, worldY: number, imageWidth: number, imageHeight: number): boolean {
    const imagePoint = this.worldToImage(worldX, worldY, imageWidth, imageHeight);
    return (
      imagePoint.x >= 0 &&
      imagePoint.x < imageWidth &&
      imagePoint.y >= 0 &&
      imagePoint.y < imageHeight
    );
  }

  /**
   * Get visible world bounds (what's currently visible in viewport)
   */
  getVisibleWorldBounds(): Rectangle {
    if (!this.canvas) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const rect = this.canvas.getBoundingClientRect();
    const topLeft = this.canvasToWorld(0, 0);
    const bottomRight = this.canvasToWorld(rect.width, rect.height);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /**
   * Apply transform to canvas context
   * IMPORTANT: Account for DPR when drawing to high-DPI canvas
   */
  applyTransformToContext(ctx: CanvasRenderingContext2D): void {
    const { panX, panY, zoom } = this.transform;
    
    // Reset and apply DPR scaling first
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    
    // Get center in CSS pixels
    const center = this.getViewportCenter();
    
    // Apply pan and zoom (all in CSS pixel space, DPR handled by initial scale)
    ctx.translate(panX + center.x, panY + center.y);
    ctx.scale(zoom, zoom);
  }

  /**
   * Zoom to a specific point (keeping that point fixed on screen)
   */
  zoomToPoint(screenX: number, screenY: number, newZoom: number): void {
    const clampedZoom = Math.max(
      CANVAS_CONSTANTS.MIN_ZOOM,
      Math.min(CANVAS_CONSTANTS.MAX_ZOOM, newZoom)
    );

    // Get world point before zoom
    const worldPoint = this.screenToWorld(screenX, screenY);

    // Update zoom
    this.transform.zoom = clampedZoom;

    // Get canvas point after zoom change
    const canvasPoint = this.screenToCanvas(screenX, screenY);
    const center = this.getViewportCenter();

    // Adjust pan to keep world point at same screen position
    this.transform.panX = canvasPoint.x - center.x - worldPoint.x * clampedZoom;
    this.transform.panY = canvasPoint.y - center.y - worldPoint.y * clampedZoom;
  }

  /**
   * Pan by delta
   */
  pan(deltaX: number, deltaY: number): void {
    this.transform.panX += deltaX;
    this.transform.panY += deltaY;
  }

  /**
   * Reset transform to default
   */
  reset(): void {
    this.transform = { panX: 0, panY: 0, zoom: 1 };
  }

  /**
   * Fit image to viewport
   */
  fitToViewport(imageWidth: number, imageHeight: number, padding: number = 50): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const viewportWidth = rect.width - padding * 2;
    const viewportHeight = rect.height - padding * 2;

    const scaleX = viewportWidth / imageWidth;
    const scaleY = viewportHeight / imageHeight;
    const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in past 1:1

    this.transform = {
      panX: 0,
      panY: 0,
      zoom: Math.max(CANVAS_CONSTANTS.MIN_ZOOM, zoom),
    };
  }
}

// Singleton instance
export const coordinateSystem = new CoordinateSystem();
