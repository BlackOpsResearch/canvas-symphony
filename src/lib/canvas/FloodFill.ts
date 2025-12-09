/**
 * V3 Flood Fill Algorithm
 * High-performance iterative flood fill for magic wand selection
 */

import { Point, Rectangle, SegmentationResult } from './types';

interface FloodFillOptions {
  tolerance: number;
  contiguous: boolean;
  maxPixels?: number;
}

/**
 * Calculate color difference (Euclidean distance in RGB space)
 */
function colorDifference(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Iterative flood fill algorithm
 * Uses queue-based BFS instead of recursion to avoid stack overflow
 */
export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  options: FloodFillOptions
): SegmentationResult {
  const startTime = performance.now();
  const { width, height, data } = imageData;
  const { tolerance, contiguous, maxPixels } = options;

  // Validate start point
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return {
      mask: new Uint8ClampedArray(width * height),
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      pixels: [],
      hitLimit: false,
      metadata: {
        seedColor: [0, 0, 0, 0],
        tolerance,
        pixelCount: 0,
        processingTime: performance.now() - startTime,
      },
    };
  }

  // Get seed color
  const startIndex = (startY * width + startX) * 4;
  const seedR = data[startIndex];
  const seedG = data[startIndex + 1];
  const seedB = data[startIndex + 2];
  const seedA = data[startIndex + 3];

  // Initialize mask and tracking
  const mask = new Uint8ClampedArray(width * height);
  const visited = new Uint8Array(width * height);
  const pixels: number[] = [];

  // Bounds tracking
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // Tolerance threshold (0-255 scale mapped to 0-441 Euclidean distance)
  const toleranceThreshold = (tolerance / 255) * 441.67; // sqrt(255^2 * 3)

  if (contiguous) {
    // BFS flood fill
    const queue: number[] = [startX, startY];
    let hitLimit = false;

    while (queue.length > 0) {
      const y = queue.pop()!;
      const x = queue.pop()!;

      // Bounds check
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pixelIndex = y * width + x;

      // Skip if already visited
      if (visited[pixelIndex]) continue;
      visited[pixelIndex] = 1;

      // Get pixel color
      const dataIndex = pixelIndex * 4;
      const r = data[dataIndex];
      const g = data[dataIndex + 1];
      const b = data[dataIndex + 2];

      // Check color similarity
      const diff = colorDifference(r, g, b, seedR, seedG, seedB);
      
      if (diff <= toleranceThreshold) {
        // Mark as selected
        mask[pixelIndex] = 255;
        pixels.push(pixelIndex);

        // Update bounds
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        // Check pixel limit
        if (maxPixels && pixels.length >= maxPixels) {
          hitLimit = true;
          break;
        }

        // Add neighbors (4-connectivity)
        queue.push(x + 1, y);
        queue.push(x - 1, y);
        queue.push(x, y + 1);
        queue.push(x, y - 1);
      }
    }

    return {
      mask,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      pixels,
      hitLimit,
      metadata: {
        seedColor: [seedR, seedG, seedB, seedA],
        tolerance,
        pixelCount: pixels.length,
        processingTime: performance.now() - startTime,
      },
    };
  } else {
    // Global (non-contiguous) selection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const dataIndex = pixelIndex * 4;

        const r = data[dataIndex];
        const g = data[dataIndex + 1];
        const b = data[dataIndex + 2];

        const diff = colorDifference(r, g, b, seedR, seedG, seedB);

        if (diff <= toleranceThreshold) {
          mask[pixelIndex] = 255;
          pixels.push(pixelIndex);

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);

          if (maxPixels && pixels.length >= maxPixels) {
            break;
          }
        }
      }
      if (maxPixels && pixels.length >= maxPixels) break;
    }

    return {
      mask,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      pixels,
      hitLimit: maxPixels !== undefined && pixels.length >= maxPixels,
      metadata: {
        seedColor: [seedR, seedG, seedB, seedA],
        tolerance,
        pixelCount: pixels.length,
        processingTime: performance.now() - startTime,
      },
    };
  }
}

/**
 * Quick preview flood fill (limited pixels for hover preview)
 */
export function floodFillPreview(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
  maxPixels: number = 50000
): SegmentationResult {
  return floodFill(imageData, startX, startY, {
    tolerance,
    contiguous: true,
    maxPixels,
  });
}
