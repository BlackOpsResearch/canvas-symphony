/**
 * V3 Layers Panel
 * Right-side layer management panel
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Layer } from '@/lib/canvas/types';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  ChevronDown,
  Image,
  Layers,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { duplicateLayer, createLayer } from '@/lib/canvas/LayerUtils';
import { toast } from 'sonner';

export function LayersPanel() {
  const { 
    project, 
    selectLayer, 
    updateLayer, 
    removeLayer, 
    addLayer 
  } = useProject();

  const handleToggleVisibility = (layer: Layer) => {
    updateLayer(layer.id, { visible: !layer.visible });
  };

  const handleToggleLock = (layer: Layer) => {
    updateLayer(layer.id, { locked: !layer.locked });
  };

  const handleOpacityChange = (layer: Layer, value: number[]) => {
    updateLayer(layer.id, { opacity: value[0] / 100 });
  };

  const handleDuplicate = (layer: Layer) => {
    const newLayer = duplicateLayer(layer);
    addLayer(newLayer);
    toast.success(`Duplicated "${layer.name}"`);
  };

  const handleDelete = (layer: Layer) => {
    if (layer.locked) {
      toast.error('Cannot delete locked layer');
      return;
    }
    removeLayer(layer.id);
    toast.success(`Deleted "${layer.name}"`);
  };

  const handleAddEmptyLayer = () => {
    const newLayer = createLayer(
      `Layer ${project.layers.length + 1}`,
      project.width,
      project.height
    );
    addLayer(newLayer);
  };

  // Render layer thumbnail
  const renderThumbnail = (layer: Layer) => {
    if (!layer.imageData) {
      return (
        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
          <Image className="w-5 h-5 text-muted-foreground/50" />
        </div>
      );
    }

    // Create thumbnail canvas
    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Draw checkerboard
    const checkSize = 4;
    for (let y = 0; y < size; y += checkSize) {
      for (let x = 0; x < size; x += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#1a1d24' : '#141619';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw scaled image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layer.imageData.width;
    tempCanvas.height = layer.imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(layer.imageData, 0, 0);

    const scale = Math.min(size / layer.imageData.width, size / layer.imageData.height);
    const scaledWidth = layer.imageData.width * scale;
    const scaledHeight = layer.imageData.height * scale;
    const offsetX = (size - scaledWidth) / 2;
    const offsetY = (size - scaledHeight) / 2;

    ctx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);

    return (
      <img 
        src={canvas.toDataURL()} 
        alt={layer.name}
        className="w-12 h-12 rounded object-cover"
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-panel-header">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Layers</span>
        </div>
        <button
          onClick={handleAddEmptyLayer}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {project.layers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Image className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">No layers yet</p>
            <p className="text-xs text-muted-foreground/70">
              Upload an image to get started
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {[...project.layers].reverse().map((layer) => {
              const isSelected = project.selectedLayerIds.includes(layer.id);

              return (
                <div
                  key={layer.id}
                  onClick={() => selectLayer(layer.id)}
                  className={cn(
                    'group relative rounded-lg p-2 cursor-pointer transition-all duration-200',
                    isSelected 
                      ? 'bg-primary/10 border border-primary/30' 
                      : 'hover:bg-layer-hover border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="relative">
                      {renderThumbnail(layer)}
                      {!layer.visible && (
                        <div className="absolute inset-0 bg-background/80 rounded flex items-center justify-center">
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium truncate',
                          !layer.visible && 'text-muted-foreground'
                        )}>
                          {layer.name}
                        </span>
                        {layer.locked && (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {layer.imageData 
                          ? `${layer.imageData.width} × ${layer.imageData.height}`
                          : 'Empty'
                        }
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVisibility(layer);
                        }}
                        className="p-1.5 rounded hover:bg-muted"
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLock(layer);
                        }}
                        className="p-1.5 rounded hover:bg-muted"
                      >
                        {layer.locked ? (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(layer);
                        }}
                        className="p-1.5 rounded hover:bg-muted"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(layer);
                        }}
                        className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Opacity slider (visible when selected) */}
                  {isSelected && (
                    <div className="mt-3 px-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Opacity</span>
                        <span className="font-mono-precision">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[layer.opacity * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(value) => handleOpacityChange(layer, value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
