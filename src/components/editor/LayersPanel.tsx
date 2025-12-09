/**
 * V3 Layers Panel
 * Layer management with blend modes and effects
 */

import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { Layer, BLEND_MODES, Color } from '@/lib/canvas/types';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  ChevronDown,
  ChevronUp,
  Image,
  Layers,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { duplicateLayer, createLayer, createDropShadowEffect, createGlowEffect } from '@/lib/canvas/LayerUtils';
import { toast } from 'sonner';

export function LayersPanel() {
  const { 
    project, 
    transform,
    selectLayer, 
    updateLayer, 
    removeLayer, 
    addLayer 
  } = useProject();
  const { pushSnapshot } = useHistory();
  const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set());

  const saveToHistory = (description: string) => {
    pushSnapshot(
      description,
      project.layers,
      project.selectedLayerIds,
      project.activeLayerId,
      transform
    );
  };

  const handleToggleVisibility = (layer: Layer) => {
    saveToHistory(`Toggle visibility: ${layer.name}`);
    updateLayer(layer.id, { visible: !layer.visible });
  };

  const handleToggleLock = (layer: Layer) => {
    updateLayer(layer.id, { locked: !layer.locked });
  };

  const handleOpacityChange = (layer: Layer, value: number[]) => {
    updateLayer(layer.id, { opacity: value[0] / 100 });
  };

  const handleBlendModeChange = (layer: Layer, blendMode: string) => {
    saveToHistory(`Blend mode: ${blendMode}`);
    updateLayer(layer.id, { blendMode: blendMode as Layer['blendMode'] });
  };

  const handleDuplicate = (layer: Layer) => {
    saveToHistory(`Duplicate: ${layer.name}`);
    const newLayer = duplicateLayer(layer);
    addLayer(newLayer);
    toast.success(`Duplicated "${layer.name}"`);
  };

  const handleDelete = (layer: Layer) => {
    if (layer.locked) {
      toast.error('Cannot delete locked layer');
      return;
    }
    saveToHistory(`Delete: ${layer.name}`);
    removeLayer(layer.id);
    toast.success(`Deleted "${layer.name}"`);
  };

  const handleAddDropShadow = (layer: Layer) => {
    saveToHistory(`Add drop shadow: ${layer.name}`);
    const effect = createDropShadowEffect();
    updateLayer(layer.id, { 
      effects: [...layer.effects, effect] 
    });
    setExpandedEffects(prev => new Set([...prev, layer.id]));
    toast.success('Added drop shadow');
  };

  const handleAddGlow = (layer: Layer) => {
    saveToHistory(`Add glow: ${layer.name}`);
    const effect = createGlowEffect('outer-glow');
    updateLayer(layer.id, { 
      effects: [...layer.effects, effect] 
    });
    setExpandedEffects(prev => new Set([...prev, layer.id]));
    toast.success('Added outer glow');
  };

  const handleRemoveEffect = (layer: Layer, effectId: string) => {
    saveToHistory(`Remove effect: ${layer.name}`);
    updateLayer(layer.id, {
      effects: layer.effects.filter(e => e.id !== effectId)
    });
  };

  const handleAddEmptyLayer = () => {
    saveToHistory('Add empty layer');
    const newLayer = createLayer(
      `Layer ${project.layers.length + 1}`,
      project.width,
      project.height
    );
    addLayer(newLayer);
  };

  const toggleEffectsExpanded = (layerId: string) => {
    setExpandedEffects(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
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

    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const checkSize = 4;
    for (let y = 0; y < size; y += checkSize) {
      for (let x = 0; x < size; x += checkSize) {
        ctx.fillStyle = ((x + y) / checkSize) % 2 === 0 ? '#1a1d24' : '#141619';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

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
              const hasEffects = layer.effects.length > 0;
              const isEffectsExpanded = expandedEffects.has(layer.id);

              return (
                <Collapsible
                  key={layer.id}
                  open={isSelected}
                >
                  <div
                    onClick={() => selectLayer(layer.id)}
                    className={cn(
                      'group relative rounded-lg cursor-pointer transition-all duration-200',
                      isSelected 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-layer-hover border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3 p-2">
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
                          {hasEffects && (
                            <Sparkles className="w-3 h-3 text-primary/60" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{layer.blendMode}</span>
                          <span>·</span>
                          <span>{Math.round(layer.opacity * 100)}%</span>
                        </div>
                      </div>

                      {/* Quick actions */}
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
                            handleDelete(layer);
                          }}
                          className="p-1.5 rounded hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded controls */}
                    <CollapsibleContent>
                      <div className="px-2 pb-3 space-y-3">
                        {/* Blend Mode */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">
                            Blend Mode
                          </label>
                          <Select
                            value={layer.blendMode}
                            onValueChange={(value) => handleBlendModeChange(layer, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BLEND_MODES.map((mode) => (
                                <SelectItem key={mode.value} value={mode.value} className="text-xs">
                                  {mode.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Opacity */}
                        <div>
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
                          />
                        </div>

                        {/* Effects */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Effects</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddDropShadow(layer);
                                }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Add Drop Shadow"
                              >
                                <Sun className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddGlow(layer);
                                }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Add Glow"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          {layer.effects.length > 0 && (
                            <div className="space-y-1">
                              {layer.effects.map((effect) => (
                                <div
                                  key={effect.id}
                                  className="flex items-center justify-between px-2 py-1 rounded bg-muted/50 text-xs"
                                >
                                  <span className="capitalize">
                                    {effect.type.replace('-', ' ')}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveEffect(layer, effect.id);
                                    }}
                                    className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* More actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLock(layer);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground"
                          >
                            {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {layer.locked ? 'Unlock' : 'Lock'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(layer);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground"
                          >
                            <Copy className="w-3 h-3" />
                            Duplicate
                          </button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
