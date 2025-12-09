/**
 * V3 Editor Canvas
 * Main canvas component with pan/zoom and tool interactions
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { CoordinateSystem, coordinateSystem } from '@/lib/canvas/CoordinateSystem';
import { RenderPipeline } from '@/lib/canvas/RenderPipeline';
import { floodFillPreview, floodFill } from '@/lib/canvas/FloodFill';
import { createLayerFromSegment, compositeLayers } from '@/lib/canvas/LayerUtils';
import { CANVAS_CONSTANTS } from '@/lib/canvas/types';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  
  const {
    project,
    transform,
    activeTool,
    toolOptions,
    hoverPreview,
    activeSelection,
    setTransform,
    setHoverPreview,
    setActiveSelection,
    setCursorPosition,
    addLayer,
  } = useProject();

  // Pan/zoom state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const lastHoverRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      coordinateSystem.setCanvas(canvas);
      renderPipelineRef.current?.markDirty();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize render pipeline
    coordinateSystem.setCanvas(canvas);
    renderPipelineRef.current = new RenderPipeline(coordinateSystem);
    renderPipelineRef.current.setCanvas(canvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      renderPipelineRef.current?.dispose();
    };
  }, []);

  // Update coordinate system transform
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

  // Get composite image data for tools
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

  // Handle mouse move (hover preview for magic wand)
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

    // Magic wand hover preview
    if (activeTool === 'magic-wand' && project.layers.length > 0) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      // Throttle preview updates
      const now = Date.now();
      if (lastHoverRef.current) {
        const dist = Math.hypot(
          worldPoint.x - lastHoverRef.current.x,
          worldPoint.y - lastHoverRef.current.y
        );
        if (dist < 2) return; // Skip if cursor moved less than 2 pixels
      }
      lastHoverRef.current = worldPoint;

      // Convert world to image coordinates
      const imageX = Math.floor(worldPoint.x + compositeData.width / 2);
      const imageY = Math.floor(worldPoint.y + compositeData.height / 2);

      // Check bounds
      if (imageX < 0 || imageX >= compositeData.width ||
          imageY < 0 || imageY >= compositeData.height) {
        setHoverPreview(null);
        return;
      }

      // Run flood fill preview
      const result = floodFillPreview(
        compositeData,
        imageX,
        imageY,
        toolOptions.tolerance,
        CANVAS_CONSTANTS.MAX_PREVIEW_PIXELS
      );

      setHoverPreview(result);
    }
  }, [
    activeTool,
    isPanning,
    panStart,
    transform,
    project.layers,
    toolOptions.tolerance,
    getCompositeImageData,
    setHoverPreview,
    setCursorPosition,
    setTransform,
  ]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse or space+left click = pan
    if (e.button === 1 || (e.button === 0 && activeTool === 'hand')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // Left click with magic wand = select
    if (e.button === 0 && activeTool === 'magic-wand' && project.layers.length > 0) {
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      const imageX = Math.floor(worldPoint.x + compositeData.width / 2);
      const imageY = Math.floor(worldPoint.y + compositeData.height / 2);

      if (imageX < 0 || imageX >= compositeData.width ||
          imageY < 0 || imageY >= compositeData.height) {
        return;
      }

      // Full flood fill (no pixel limit)
      const result = floodFill(compositeData, imageX, imageY, {
        tolerance: toolOptions.tolerance,
        contiguous: toolOptions.contiguous,
      });

      if (result.pixels.length > 0) {
        // Create new layer from selection
        if (e.shiftKey) {
          // Shift+click: Add to selection
          setActiveSelection(result);
        } else if (e.altKey) {
          // Alt+click: Create layer from selection
          const newLayer = createLayerFromSegment(
            `Segment ${project.layers.length + 1}`,
            compositeData,
            result
          );
          addLayer(newLayer);
          setActiveSelection(null);
        } else {
          // Normal click: Set selection
          setActiveSelection(result);
        }
      }
    }
  }, [
    activeTool,
    project.layers,
    toolOptions,
    getCompositeImageData,
    addLayer,
    setActiveSelection,
  ]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setCursorPosition(null);
    setHoverPreview(null);
  }, [setCursorPosition, setHoverPreview]);

  // Handle wheel (zoom)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom
      const zoomDelta = -e.deltaY * 0.01;
      const newZoom = Math.max(
        CANVAS_CONSTANTS.MIN_ZOOM,
        Math.min(CANVAS_CONSTANTS.MAX_ZOOM, transform.zoom * (1 + zoomDelta))
      );
      
      coordinateSystem.zoomToPoint(e.clientX, e.clientY, newZoom);
      setTransform(coordinateSystem.getTransform());
    } else {
      // Pan
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
    </div>
  );
}
