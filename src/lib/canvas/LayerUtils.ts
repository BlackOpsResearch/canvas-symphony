/**
 * V3 Layer Utilities
 * Layer creation, manipulation, and extraction
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Layer, 
  LayerType, 
  Rectangle, 
  SegmentationResult,
  LayerEffect,
  Color,
  Modifier,
  DEFAULT_LAYER_TRANSFORM,
} from './types';

/**
 * Create a new empty layer
 */
export function createLayer(
  name: string,
  width: number,
  height: number,
  type: LayerType = 'raster'
): Layer {
  const imageData = new ImageData(width, height);
  
  return {
    id: uuidv4(),
    name,
    type,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    imageData,
    bounds: { x: 0, y: 0, width, height },
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    modifiers: [],
    effects: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Create layer from ImageData
 */
export function createLayerFromImageData(
  name: string,
  imageData: ImageData
): Layer {
  return {
    id: uuidv4(),
    name,
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    imageData,
    bounds: { x: 0, y: 0, width: imageData.width, height: imageData.height },
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    modifiers: [],
    effects: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Create layer from segmentation result - FULL CANVAS SIZE (no cropping)
 */
export function createLayerFromSegment(
  name: string,
  sourceImageData: ImageData,
  segmentation: SegmentationResult
): Layer {
  const { mask } = segmentation;
  
  // Create full-size layer, not cropped to bounds
  const extractedData = new ImageData(sourceImageData.width, sourceImageData.height);
  
  for (let i = 0; i < mask.length; i++) {
    const maskValue = mask[i];
    if (maskValue > 0) {
      const dataIndex = i * 4;
      extractedData.data[dataIndex] = sourceImageData.data[dataIndex];
      extractedData.data[dataIndex + 1] = sourceImageData.data[dataIndex + 1];
      extractedData.data[dataIndex + 2] = sourceImageData.data[dataIndex + 2];
      extractedData.data[dataIndex + 3] = (sourceImageData.data[dataIndex + 3] * maskValue) / 255;
    }
  }
  
  return {
    id: uuidv4(),
    name,
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    imageData: extractedData,
    bounds: { x: 0, y: 0, width: sourceImageData.width, height: sourceImageData.height },
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    modifiers: [],
    effects: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Create segment cutout modifier for non-destructive transparency
 */
export function createSegmentCutoutModifier(
  segmentation: SegmentationResult,
  width: number,
  height: number,
  maskOpacity: number = 0 // 0 = fully transparent (cutout)
): Modifier {
  return {
    id: uuidv4(),
    type: 'segment-cutout',
    enabled: true,
    opacity: 100,
    parameters: {
      mask: new Uint8ClampedArray(segmentation.mask),
      width,
      height,
      maskOpacity,
      inverted: false,
    },
  };
}

/**
 * Merge multiple segmentation results into one
 */
export function mergeSegmentations(
  segments: SegmentationResult[],
  width: number,
  height: number
): SegmentationResult {
  const mergedMask = new Uint8ClampedArray(width * height);
  const mergedPixels: number[] = [];
  const pixelSet = new Set<number>();
  
  let minX = width, minY = height, maxX = 0, maxY = 0;
  
  for (const seg of segments) {
    for (const pixelIndex of seg.pixels) {
      if (!pixelSet.has(pixelIndex)) {
        pixelSet.add(pixelIndex);
        mergedPixels.push(pixelIndex);
        mergedMask[pixelIndex] = Math.max(mergedMask[pixelIndex], seg.mask[pixelIndex]);
        
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  return {
    mask: mergedMask,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    pixels: mergedPixels,
    hitLimit: segments.some(s => s.hitLimit),
    metadata: {
      seedColor: segments[0]?.metadata.seedColor || [0, 0, 0, 255],
      tolerance: segments[0]?.metadata.tolerance || 32,
      pixelCount: mergedPixels.length,
      processingTime: segments.reduce((sum, s) => sum + s.metadata.processingTime, 0),
    },
  };
}

/**
 * Duplicate a layer
 */
export function duplicateLayer(layer: Layer): Layer {
  let newImageData: ImageData | null = null;
  
  if (layer.imageData) {
    newImageData = new ImageData(
      new Uint8ClampedArray(layer.imageData.data),
      layer.imageData.width,
      layer.imageData.height
    );
  }
  
  return {
    ...layer,
    id: uuidv4(),
    name: `${layer.name} Copy`,
    imageData: newImageData,
    modifiers: layer.modifiers.map(m => ({ ...m, id: uuidv4() })),
    effects: layer.effects.map(e => ({ ...e, id: uuidv4() })),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

/**
 * Load image file to layer
 */
export async function loadImageToLayer(file: File): Promise<Layer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const layer = createLayerFromImageData(file.name.replace(/\.[^.]+$/, ''), imageData);
        
        resolve(layer);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Composite all visible layers into single ImageData
 */
export function compositeLayers(
  layers: Layer[],
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  const visibleLayers = layers.filter(l => l.visible);
  
  for (const layer of visibleLayers) {
    if (!layer.imageData) continue;
    
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layer.imageData.width;
    tempCanvas.height = layer.imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(layer.imageData, 0, 0);
    
    const x = (width - layer.imageData.width) / 2;
    const y = (height - layer.imageData.height) / 2;
    
    ctx.drawImage(tempCanvas, x, y);
    ctx.restore();
  }
  
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Apply transparency mask to layer
 */
export function applyTransparencyMask(
  imageData: ImageData,
  mask: Uint8ClampedArray,
  inverted: boolean = false
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  
  for (let i = 0; i < mask.length; i++) {
    const maskValue = inverted ? 255 - mask[i] : mask[i];
    const dataIndex = i * 4 + 3;
    result.data[dataIndex] = Math.round((result.data[dataIndex] * (255 - maskValue)) / 255);
  }
  
  return result;
}

/**
 * Create drop shadow effect
 */
export function createDropShadowEffect(
  offsetX: number = 4,
  offsetY: number = 4,
  blur: number = 8,
  spread: number = 0,
  color: Color = { r: 0, g: 0, b: 0, a: 0.5 }
): LayerEffect {
  return {
    id: uuidv4(),
    type: 'drop-shadow',
    enabled: true,
    parameters: { offsetX, offsetY, blur, spread, color },
  };
}

/**
 * Create glow effect
 */
export function createGlowEffect(
  type: 'outer-glow' | 'inner-glow' = 'outer-glow',
  blur: number = 12,
  spread: number = 0,
  color: Color = { r: 0, g: 212, b: 255, a: 0.8 }
): LayerEffect {
  return {
    id: uuidv4(),
    type,
    enabled: true,
    parameters: { blur, spread, color },
  };
}
