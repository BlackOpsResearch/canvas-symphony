/**
 * V3 Image Processing
 * Edge detection, filters, and image manipulation algorithms
 */

import { 
  EdgeDetectionAlgorithm, 
  EdgeDetectionOptions, 
  ImageFilterType,
  ImageFilterOptions,
} from './types';

// ============================================
// CONVOLUTION HELPERS
// ============================================

function convolve(
  imageData: ImageData,
  kernel: number[][],
  normalize: boolean = true
): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);
  
  let kSum = 0;
  if (normalize) {
    for (const row of kernel) {
      for (const val of row) {
        kSum += Math.abs(val);
      }
    }
    kSum = kSum || 1;
  } else {
    kSum = 1;
  }
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx - kHalf));
          const py = Math.min(height - 1, Math.max(0, y + ky - kHalf));
          const idx = (py * width + px) * 4;
          const kVal = kernel[ky][kx];
          
          r += data[idx] * kVal;
          g += data[idx + 1] * kVal;
          b += data[idx + 2] * kVal;
        }
      }
      
      const outIdx = (y * width + x) * 4;
      result.data[outIdx] = Math.min(255, Math.max(0, r / kSum));
      result.data[outIdx + 1] = Math.min(255, Math.max(0, g / kSum));
      result.data[outIdx + 2] = Math.min(255, Math.max(0, b / kSum));
      result.data[outIdx + 3] = data[outIdx + 3];
    }
  }
  
  return result;
}

function toGrayscale(imageData: ImageData): ImageData {
  const result = new ImageData(imageData.width, imageData.height);
  const { data } = imageData;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    result.data[i] = gray;
    result.data[i + 1] = gray;
    result.data[i + 2] = gray;
    result.data[i + 3] = data[i + 3];
  }
  
  return result;
}

// ============================================
// EDGE DETECTION KERNELS
// ============================================

const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];

const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];

const PREWITT_X = [
  [-1, 0, 1],
  [-1, 0, 1],
  [-1, 0, 1],
];

const PREWITT_Y = [
  [-1, -1, -1],
  [0, 0, 0],
  [1, 1, 1],
];

const ROBERTS_X = [
  [1, 0],
  [0, -1],
];

const ROBERTS_Y = [
  [0, 1],
  [-1, 0],
];

const LAPLACIAN_3 = [
  [0, -1, 0],
  [-1, 4, -1],
  [0, -1, 0],
];

const LAPLACIAN_5 = [
  [0, 0, -1, 0, 0],
  [0, -1, -2, -1, 0],
  [-1, -2, 16, -2, -1],
  [0, -1, -2, -1, 0],
  [0, 0, -1, 0, 0],
];

// ============================================
// EDGE DETECTION ALGORITHMS
// ============================================

function computeGradientMagnitude(
  gx: ImageData,
  gy: ImageData,
  threshold: number
): ImageData {
  const { width, height } = gx;
  const result = new ImageData(width, height);
  
  for (let i = 0; i < gx.data.length; i += 4) {
    const dx = gx.data[i];
    const dy = gy.data[i];
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    const val = magnitude > threshold ? 255 : 0;
    
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }
  
  return result;
}

export function applySobel(imageData: ImageData, options: EdgeDetectionOptions): ImageData {
  const gray = toGrayscale(imageData);
  const gx = convolve(gray, SOBEL_X, false);
  const gy = convolve(gray, SOBEL_Y, false);
  return computeGradientMagnitude(gx, gy, options.threshold);
}

export function applyLaplacian(imageData: ImageData, options: EdgeDetectionOptions): ImageData {
  const gray = toGrayscale(imageData);
  const kernel = options.kernelSize === 5 ? LAPLACIAN_5 : LAPLACIAN_3;
  const result = convolve(gray, kernel, false);
  
  // Apply threshold
  for (let i = 0; i < result.data.length; i += 4) {
    const val = Math.abs(result.data[i]) > options.threshold ? 255 : 0;
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = 255;
  }
  
  return result;
}

export function applyPrewitt(imageData: ImageData, options: EdgeDetectionOptions): ImageData {
  const gray = toGrayscale(imageData);
  const gx = convolve(gray, PREWITT_X, false);
  const gy = convolve(gray, PREWITT_Y, false);
  return computeGradientMagnitude(gx, gy, options.threshold);
}

export function applyRoberts(imageData: ImageData, options: EdgeDetectionOptions): ImageData {
  const gray = toGrayscale(imageData);
  const { width, height } = gray;
  const result = new ImageData(width, height);
  
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idx1 = ((y + 1) * width + (x + 1)) * 4;
      const idx2 = (y * width + (x + 1)) * 4;
      const idx3 = ((y + 1) * width + x) * 4;
      
      const gx = gray.data[idx] - gray.data[idx1];
      const gy = gray.data[idx2] - gray.data[idx3];
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const val = magnitude > options.threshold ? 255 : 0;
      
      result.data[idx] = val;
      result.data[idx + 1] = val;
      result.data[idx + 2] = val;
      result.data[idx + 3] = 255;
    }
  }
  
  return result;
}

export function applyCanny(imageData: ImageData, options: EdgeDetectionOptions): ImageData {
  // Simplified Canny: Gaussian blur → Sobel → Non-max suppression → Thresholding
  const gray = toGrayscale(imageData);
  
  // Gaussian blur
  const gaussianKernel = [
    [1, 4, 6, 4, 1],
    [4, 16, 24, 16, 4],
    [6, 24, 36, 24, 6],
    [4, 16, 24, 16, 4],
    [1, 4, 6, 4, 1],
  ].map(row => row.map(v => v / 256));
  
  const blurred = convolve(gray, gaussianKernel, false);
  
  // Sobel gradients
  const gx = convolve(blurred, SOBEL_X, false);
  const gy = convolve(blurred, SOBEL_Y, false);
  
  const { width, height } = imageData;
  const result = new ImageData(width, height);
  
  const lowThreshold = options.lowThreshold ?? options.threshold * 0.4;
  const highThreshold = options.highThreshold ?? options.threshold;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const dx = gx.data[idx];
      const dy = gy.data[idx];
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      
      let val = 0;
      if (magnitude >= highThreshold) {
        val = 255;
      } else if (magnitude >= lowThreshold) {
        val = 128; // Weak edge
      }
      
      result.data[idx] = val;
      result.data[idx + 1] = val;
      result.data[idx + 2] = val;
      result.data[idx + 3] = 255;
    }
  }
  
  return result;
}

export function applyEdgeDetection(
  imageData: ImageData,
  options: EdgeDetectionOptions
): ImageData {
  switch (options.algorithm) {
    case 'sobel':
      return applySobel(imageData, options);
    case 'laplacian':
      return applyLaplacian(imageData, options);
    case 'prewitt':
      return applyPrewitt(imageData, options);
    case 'roberts':
      return applyRoberts(imageData, options);
    case 'canny':
      return applyCanny(imageData, options);
    default:
      return applySobel(imageData, options);
  }
}

// ============================================
// IMAGE FILTERS
// ============================================

export function applyGrayscale(imageData: ImageData): ImageData {
  return toGrayscale(imageData);
}

export function applyInvert(imageData: ImageData): ImageData {
  const result = new ImageData(imageData.width, imageData.height);
  const { data } = imageData;
  
  for (let i = 0; i < data.length; i += 4) {
    result.data[i] = 255 - data[i];
    result.data[i + 1] = 255 - data[i + 1];
    result.data[i + 2] = 255 - data[i + 2];
    result.data[i + 3] = data[i + 3];
  }
  
  return result;
}

export function applyThreshold(imageData: ImageData, threshold: number): ImageData {
  const gray = toGrayscale(imageData);
  const result = new ImageData(gray.width, gray.height);
  
  for (let i = 0; i < gray.data.length; i += 4) {
    const val = gray.data[i] > threshold ? 255 : 0;
    result.data[i] = val;
    result.data[i + 1] = val;
    result.data[i + 2] = val;
    result.data[i + 3] = gray.data[i + 3];
  }
  
  return result;
}

export function applyGaussianBlur(imageData: ImageData, intensity: number): ImageData {
  const sigma = intensity / 100 * 5;
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[][] = [];
  const half = Math.floor(size / 2);
  let sum = 0;
  
  for (let y = -half; y <= half; y++) {
    const row: number[] = [];
    for (let x = -half; x <= half; x++) {
      const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(val);
      sum += val;
    }
    kernel.push(row);
  }
  
  // Normalize
  for (const row of kernel) {
    for (let i = 0; i < row.length; i++) {
      row[i] /= sum;
    }
  }
  
  return convolve(imageData, kernel, false);
}

export function applySharpen(imageData: ImageData, intensity: number): ImageData {
  const amount = intensity / 100 * 2;
  const kernel = [
    [0, -amount, 0],
    [-amount, 1 + 4 * amount, -amount],
    [0, -amount, 0],
  ];
  return convolve(imageData, kernel, false);
}

export function applyEmboss(imageData: ImageData): ImageData {
  const kernel = [
    [-2, -1, 0],
    [-1, 1, 1],
    [0, 1, 2],
  ];
  const result = convolve(imageData, kernel, false);
  
  // Shift to gray midpoint
  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = Math.min(255, Math.max(0, result.data[i] + 128));
    result.data[i + 1] = Math.min(255, Math.max(0, result.data[i + 1] + 128));
    result.data[i + 2] = Math.min(255, Math.max(0, result.data[i + 2] + 128));
  }
  
  return result;
}

export function applyEdgeEnhance(imageData: ImageData): ImageData {
  const kernel = [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ];
  return convolve(imageData, kernel, false);
}

export function applyPosterize(imageData: ImageData, levels: number): ImageData {
  const result = new ImageData(imageData.width, imageData.height);
  const { data } = imageData;
  const step = 255 / (levels - 1);
  
  for (let i = 0; i < data.length; i += 4) {
    result.data[i] = Math.round(Math.round(data[i] / step) * step);
    result.data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
    result.data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    result.data[i + 3] = data[i + 3];
  }
  
  return result;
}

export function applySepia(imageData: ImageData): ImageData {
  const result = new ImageData(imageData.width, imageData.height);
  const { data } = imageData;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    result.data[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
    result.data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
    result.data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    result.data[i + 3] = data[i + 3];
  }
  
  return result;
}

export function applyImageFilter(
  imageData: ImageData,
  options: ImageFilterOptions
): ImageData {
  switch (options.type) {
    case 'grayscale':
      return applyGrayscale(imageData);
    case 'invert':
      return applyInvert(imageData);
    case 'threshold':
      return applyThreshold(imageData, options.threshold ?? 128);
    case 'gaussian-blur':
      return applyGaussianBlur(imageData, options.intensity);
    case 'sharpen':
      return applySharpen(imageData, options.intensity);
    case 'emboss':
      return applyEmboss(imageData);
    case 'edge-enhance':
      return applyEdgeEnhance(imageData);
    case 'posterize':
      return applyPosterize(imageData, options.levels ?? 4);
    case 'sepia':
      return applySepia(imageData);
    default:
      return imageData;
  }
}
