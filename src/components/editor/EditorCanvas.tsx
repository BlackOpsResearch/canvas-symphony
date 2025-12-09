/**
 * V3 Editor Canvas
 * Main canvas with pan/zoom, magic wand, brush, and eraser
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { CoordinateSystem, coordinateSystem } from '@/lib/canvas/CoordinateSystem';
import { RenderPipeline } from '@/lib/canvas/RenderPipeline';
import { floodFillPreview, floodFill } from '@/lib/canvas/FloodFill';
import { createLayerFromSegment, compositeLayers } from '@/lib/canvas/LayerUtils';
import { BrushEngine } from '@/lib/canvas/BrushEngine';
import { CANVAS_CONSTANTS } from '@/lib/canvas/types';
import { toast } from 'sonner';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const brushEngineRef = useRef<BrushEngine | null>(null);
  
  const {
    project,
    transform,
    activeTool,
    toolOptions,
    hoverPreview,
    activeSelection,
    isPainting,
    setTransform,
    setHoverPreview,
    setActiveSelection,
    setCursorPosition,
    setIsPainting,
    addLayer,
    updateLayer,
    getActiveLayer,
  } = useProject();

  const { pushSnapshot } = useHistory();

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const lastHoverRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const brushCanvas = brushCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !brushCanvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      brushCanvas.width = rect.width * dpr;
      brushCanvas.height = rect.height * dpr;
      brushCanvas.style.width = `${rect.width}px`;
      brushCanvas.style.height = `${rect.height}px`;

      coordinateSystem.setCanvas(canvas);
      renderPipelineRef.current?.markDirty();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    coordinateSystem.setCanvas(canvas);
    renderPipelineRef.current = new RenderPipeline(coordinateSystem);
    renderPipelineRef.current.setCanvas(canvas);

    // Initialize brush engine with project dimensions
    const baseLayer = project.layers[0];
    if (baseLayer?.imageData) {
      brushEngineRef.current = new BrushEngine(
        baseLayer.imageData.width,
        baseLayer.imageData.height
      );
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      renderPipelineRef.current?.dispose();
    };
  }, [project.layers.length]);

  // Update brush engine when project changes
  useEffect(() => {
    const baseLayer = project.layers[0];
    if (baseLayer?.imageData && !brushEngineRef.current) {
      brushEngineRef.current = new BrushEngine(
        baseLayer.imageData.width,
        baseLayer.imageData.height
      );
    }
  }, [project.layers]);

  // Update coordinate system
  useEffect(() => {
    coordinateSystem.setTransform(transform);
    renderPipelineRef.current?.markDirty();
  }, [transform]);

  // Render loop
  useEffect(() => {
    let animationId: number;

    const render = () => {
      renderPipelineRef.current?.render(
        project.layers,
        hoverPreview,
        activeSelection
      );
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [project.layers, hoverPreview, activeSelection]);

  // Get composite image data
  const getCompositeImageData = useCallback((): ImageData | null => {
    if (project.layers.length === 0) return null;
    
    const baseLayer = project.layers[0];
    if (!baseLayer?.imageData) return null;

    return compositeLayers(
      project.layers,
      baseLayer.imageData.width,
      baseLayer.imageData.height
    );
  }, [project.layers]);

  // Convert world point to image coordinates
  const worldToImage = useCallback((worldX: number, worldY: number, imageData: ImageData) => {
    return {
      x: Math.floor(worldX + imageData.width / 2),
      y: Math.floor(worldY + imageData.height / 2),
    };
  }, []);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);

    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      setTransform({
        panX: transform.panX + deltaX,
        panY: transform.panY + deltaY,
      });
      
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Brush/Eraser painting
    if (isPainting && (activeTool === 'brush' || activeTool === 'eraser')) {
      const activeLayer = getActiveLayer();
      if (!activeLayer?.imageData || !brushEngineRef.current) return;

      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, activeLayer.imageData);
      brushEngineRef.current.continueStroke(imagePoint, toolOptions, activeTool === 'eraser');
      
      // Update layer preview
      const newImageData = brushEngineRef.current.applyToLayer(activeLayer.imageData);
      updateLayer(activeLayer.id, { imageData: newImageData });
      return;
    }

    // Magic wand hover preview
    if (activeTool === 'magic-wand' && project.layers.length > 0) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      if (lastHoverRef.current) {
        const dist = Math.hypot(
          worldPoint.x - lastHoverRef.current.x,
          worldPoint.y - lastHoverRef.current.y
        );
        if (dist < 2) return;
      }
      lastHoverRef.current = worldPoint;

      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);

      if (imagePoint.x < 0 || imagePoint.x >= compositeData.width ||
          imagePoint.y < 0 || imagePoint.y >= compositeData.height) {
        setHoverPreview(null);
        return;
      }

      const result = floodFillPreview(
        compositeData,
        imagePoint.x,
        imagePoint.y,
        toolOptions.tolerance,
        CANVAS_CONSTANTS.MAX_PREVIEW_PIXELS
      );

      setHoverPreview(result);
    }
  }, [
    activeTool,
    isPanning,
    isPainting,
    panStart,
    transform,
    project.layers,
    toolOptions,
    getCompositeImageData,
    getActiveLayer,
    worldToImage,
    setHoverPreview,
    setCursorPosition,
    setTransform,
    updateLayer,
  ]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse or space+left = pan
    if (e.button === 1 || (e.button === 0 && activeTool === 'hand')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // Brush/Eraser
    if (e.button === 0 && (activeTool === 'brush' || activeTool === 'eraser')) {
      const activeLayer = getActiveLayer();
      if (!activeLayer?.imageData) {
        toast.error('Select a layer first');
        return;
      }
      if (activeLayer.locked) {
        toast.error('Layer is locked');
        return;
      }

      // Initialize brush engine if needed
      if (!brushEngineRef.current) {
        brushEngineRef.current = new BrushEngine(
          activeLayer.imageData.width,
          activeLayer.imageData.height
        );
      }

      // Save to history before painting
      pushSnapshot(
        activeTool === 'brush' ? 'Brush stroke' : 'Erase',
        project.layers,
        project.selectedLayerIds,
        project.activeLayerId,
        transform
      );

      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, activeLayer.imageData);

      brushEngineRef.current.startStroke(imagePoint, toolOptions, activeTool === 'eraser');
      setIsPainting(true);
      return;
    }

    // Magic wand click
    if (e.button === 0 && activeTool === 'magic-wand' && project.layers.length > 0) {
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);

      if (imagePoint.x < 0 || imagePoint.x >= compositeData.width ||
          imagePoint.y < 0 || imagePoint.y >= compositeData.height) {
        return;
      }

      const result = floodFill(compositeData, imagePoint.x, imagePoint.y, {
        tolerance: toolOptions.tolerance,
        contiguous: toolOptions.contiguous,
      });

      if (result.pixels.length > 0) {
        if (e.altKey) {
          // Alt+click: Extract to new layer
          pushSnapshot(
            'Extract selection',
            project.layers,
            project.selectedLayerIds,
            project.activeLayerId,
            transform
          );
          
          const newLayer = createLayerFromSegment(
            `Segment ${project.layers.length + 1}`,
            compositeData,
            result
          );
          addLayer(newLayer);
          setActiveSelection(null);
          toast.success('Extracted to new layer');
        } else {
          setActiveSelection(result);
        }
      }
    }
  }, [
    activeTool,
    project,
    toolOptions,
    transform,
    getCompositeImageData,
    getActiveLayer,
    worldToImage,
    addLayer,
    pushSnapshot,
    setActiveSelection,
    setIsPainting,
  ]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    
    if (isPainting && brushEngineRef.current) {
      brushEngineRef.current.endStroke();
      brushEngineRef.current.clear();
      setIsPainting(false);
    }
  }, [isPainting, setIsPainting]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setCursorPosition(null);
    setHoverPreview(null);
    
    if (isPainting && brushEngineRef.current) {
      brushEngineRef.current.endStroke();
      brushEngineRef.current.clear();
      setIsPainting(false);
    }
  }, [isPainting, setCursorPosition, setHoverPreview, setIsPainting]);

  // Handle wheel (zoom)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = -e.deltaY * 0.01;
      const newZoom = Math.max(
        CANVAS_CONSTANTS.MIN_ZOOM,
        Math.min(CANVAS_CONSTANTS.MAX_ZOOM, transform.zoom * (1 + zoomDelta))
      );
      
      coordinateSystem.zoomToPoint(e.clientX, e.clientY, newZoom);
      setTransform(coordinateSystem.getTransform());
    } else {
      setTransform({
        panX: transform.panX - e.deltaX,
        panY: transform.panY - e.deltaY,
      });
    }
  }, [transform, setTransform]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Reset view
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        coordinateSystem.reset();
        setTransform(coordinateSystem.getTransform());
      }
      
      // Fit to view
      if (e.key === '1' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const baseLayer = project.layers[0];
        if (baseLayer?.imageData) {
          coordinateSystem.fitToViewport(
            baseLayer.imageData.width,
            baseLayer.imageData.height
          );
          setTransform(coordinateSystem.getTransform());
        }
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        setActiveSelection(null);
        setHoverPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project.layers, setTransform, setActiveSelection, setHoverPreview]);

  // Cursor style
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'hand') return 'grab';
    if (activeTool === 'magic-wand') return 'crosshair';
    if (activeTool === 'move') return 'move';
    if (activeTool === 'zoom') return 'zoom-in';
    if (activeTool === 'brush' || activeTool === 'eraser') return 'crosshair';
    return 'default';
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-canvas-bg"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 no-select"
        style={{ cursor: getCursor() }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Brush preview canvas (overlay) */}
      <canvas
        ref={brushCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      
      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border">
        <span className="font-mono-precision text-xs text-muted-foreground">
          {Math.round(transform.zoom * 100)}%
        </span>
      </div>

      {/* Coordinates display */}
      {project.layers.length > 0 && (
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border">
          <span className="font-mono-precision text-xs text-muted-foreground">
            {project.layers[0]?.imageData?.width} × {project.layers[0]?.imageData?.height}
          </span>
        </div>
      )}

      {/* Brush size indicator */}
      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border">
          <span className="font-mono-precision text-xs text-muted-foreground">
            {toolOptions.size}px · {toolOptions.hardness}% · {toolOptions.opacity}%
          </span>
        </div>
      )}
    </div>
  );
}
