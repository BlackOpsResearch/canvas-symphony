/**
 * V3 Tool Settings Panel
 * Context-aware settings for the active tool
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sliders, Paintbrush, Eraser, Wand2, Hand, Move, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

// Color presets
const colorPresets = [
  { r: 255, g: 255, b: 255, a: 1, name: 'White' },
  { r: 0, g: 0, b: 0, a: 1, name: 'Black' },
  { r: 255, g: 0, b: 0, a: 1, name: 'Red' },
  { r: 0, g: 255, b: 0, a: 1, name: 'Green' },
  { r: 0, g: 0, b: 255, a: 1, name: 'Blue' },
  { r: 255, g: 255, b: 0, a: 1, name: 'Yellow' },
  { r: 255, g: 0, b: 255, a: 1, name: 'Magenta' },
  { r: 0, g: 255, b: 255, a: 1, name: 'Cyan' },
  { r: 255, g: 128, b: 0, a: 1, name: 'Orange' },
  { r: 128, g: 0, b: 255, a: 1, name: 'Purple' },
  { r: 128, g: 128, b: 128, a: 1, name: 'Gray' },
  { r: 139, g: 69, b: 19, a: 1, name: 'Brown' },
];

export function ToolSettingsPanel() {
  const { activeTool, toolOptions, setToolOptions } = useProject();

  const colorToHex = (color: { r: number; g: number; b: number }) => {
    return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
  };

  const getToolIcon = () => {
    switch (activeTool) {
      case 'brush': return Paintbrush;
      case 'eraser': return Eraser;
      case 'magic-wand': return Wand2;
      case 'hand': return Hand;
      case 'move': return Move;
      case 'zoom': return ZoomIn;
      default: return Sliders;
    }
  };

  const ToolIcon = getToolIcon();

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
        <ToolIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium capitalize">{activeTool.replace('-', ' ')} Settings</span>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Brush Settings */}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <>
            {/* Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Size</Label>
                <span className="text-xs font-mono-precision text-primary">
                  {toolOptions.size}px
                </span>
              </div>
              <Slider
                value={[toolOptions.size]}
                min={1}
                max={500}
                step={1}
                onValueChange={(v) => setToolOptions({ size: v[0] })}
              />
              {/* Quick size presets */}
              <div className="flex gap-1">
                {[5, 10, 25, 50, 100, 200].map((size) => (
                  <button
                    key={size}
                    onClick={() => setToolOptions({ size })}
                    className={cn(
                      'flex-1 px-1 py-1 text-[10px] rounded transition-colors',
                      toolOptions.size === size
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Hardness */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Hardness</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {toolOptions.hardness}%
                </span>
              </div>
              <Slider
                value={[toolOptions.hardness]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setToolOptions({ hardness: v[0] })}
              />
              <p className="text-[10px] text-muted-foreground/70">
                Edge softness (0 = soft, 100 = hard)
              </p>
            </div>

            {/* Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Opacity</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {toolOptions.opacity}%
                </span>
              </div>
              <Slider
                value={[toolOptions.opacity]}
                min={1}
                max={100}
                step={1}
                onValueChange={(v) => setToolOptions({ opacity: v[0] })}
              />
            </div>

            {/* Flow */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Flow</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {toolOptions.brushFlow}%
                </span>
              </div>
              <Slider
                value={[toolOptions.brushFlow]}
                min={1}
                max={100}
                step={1}
                onValueChange={(v) => setToolOptions({ brushFlow: v[0] })}
              />
              <p className="text-[10px] text-muted-foreground/70">
                Paint buildup rate per stroke
              </p>
            </div>

            {/* Spacing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Spacing</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {toolOptions.brushSpacing}%
                </span>
              </div>
              <Slider
                value={[toolOptions.brushSpacing]}
                min={1}
                max={100}
                step={1}
                onValueChange={(v) => setToolOptions({ brushSpacing: v[0] })}
              />
              <p className="text-[10px] text-muted-foreground/70">
                Distance between dabs (% of brush size)
              </p>
            </div>

            {/* Color (brush only) */}
            {activeTool === 'brush' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {colorPresets.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setToolOptions({ brushColor: color })}
                      title={color.name}
                      className={cn(
                        'w-full aspect-square rounded-md border-2 transition-all',
                        JSON.stringify(color) === JSON.stringify(toolOptions.brushColor)
                          ? 'border-primary ring-2 ring-primary/30 scale-110'
                          : 'border-border hover:scale-105'
                      )}
                      style={{ backgroundColor: colorToHex(color) }}
                    />
                  ))}
                </div>
                {/* Current color display */}
                <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ backgroundColor: colorToHex(toolOptions.brushColor) }}
                  />
                  <span className="text-xs font-mono-precision text-muted-foreground">
                    {colorToHex(toolOptions.brushColor).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Magic Wand quick settings */}
        {activeTool === 'magic-wand' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              For detailed Magic Wand settings, open the dedicated Magic Wand panel.
            </p>

            {/* Tolerance quick access */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tolerance</Label>
                <span className="text-xs font-mono-precision text-primary">
                  {toolOptions.tolerance}
                </span>
              </div>
              <Slider
                value={[toolOptions.tolerance]}
                min={0}
                max={255}
                step={1}
                onValueChange={(v) => setToolOptions({ tolerance: v[0] })}
              />
            </div>

            {/* Contiguous */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Contiguous</Label>
              <Switch
                checked={toolOptions.contiguous}
                onCheckedChange={(v) => setToolOptions({ contiguous: v })}
              />
            </div>
          </div>
        )}

        {/* Hand/Move/Zoom info */}
        {(activeTool === 'hand' || activeTool === 'move' || activeTool === 'zoom') && (
          <div className="text-xs text-muted-foreground space-y-2">
            {activeTool === 'hand' && (
              <>
                <p>Click and drag to pan the canvas.</p>
                <p>Or use right-click + drag anywhere.</p>
              </>
            )}
            {activeTool === 'move' && (
              <>
                <p>Click and drag layers to reposition.</p>
                <p>Hold Shift for constrained movement.</p>
              </>
            )}
            {activeTool === 'zoom' && (
              <>
                <p>Click to zoom in, Alt+click to zoom out.</p>
                <p>Or use right-click + scroll anywhere.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
