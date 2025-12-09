/**
 * V3 Tool Options Panel
 * Context-sensitive tool settings
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wand2, Settings2 } from 'lucide-react';

export function ToolOptions() {
  const { activeTool, toolOptions, setToolOptions } = useProject();

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

        <div className="h-4 w-px bg-border" />

        {/* Anti-alias */}
        <div className="flex items-center gap-2">
          <Switch
            id="antialias"
            checked={toolOptions.antiAlias}
            onCheckedChange={(checked) => setToolOptions({ antiAlias: checked })}
          />
          <Label htmlFor="antialias" className="text-xs text-muted-foreground cursor-pointer">
            Anti-alias
          </Label>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Hints */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Click</kbd>
            {' '}Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Alt+Click</kbd>
            {' '}Extract Layer
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift+Click</kbd>
            {' '}Add to Selection
          </span>
        </div>
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
        Select Magic Wand (W) to use selection tools
      </span>
    </div>
  );
}
