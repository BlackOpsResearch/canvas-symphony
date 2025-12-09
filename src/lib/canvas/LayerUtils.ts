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
 * Create layer from segmentation result
 */
export function createLayerFromSegment(
  name: string,
  sourceImageData: ImageData,
  segmentation: SegmentationResult
): Layer {
  const { mask, bounds } = segmentation;
  
  const extractedData = new ImageData(bounds.width, bounds.height);
  
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      const sourceX = bounds.x + x;
      const sourceY = bounds.y + y;
      
      if (sourceX < 0 || sourceX >= sourceImageData.width ||
          sourceY < 0 || sourceY >= sourceImageData.height) {
        continue;
      }
      
      const sourceIndex = sourceY * sourceImageData.width + sourceX;
      const maskValue = mask[sourceIndex];
      
      if (maskValue > 0) {
        const sourceDataIndex = sourceIndex * 4;
        const destIndex = (y * bounds.width + x) * 4;
        
        extractedData.data[destIndex] = sourceImageData.data[sourceDataIndex];
        extractedData.data[destIndex + 1] = sourceImageData.data[sourceDataIndex + 1];
        extractedData.data[destIndex + 2] = sourceImageData.data[sourceDataIndex + 2];
        extractedData.data[destIndex + 3] = (sourceImageData.data[sourceDataIndex + 3] * maskValue) / 255;
      }
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
    bounds,
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    modifiers: [],
    effects: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
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
