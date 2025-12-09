/**
 * V3 Status Bar
 * Bottom status information
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Layers, MousePointer2, Target, Cpu } from 'lucide-react';

export function StatusBar() {
  const { 
    project, 
    transform, 
    cursorPosition, 
    hoverPreview,
    activeSelection 
  } = useProject();

  const baseLayer = project.layers[0];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-panel-bg border-t border-border text-xs">
      {/* Left: Document info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layers className="w-3.5 h-3.5" />
          <span className="font-mono-precision">
            {project.layers.length} layer{project.layers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {baseLayer?.imageData && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-mono-precision">
              {baseLayer.imageData.width} × {baseLayer.imageData.height}
            </span>
          </div>
        )}
      </div>

      {/* Center: Cursor position */}
      <div className="flex items-center gap-4">
        {cursorPosition && baseLayer?.imageData && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="font-mono-precision">
              X: {Math.round(cursorPosition.x + baseLayer.imageData.width / 2)}
              {' '}
              Y: {Math.round(cursorPosition.y + baseLayer.imageData.height / 2)}
            </span>
          </div>
        )}

        {hoverPreview && (
          <div className="flex items-center gap-1.5 text-primary">
            <Target className="w-3.5 h-3.5" />
            <span className="font-mono-precision">
              {hoverPreview.metadata.pixelCount.toLocaleString()} px
              {hoverPreview.hitLimit && ' (preview)'}
            </span>
          </div>
        )}

        {activeSelection && (
          <div className="flex items-center gap-1.5 text-primary">
            <Target className="w-3.5 h-3.5" />
            <span className="font-mono-precision">
              Selected: {activeSelection.metadata.pixelCount.toLocaleString()} px
            </span>
          </div>
        )}
      </div>

      {/* Right: Performance info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="w-3.5 h-3.5" />
          <span className="font-mono-precision">
            {Math.round(transform.zoom * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
