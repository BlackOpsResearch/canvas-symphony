/**
 * V3 Top Bar
 * File operations, project name, and actions
 */

import React, { useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { loadImageToLayer } from '@/lib/canvas/LayerUtils';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  Undo2,
  Redo2,
  Image,
  Layers,
  Settings,
  Save,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

export function TopBar() {
  const { project, addLayer, setLayers, setTransform, transform } = useProject();
  const { canUndo, canRedo, undo, redo, pushSnapshot } = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Save current state to history
      pushSnapshot(
        'Before image upload',
        project.layers,
        project.selectedLayerIds,
        project.activeLayerId,
        transform
      );

      const layer = await loadImageToLayer(file);
      addLayer(layer);
      toast.success(`Loaded "${layer.name}"`);
    } catch (error) {
      toast.error('Failed to load image');
      console.error(error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle undo
  const handleUndo = () => {
    const snapshot = undo();
    if (snapshot) {
      setLayers(snapshot.projectSnapshot.layers);
      setTransform(snapshot.transform);
      toast.success('Undo: ' + snapshot.description);
    }
  };

  // Handle redo
  const handleRedo = () => {
    const snapshot = redo();
    if (snapshot) {
      setLayers(snapshot.projectSnapshot.layers);
      setTransform(snapshot.transform);
      toast.success('Redo: ' + snapshot.description);
    }
  };

  // Handle export
  const handleExport = () => {
    if (project.layers.length === 0) {
      toast.error('No layers to export');
      return;
    }

    const baseLayer = project.layers[0];
    if (!baseLayer?.imageData) return;

    const canvas = document.createElement('canvas');
    canvas.width = baseLayer.imageData.width;
    canvas.height = baseLayer.imageData.height;
    const ctx = canvas.getContext('2d')!;

    // Composite all visible layers
    for (const layer of project.layers.filter(l => l.visible)) {
      if (!layer.imageData) continue;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      const x = (canvas.width - layer.imageData.width) / 2;
      const y = (canvas.height - layer.imageData.height) / 2;
      ctx.drawImage(tempCanvas, x, y);
      ctx.restore();
    }

    // Download
    const link = document.createElement('a');
    link.download = `${project.name || 'export'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Image exported!');
  };

  return (
    <div className="flex items-center justify-between h-12 px-4 bg-panel-header border-b border-border">
      {/* Left: Logo & Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">V3 Editor</span>
        </div>
        
        <Separator orientation="vertical" className="h-6" />
        
        <span className="text-sm text-muted-foreground">
          {project.name}
        </span>
      </div>

      {/* Center: Main Actions */}
      <div className="flex items-center gap-1">
        {/* File Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md transition-all',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'text-sm font-medium'
              )}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Upload an image file</TooltipContent>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={cn(
                'p-2 rounded-md transition-colors',
                canUndo 
                  ? 'hover:bg-muted text-foreground' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Undo</span>
            <kbd className="ml-2 px-1 py-0.5 text-xs bg-muted rounded">⌘Z</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={cn(
                'p-2 rounded-md transition-colors',
                canRedo 
                  ? 'hover:bg-muted text-foreground' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Redo</span>
            <kbd className="ml-2 px-1 py-0.5 text-xs bg-muted rounded">⌘Y</kbd>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Export */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleExport}
              disabled={project.layers.length === 0}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm',
                project.layers.length > 0
                  ? 'hover:bg-muted text-foreground'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Export as PNG</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: View Options */}
      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground font-mono-precision">
          {project.layers.length > 0 && project.layers[0]?.imageData && (
            <>
              {project.layers[0].imageData.width} × {project.layers[0].imageData.height}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
