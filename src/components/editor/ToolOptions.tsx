/**
 * V3 Tool Options Panel
 * Context-sensitive tool settings with brush/eraser options
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wand2, Settings2, Paintbrush, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple color picker
const colorPresets = [
  { r: 255, g: 255, b: 255, a: 1 }, // White
  { r: 0, g: 0, b: 0, a: 1 },       // Black
  { r: 255, g: 0, b: 0, a: 1 },     // Red
  { r: 0, g: 255, b: 0, a: 1 },     // Green
  { r: 0, g: 0, b: 255, a: 1 },     // Blue
  { r: 255, g: 255, b: 0, a: 1 },   // Yellow
  { r: 255, g: 0, b: 255, a: 1 },   // Magenta
  { r: 0, g: 255, b: 255, a: 1 },   // Cyan
  { r: 255, g: 128, b: 0, a: 1 },   // Orange
  { r: 128, g: 0, b: 255, a: 1 },   // Purple
];

export function ToolOptions() {
  const { activeTool, toolOptions, setToolOptions } = useProject();

  const colorToHex = (color: { r: number; g: number; b: number }) => {
    return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
  };

  // Magic Wand options
  if (activeTool === 'magic-wand') {
    return (
      <div className="flex items-center gap-6 px-4 py-2 bg-panel-bg border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wand2 className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Magic Wand</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Tolerance */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Tolerance
          </Label>
          <div className="w-32">
            <Slider
              value={[toolOptions.tolerance]}
              min={0}
              max={255}
              step={1}
              onValueChange={(value) => setToolOptions({ tolerance: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.tolerance}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Contiguous */}
        <div className="flex items-center gap-2">
          <Switch
            id="contiguous"
            checked={toolOptions.contiguous}
            onCheckedChange={(checked) => setToolOptions({ contiguous: checked })}
          />
          <Label htmlFor="contiguous" className="text-xs text-muted-foreground cursor-pointer">
            Contiguous
          </Label>
        </div>

        <div className="flex-1" />

        {/* Hints */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Click</kbd>
            {' '}Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Alt+Click</kbd>
            {' '}Extract
          </span>
        </div>
      </div>
    );
  }

  // Brush options
  if (activeTool === 'brush') {
    return (
      <div className="flex items-center gap-6 px-4 py-2 bg-panel-bg border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paintbrush className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Brush</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Size */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Size
          </Label>
          <div className="w-24">
            <Slider
              value={[toolOptions.size]}
              min={1}
              max={200}
              step={1}
              onValueChange={(value) => setToolOptions({ size: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.size}px
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Hardness */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Hardness
          </Label>
          <div className="w-20">
            <Slider
              value={[toolOptions.hardness]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => setToolOptions({ hardness: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.hardness}%
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Opacity */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Opacity
          </Label>
          <div className="w-20">
            <Slider
              value={[toolOptions.opacity]}
              min={1}
              max={100}
              step={1}
              onValueChange={(value) => setToolOptions({ opacity: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.opacity}%
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Color presets */}
        <div className="flex items-center gap-1">
          {colorPresets.slice(0, 6).map((color, i) => (
            <button
              key={i}
              onClick={() => setToolOptions({ brushColor: color })}
              className={cn(
                'w-5 h-5 rounded-sm border transition-all',
                JSON.stringify(color) === JSON.stringify(toolOptions.brushColor)
                  ? 'border-primary ring-1 ring-primary scale-110'
                  : 'border-border hover:scale-110'
              )}
              style={{ backgroundColor: colorToHex(color) }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Eraser options
  if (activeTool === 'eraser') {
    return (
      <div className="flex items-center gap-6 px-4 py-2 bg-panel-bg border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eraser className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Eraser</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Size */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Size
          </Label>
          <div className="w-24">
            <Slider
              value={[toolOptions.size]}
              min={1}
              max={200}
              step={1}
              onValueChange={(value) => setToolOptions({ size: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.size}px
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Hardness */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Hardness
          </Label>
          <div className="w-20">
            <Slider
              value={[toolOptions.hardness]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => setToolOptions({ hardness: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.hardness}%
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Opacity */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Opacity
          </Label>
          <div className="w-20">
            <Slider
              value={[toolOptions.opacity]}
              min={1}
              max={100}
              step={1}
              onValueChange={(value) => setToolOptions({ opacity: value[0] })}
            />
          </div>
          <span className="text-xs font-mono-precision text-muted-foreground w-8">
            {toolOptions.opacity}%
          </span>
        </div>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">
          Click and drag to erase
        </span>
      </div>
    );
  }

  // Default: Show tool name
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-panel-bg border-b border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Settings2 className="w-4 h-4" />
        <span className="font-medium text-foreground capitalize">{activeTool}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        Select a drawing tool (B for Brush, E for Eraser, W for Magic Wand)
      </span>
    </div>
  );
}
