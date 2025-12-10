/**
 * V3 Magic Wand Settings Panel
 * Comprehensive settings for the magic wand segmentation system
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2, Info, Maximize2, Grid3X3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CANVAS_CONSTANTS } from '@/lib/canvas/types';

export function WandSettingsPanel() {
  const { toolOptions, setToolOptions } = useProject();

  // Extended wand options with defaults
  const wandOptions = {
    tolerance: toolOptions.tolerance ?? 32,
    contiguous: toolOptions.contiguous ?? true,
    antiAlias: toolOptions.antiAlias ?? true,
    maxPreviewPixels: (toolOptions as any).maxPreviewPixels ?? CANVAS_CONSTANTS.MAX_PREVIEW_PIXELS,
    maxSegmentPixels: (toolOptions as any).maxSegmentPixels ?? 0, // 0 = unlimited
    connectivity: (toolOptions as any).connectivity ?? 4,
    sampleSize: (toolOptions as any).sampleSize ?? 'point',
    featherRadius: (toolOptions as any).featherRadius ?? 0,
    expandContract: (toolOptions as any).expandContract ?? 0,
    useAlphaChannel: (toolOptions as any).useAlphaChannel ?? false,
    colorSpace: (toolOptions as any).colorSpace ?? 'rgb',
  };

  const updateWandOption = (key: string, value: any) => {
    setToolOptions({ [key]: value });
  };

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
        <Wand2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Magic Wand Settings</span>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Selection Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Grid3X3 className="w-3.5 h-3.5" />
            Selection
          </h3>

          {/* Tolerance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Tolerance</Label>
              <span className="text-xs font-mono-precision text-primary">
                {wandOptions.tolerance}
              </span>
            </div>
            <Slider
              value={[wandOptions.tolerance]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => updateWandOption('tolerance', v[0])}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Color similarity threshold (0 = exact match, 255 = all colors)
            </p>
          </div>

          {/* Contiguous */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Contiguous</Label>
              <p className="text-[10px] text-muted-foreground/70">
                Only select connected pixels
              </p>
            </div>
            <Switch
              checked={wandOptions.contiguous}
              onCheckedChange={(v) => updateWandOption('contiguous', v)}
            />
          </div>

          {/* Connectivity */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Connectivity</Label>
            <Select
              value={String(wandOptions.connectivity)}
              onValueChange={(v) => updateWandOption('connectivity', Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4" className="text-xs">4-way (Cross)</SelectItem>
                <SelectItem value="8" className="text-xs">8-way (Square)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/70">
              4-way: cardinal directions only. 8-way: includes diagonals.
            </p>
          </div>

          {/* Sample Size */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sample Size</Label>
            <Select
              value={wandOptions.sampleSize}
              onValueChange={(v) => updateWandOption('sampleSize', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="point" className="text-xs">Point Sample</SelectItem>
                <SelectItem value="3x3" className="text-xs">3×3 Average</SelectItem>
                <SelectItem value="5x5" className="text-xs">5×5 Average</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/70">
              Area to sample for seed color reference
            </p>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Performance
          </h3>

          {/* Max Preview Pixels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Preview Limit</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {wandOptions.maxPreviewPixels === 0 ? 'Full' : wandOptions.maxPreviewPixels.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[wandOptions.maxPreviewPixels]}
              min={0}
              max={500000}
              step={10000}
              onValueChange={(v) => updateWandOption('maxPreviewPixels', v[0])}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Max pixels for hover preview (0 = full document). Lower = faster hover.
            </p>
          </div>

          {/* Max Segment Pixels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Segment Limit</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {wandOptions.maxSegmentPixels === 0 ? 'Unlimited' : wandOptions.maxSegmentPixels.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[wandOptions.maxSegmentPixels]}
              min={0}
              max={2000000}
              step={50000}
              onValueChange={(v) => updateWandOption('maxSegmentPixels', v[0])}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Max pixels for click selection (0 = unlimited/full doc)
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                updateWandOption('maxPreviewPixels', 50000);
                updateWandOption('maxSegmentPixels', 0);
              }}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 transition-colors"
            >
              Fast Preview
            </button>
            <button
              onClick={() => {
                updateWandOption('maxPreviewPixels', 0);
                updateWandOption('maxSegmentPixels', 0);
              }}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 transition-colors"
            >
              Full Document
            </button>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Maximize2 className="w-3.5 h-3.5" />
            Advanced
          </h3>

          {/* Anti-alias */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Anti-alias</Label>
              <p className="text-[10px] text-muted-foreground/70">
                Smooth selection edges
              </p>
            </div>
            <Switch
              checked={wandOptions.antiAlias}
              onCheckedChange={(v) => updateWandOption('antiAlias', v)}
            />
          </div>

          {/* Use Alpha */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Consider Alpha</Label>
              <p className="text-[10px] text-muted-foreground/70">
                Include transparency in comparison
              </p>
            </div>
            <Switch
              checked={wandOptions.useAlphaChannel}
              onCheckedChange={(v) => updateWandOption('useAlphaChannel', v)}
            />
          </div>

          {/* Color Space */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Color Space</Label>
            <Select
              value={wandOptions.colorSpace}
              onValueChange={(v) => updateWandOption('colorSpace', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rgb" className="text-xs">RGB (Default)</SelectItem>
                <SelectItem value="hsv" className="text-xs">HSV (Hue-based)</SelectItem>
                <SelectItem value="lab" className="text-xs">LAB (Perceptual)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/70">
              Color comparison method. LAB is most perceptually accurate.
            </p>
          </div>

          {/* Feather */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Feather Radius</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {wandOptions.featherRadius}px
              </span>
            </div>
            <Slider
              value={[wandOptions.featherRadius]}
              min={0}
              max={50}
              step={1}
              onValueChange={(v) => updateWandOption('featherRadius', v[0])}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Blur selection edges for smoother transitions
            </p>
          </div>

          {/* Expand/Contract */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Expand/Contract</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {wandOptions.expandContract > 0 ? '+' : ''}{wandOptions.expandContract}px
              </span>
            </div>
            <Slider
              value={[wandOptions.expandContract]}
              min={-20}
              max={20}
              step={1}
              onValueChange={(v) => updateWandOption('expandContract', v[0])}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Grow (+) or shrink (-) selection boundary
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[10px] text-muted-foreground space-y-1">
              <p><strong>Click:</strong> Create selection</p>
              <p><strong>Alt+Click:</strong> Extract to new layer</p>
              <p><strong>Shift+Click:</strong> Add to selection</p>
              <p><strong>Ctrl+Click:</strong> Subtract from selection</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
