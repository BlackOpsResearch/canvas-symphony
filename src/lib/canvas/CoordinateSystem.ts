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
   * Get viewport center in canvas coordinates
   */
  getViewportCenter(): Point {
    if (!this.canvas) return { x: 0, y: 0 };
    return {
      x: this.canvas.width / (2 * this.dpr),
      y: this.canvas.height / (2 * this.dpr),
    };
  }

  /**
   * SCREEN → CANVAS
   * Convert raw browser event coordinates to canvas pixel coordinates
   */
  screenToCanvas(screenX: number, screenY: number): Point {
    if (!this.canvas) return { x: screenX, y: screenY };

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (screenX - rect.left) * scaleX / this.dpr,
      y: (screenY - rect.top) * scaleY / this.dpr,
    };
  }

  /**
   * CANVAS → WORLD
   * Convert canvas coordinates to world space
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
   * Convert world coordinates to canvas pixel coordinates
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
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;

    return {
      x: canvasPoint.x * this.dpr * scaleX + rect.left,
      y: canvasPoint.y * this.dpr * scaleY + rect.top,
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

    const topLeft = this.canvasToWorld(0, 0);
    const bottomRight = this.canvasToWorld(
      this.canvas.width / this.dpr,
      this.canvas.height / this.dpr
    );

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /**
   * Apply transform to canvas context
   */
  applyTransformToContext(ctx: CanvasRenderingContext2D): void {
    const center = this.getViewportCenter();
    const { panX, panY, zoom } = this.transform;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    const oldZoom = this.transform.zoom;
    this.transform.zoom = clampedZoom;

    // Get canvas point after zoom
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

    const viewportWidth = this.canvas.width / this.dpr - padding * 2;
    const viewportHeight = this.canvas.height / this.dpr - padding * 2;

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
