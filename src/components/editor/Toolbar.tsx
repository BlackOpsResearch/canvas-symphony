/**
 * V3 Editor Toolbar
 * Left-side tool selection panel
 */

import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ToolType } from '@/lib/canvas/types';
import { 
  MousePointer2, 
  Move, 
  Wand2, 
  Paintbrush, 
  Eraser, 
  Type, 
  Square, 
  Hand, 
  ZoomIn,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { loadImageToLayer } from '@/lib/canvas/LayerUtils';
import { toast } from 'sonner';

interface ToolConfig {
  id: ToolType;
  name: string;
  icon: React.ElementType;
  shortcut: string;
  enabled: boolean;
}

const tools: ToolConfig[] = [
  { id: 'select', name: 'Select', icon: MousePointer2, shortcut: 'V', enabled: true },
  { id: 'move', name: 'Move', icon: Move, shortcut: 'M', enabled: true },
  { id: 'magic-wand', name: 'Magic Wand', icon: Wand2, shortcut: 'W', enabled: true },
  { id: 'brush', name: 'Brush', icon: Paintbrush, shortcut: 'B', enabled: false },
  { id: 'eraser', name: 'Eraser', icon: Eraser, shortcut: 'E', enabled: false },
  { id: 'text', name: 'Text', icon: Type, shortcut: 'T', enabled: false },
  { id: 'shape', name: 'Shape', icon: Square, shortcut: 'U', enabled: false },
  { id: 'hand', name: 'Hand', icon: Hand, shortcut: 'H', enabled: true },
  { id: 'zoom', name: 'Zoom', icon: ZoomIn, shortcut: 'Z', enabled: true },
];

export function Toolbar() {
  const { activeTool, setActiveTool, addLayer, project } = useProject();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const layer = await loadImageToLayer(file);
      addLayer(layer);
      toast.success(`Loaded "${layer.name}"`);
    } catch (error) {
      toast.error('Failed to load image');
      console.error(error);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const tool = tools.find(t => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool && tool.enabled) {
        setActiveTool(tool.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool]);

  return (
    <div className="flex flex-col items-center gap-1 p-2 bg-panel-bg border-r border-border h-full">
      {/* Upload button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200',
              'bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105',
              'border border-primary/30'
            )}
          >
            <Upload className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Upload Image</p>
        </TooltipContent>
      </Tooltip>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="w-6 h-px bg-border my-2" />

      {/* Tool buttons */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        const isDisabled = !tool.enabled;

        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => tool.enabled && setActiveTool(tool.id)}
                disabled={isDisabled}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200',
                  isActive && 'bg-primary text-primary-foreground shadow-lg glow-primary',
                  !isActive && !isDisabled && 'text-muted-foreground hover:text-foreground hover:bg-tool-hover',
                  isDisabled && 'text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                <Icon className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              <span>{tool.name}</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
                {tool.shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Layer count indicator */}
      {project.layers.length > 0 && (
        <div className="px-2 py-1 text-xs font-mono-precision text-muted-foreground">
          {project.layers.length}L
        </div>
      )}
    </div>
  );
}
