/**
 * V3 Editor Canvas
 * Main canvas with pan/zoom, magic wand, brush, eraser
 * Controls: Right-click+drag=pan, Right-click+scroll=zoom, Scroll=tolerance
 * Wand clicks:
 *   - Left click: new segment -> new layer
 *   - Shift+click: add to pending segments (merged into 1 layer on release)
 *   - Alt+click: add as cutout modifier to clicked layer (non-destructive transparency)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { coordinateSystem } from '@/lib/canvas/CoordinateSystem';
import { RenderPipeline } from '@/lib/canvas/RenderPipeline';
import { floodFillPreview, floodFill } from '@/lib/canvas/FloodFill';
import { createLayerFromSegment, mergeSegmentations, createSegmentCutoutModifier, compositeLayers } from '@/lib/canvas/LayerUtils';
import { BrushEngine } from '@/lib/canvas/BrushEngine';
import { logPerformance } from './DiagnosticsPanel';
import { CANVAS_CONSTANTS, SegmentPin, SegmentationResult } from '@/lib/canvas/types';
import { toast } from 'sonner';

interface EditorCanvasProps {
  aiPins?: SegmentPin[];
  isPinMode?: boolean;
  onAddPin?: (x: number, y: number) => void;
}

export function EditorCanvas({ aiPins = [], isPinMode = false, onAddPin }: EditorCanvasProps) {
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
    setToolOptions,
    addLayer,
    updateLayer,
    getActiveLayer,
  } = useProject();

  const { pushSnapshot } = useHistory();

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  const [pendingSegments, setPendingSegments] = useState<SegmentationResult[]>([]);

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

  useEffect(() => {
    const baseLayer = project.layers[0];
    if (baseLayer?.imageData && !brushEngineRef.current) {
      brushEngineRef.current = new BrushEngine(
        baseLayer.imageData.width,
        baseLayer.imageData.height
      );
    }
  }, [project.layers]);

  useEffect(() => {
    coordinateSystem.setTransform(transform);
    renderPipelineRef.current?.markDirty();
  }, [transform]);

  useEffect(() => {
    let animationId: number;
    const render = () => {
      renderPipelineRef.current?.render(project.layers, hoverPreview, activeSelection);
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [project.layers, hoverPreview, activeSelection]);

  const getCompositeImageData = useCallback((): ImageData | null => {
    if (project.layers.length === 0) return null;
    const baseLayer = project.layers[0];
    if (!baseLayer?.imageData) return null;
    return compositeLayers(project.layers, baseLayer.imageData.width, baseLayer.imageData.height);
  }, [project.layers]);

  const worldToImage = useCallback((worldX: number, worldY: number, imageData: ImageData) => ({
    x: Math.floor(worldX + imageData.width / 2),
    y: Math.floor(worldY + imageData.height / 2),
  }), []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);

    if (isPanning || (isRightMouseDown && e.buttons === 2)) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setTransform({ panX: transform.panX + deltaX, panY: transform.panY + deltaY });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isPainting && (activeTool === 'brush' || activeTool === 'eraser')) {
      const activeLayer = getActiveLayer();
      if (!activeLayer?.imageData || !brushEngineRef.current) return;
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, activeLayer.imageData);
      brushEngineRef.current.continueStroke(imagePoint, toolOptions, activeTool === 'eraser');
      const newImageData = brushEngineRef.current.applyToLayer(activeLayer.imageData);
      updateLayer(activeLayer.id, { imageData: newImageData });
      return;
    }

    if (activeTool === 'magic-wand' && project.layers.length > 0 && !isRightMouseDown) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);
      if (imagePoint.x < 0 || imagePoint.x >= compositeData.width ||
          imagePoint.y < 0 || imagePoint.y >= compositeData.height) {
        setHoverPreview(null);
        return;
      }

      const startTime = performance.now();
      const maxPreview = toolOptions.maxPreviewPixels === 0 ? undefined : toolOptions.maxPreviewPixels;
      const result = floodFillPreview(compositeData, imagePoint.x, imagePoint.y, toolOptions.tolerance, maxPreview);
      const duration = performance.now() - startTime;
      logPerformance('hover-preview', duration, result.metadata.pixelCount);
      setHoverPreview(result);
    }
  }, [activeTool, isPanning, isPainting, isRightMouseDown, panStart, transform, project.layers, toolOptions, getCompositeImageData, getActiveLayer, worldToImage, setHoverPreview, setCursorPosition, setTransform, updateLayer]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      setIsRightMouseDown(true);
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    if (e.button === 1 || (e.button === 0 && activeTool === 'hand')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // AI Pin mode
    if (e.button === 0 && (activeTool === 'ai-pin' || isPinMode)) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);
      if (imagePoint.x >= 0 && imagePoint.x < compositeData.width &&
          imagePoint.y >= 0 && imagePoint.y < compositeData.height) {
        onAddPin?.(imagePoint.x, imagePoint.y);
      }
      return;
    }

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
      if (!brushEngineRef.current) {
        brushEngineRef.current = new BrushEngine(activeLayer.imageData.width, activeLayer.imageData.height);
      }
      pushSnapshot(activeTool === 'brush' ? 'Brush stroke' : 'Erase', project.layers, project.selectedLayerIds, project.activeLayerId, transform);
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, activeLayer.imageData);
      brushEngineRef.current.startStroke(imagePoint, toolOptions, activeTool === 'eraser');
      setIsPainting(true);
      return;
    }

    if (e.button === 0 && activeTool === 'magic-wand' && project.layers.length > 0) {
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const compositeData = getCompositeImageData();
      if (!compositeData) return;

      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);
      if (imagePoint.x < 0 || imagePoint.x >= compositeData.width ||
          imagePoint.y < 0 || imagePoint.y >= compositeData.height) return;

      const startTime = performance.now();
      const maxSegment = toolOptions.maxSegmentPixels === 0 ? undefined : toolOptions.maxSegmentPixels;
      const result = floodFill(compositeData, imagePoint.x, imagePoint.y, {
        tolerance: toolOptions.tolerance,
        contiguous: toolOptions.contiguous,
        maxPixels: maxSegment,
      });
      const duration = performance.now() - startTime;
      logPerformance('segment-click', duration, result.metadata.pixelCount);

      if (result.pixels.length > 0) {
        if (e.altKey) {
          // Alt+click: Add segment as cutout modifier to active layer
          const activeLayer = getActiveLayer();
          if (!activeLayer) {
            toast.error('Select a layer to apply cutout modifier');
            return;
          }
          pushSnapshot('Add cutout modifier', project.layers, project.selectedLayerIds, project.activeLayerId, transform);
          const modifier = createSegmentCutoutModifier(result, compositeData.width, compositeData.height, 0);
          updateLayer(activeLayer.id, { 
            modifiers: [...activeLayer.modifiers, modifier] 
          });
          setActiveSelection(null);
          toast.success('Added cutout modifier to layer');
        } else if (e.shiftKey) {
          // Shift+click: Add to pending segments for multi-select
          setPendingSegments(prev => [...prev, result]);
          setActiveSelection(result);
          toast.info(`${pendingSegments.length + 1} segments selected (Shift+click more or click without Shift to create layer)`);
        } else if (pendingSegments.length > 0) {
          // Normal click with pending segments: merge all into one layer
          const allSegments = [...pendingSegments, result];
          const merged = mergeSegmentations(allSegments, compositeData.width, compositeData.height);
          pushSnapshot('Create merged segment layer', project.layers, project.selectedLayerIds, project.activeLayerId, transform);
          const newLayer = createLayerFromSegment(`Merged Segment ${project.layers.length + 1}`, compositeData, merged);
          addLayer(newLayer);
          setPendingSegments([]);
          setActiveSelection(null);
          toast.success(`Created layer from ${allSegments.length} segments`);
        } else {
          // Normal click: create new layer from single segment
          pushSnapshot('Create segment layer', project.layers, project.selectedLayerIds, project.activeLayerId, transform);
          const newLayer = createLayerFromSegment(`Segment ${project.layers.length + 1}`, compositeData, result);
          addLayer(newLayer);
          setActiveSelection(null);
          toast.success('Created new layer from segment');
        }
      }
    }
  }, [activeTool, isPinMode, project, toolOptions, transform, getCompositeImageData, getActiveLayer, worldToImage, addLayer, updateLayer, pushSnapshot, setActiveSelection, setIsPainting, onAddPin, pendingSegments]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) setIsRightMouseDown(false);
    setIsPanning(false);
    if (isPainting && brushEngineRef.current) {
      brushEngineRef.current.endStroke();
      brushEngineRef.current.clear();
      setIsPainting(false);
    }
  }, [isPainting, setIsPainting]);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsRightMouseDown(false);
    setCursorPosition(null);
    setHoverPreview(null);
    if (isPainting && brushEngineRef.current) {
      brushEngineRef.current.endStroke();
      brushEngineRef.current.clear();
      setIsPainting(false);
    }
  }, [isPainting, setCursorPosition, setHoverPreview, setIsPainting]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    // Right-click held + scroll = zoom
    if (isRightMouseDown || e.ctrlKey || e.metaKey) {
      const zoomDelta = -e.deltaY * 0.01;
      const newZoom = Math.max(CANVAS_CONSTANTS.MIN_ZOOM, Math.min(CANVAS_CONSTANTS.MAX_ZOOM, transform.zoom * (1 + zoomDelta)));
      coordinateSystem.zoomToPoint(e.clientX, e.clientY, newZoom);
      setTransform(coordinateSystem.getTransform());
    } else if (activeTool === 'magic-wand') {
      // Regular scroll = adjust tolerance for wand
      const delta = e.deltaY > 0 ? -2 : 2;
      const newTolerance = Math.max(0, Math.min(255, toolOptions.tolerance + delta));
      setToolOptions({ tolerance: newTolerance });
    } else {
      // Pan for other tools
      setTransform({ panX: transform.panX - e.deltaX, panY: transform.panY - e.deltaY });
    }
  }, [transform, setTransform, isRightMouseDown, activeTool, toolOptions.tolerance, setToolOptions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        coordinateSystem.reset();
        setTransform(coordinateSystem.getTransform());
      }
      if (e.key === '1' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const baseLayer = project.layers[0];
        if (baseLayer?.imageData) {
          coordinateSystem.fitToViewport(baseLayer.imageData.width, baseLayer.imageData.height);
          setTransform(coordinateSystem.getTransform());
        }
      }
      if (e.key === 'Escape') {
        setActiveSelection(null);
        setHoverPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project.layers, setTransform, setActiveSelection, setHoverPreview]);

  const getCursor = () => {
    if (isPanning || isRightMouseDown) return 'grabbing';
    if (activeTool === 'hand') return 'grab';
    if (activeTool === 'ai-pin' || isPinMode) return 'crosshair';
    if (activeTool === 'magic-wand') return 'crosshair';
    if (activeTool === 'move') return 'move';
    if (activeTool === 'zoom') return 'zoom-in';
    if (activeTool === 'brush' || activeTool === 'eraser') return 'crosshair';
    return 'default';
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-canvas-bg">
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
      <canvas ref={brushCanvasRef} className="absolute inset-0 pointer-events-none" />
      
      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border">
        <span className="font-mono-precision text-xs text-muted-foreground">{Math.round(transform.zoom * 100)}%</span>
      </div>

      {activeTool === 'magic-wand' && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border space-y-1">
          <span className="font-mono-precision text-xs text-muted-foreground block">
            Tolerance: {toolOptions.tolerance} · Scroll to adjust
          </span>
          {pendingSegments.length > 0 && (
            <span className="font-mono-precision text-xs text-primary block">
              {pendingSegments.length} segment{pendingSegments.length > 1 ? 's' : ''} pending (Shift+click to add more)
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70 block">
            Click: new layer · Shift: multi-select · Alt: cutout
          </span>
        </div>
      )}
    </div>
  );
}
