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
import { LassoEngine, lassoPathToMask, DEFAULT_LASSO_OPTIONS } from '@/lib/canvas/LassoEngine';
import { logPerformance } from './DiagnosticsPanel';
import { CANVAS_CONSTANTS, SegmentPin, SegmentationResult, LassoOptions, LassoPath, Point, LassoAnchor } from '@/lib/canvas/types';
import { toast } from 'sonner';

interface EditorCanvasProps {
  aiPins?: SegmentPin[];
  isPinMode?: boolean;
  onAddPin?: (x: number, y: number) => void;
  lassoOptions?: LassoOptions;
}

export function EditorCanvas({ aiPins = [], isPinMode = false, onAddPin, lassoOptions }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const brushEngineRef = useRef<BrushEngine | null>(null);
  const lassoEngineRef = useRef<LassoEngine | null>(null);
  
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
  const [lassoState, setLassoState] = useState<{
    isActive: boolean;
    path: LassoPath | null;
    previewPath: Point[];
    anchors: LassoAnchor[];
  }>({ isActive: false, path: null, previewPath: [], anchors: [] });

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

  // Define utility functions first before effects use them
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

  // Initialize lasso engine
  useEffect(() => {
    if (!lassoEngineRef.current) {
      lassoEngineRef.current = new LassoEngine(lassoOptions || DEFAULT_LASSO_OPTIONS);
    }
  }, []);

  // Update lasso options
  useEffect(() => {
    if (lassoEngineRef.current && lassoOptions) {
      lassoEngineRef.current.setOptions(lassoOptions);
    }
  }, [lassoOptions]);

  // Compute edge map when image changes and lasso tool is active
  useEffect(() => {
    if ((activeTool === 'lasso' || activeTool === 'magnetic-lasso') && lassoEngineRef.current) {
      const compositeData = getCompositeImageData();
      if (compositeData) {
        lassoEngineRef.current.computeEdgeMap(compositeData);
      }
    }
  }, [activeTool, project.layers, getCompositeImageData]);

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
      
      // Render lasso path on brush canvas
      renderLassoPath();
      
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [project.layers, hoverPreview, activeSelection, lassoState]);

  // Lasso path rendering
  const renderLassoPath = useCallback(() => {
    const brushCanvas = brushCanvasRef.current;
    if (!brushCanvas) return;
    
    const ctx = brushCanvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    
    if (!lassoState.isActive && lassoState.path === null) return;
    
    const options = lassoOptions || DEFAULT_LASSO_OPTIONS;
    const compositeData = getCompositeImageData();
    if (!compositeData) return;
    
    ctx.save();
    ctx.scale(dpr, dpr);
    
    // Transform to screen coordinates
    const imageToScreen = (point: Point): Point => {
      const worldX = point.x - compositeData.width / 2;
      const worldY = point.y - compositeData.height / 2;
      return coordinateSystem.worldToScreen(worldX, worldY);
    };
    
    // Draw main path
    const currentPath = lassoEngineRef.current?.getState().currentPath;
    if (currentPath && currentPath.points.length > 1) {
      ctx.beginPath();
      const start = imageToScreen(currentPath.points[0]);
      ctx.moveTo(start.x, start.y);
      
      // Draw with elastic gradient if enabled
      if (options.showElasticGradient && options.variation === 'elastic-progressive') {
        for (let i = 1; i < currentPath.points.length; i++) {
          const pt = imageToScreen(currentPath.points[i]);
          // Calculate gradient based on position
          const t = i / currentPath.points.length;
          ctx.strokeStyle = `hsl(${60 + t * 60}, 100%, 50%)`; // Yellow to green
          ctx.lineWidth = 2;
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
        }
      } else {
        for (let i = 1; i < currentPath.points.length; i++) {
          const pt = imageToScreen(currentPath.points[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = options.pathColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    // Draw preview path
    const previewPath = lassoEngineRef.current?.getState().previewPath || [];
    if (previewPath.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      const start = imageToScreen(previewPath[0]);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < previewPath.length; i++) {
        const pt = imageToScreen(previewPath[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = options.pathColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw anchors
    if (currentPath) {
      for (const anchor of currentPath.anchors) {
        const pt = imageToScreen(anchor.point);
        
        // Draw anchor circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, options.nodeSize / 2, 0, Math.PI * 2);
        
        // Color based on strength for elastic mode
        if (options.variation === 'elastic-progressive' && options.showElasticGradient) {
          const hue = 60 + anchor.strength * 60; // Yellow -> Green
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        } else {
          ctx.fillStyle = options.nodeColor;
        }
        ctx.fill();
        
        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Edge quality indicator
        if (options.showEdgeTrailNode && anchor.edgeQuality < 0.5) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, options.nodeSize / 2 + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffa500'; // Orange for poor edge quality
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    
    // Draw lazy cursor (stabilization visualization)
    if (lassoState.isActive && lassoEngineRef.current) {
      const state = lassoEngineRef.current.getState();
      const lazyCursor = state.lazyCursor;
      
      // Outer circle (mouse position)
      const outerScreen = imageToScreen(lazyCursor.outerPosition);
      ctx.beginPath();
      ctx.arc(outerScreen.x, outerScreen.y, lazyCursor.radius * transform.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Inner position (stabilized)
      const innerScreen = imageToScreen(lazyCursor.innerPosition);
      ctx.beginPath();
      ctx.arc(innerScreen.x, innerScreen.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = options.pathColor;
      ctx.fill();
    }
    
    // Draw prediction zone for predictive mode
    if (options.showPredictionZone && options.variation === 'predictive-directional' && lassoState.isActive) {
      const state = lassoEngineRef.current?.getState();
      if (state?.lazyCursor) {
        const pos = imageToScreen(state.lazyCursor.innerPosition);
        const coneAngle = (options.predictionConeAngle * Math.PI) / 180;
        
        // Draw prediction cone (simplified as arc)
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.arc(pos.x, pos.y, 50 * transform.zoom, -coneAngle / 2, coneAngle / 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 165, 0, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }, [lassoState, lassoOptions, transform, getCompositeImageData]);

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

    // Lasso tool mouse move
    if ((activeTool === 'lasso' || activeTool === 'magnetic-lasso') && lassoState.isActive && lassoEngineRef.current) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);
      lassoEngineRef.current.updateLasso(imagePoint);
      
      // Update state for rendering
      const state = lassoEngineRef.current.getState();
      setLassoState({
        isActive: state.isActive,
        path: state.currentPath,
        previewPath: state.previewPath,
        anchors: state.currentPath?.anchors || [],
      });
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
  }, [activeTool, isPanning, isPainting, isRightMouseDown, panStart, transform, project.layers, toolOptions, getCompositeImageData, getActiveLayer, worldToImage, setHoverPreview, setCursorPosition, setTransform, updateLayer, lassoState.isActive]);

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

    // Lasso tools - start or add anchor
    if (e.button === 0 && (activeTool === 'lasso' || activeTool === 'magnetic-lasso') && lassoEngineRef.current) {
      const compositeData = getCompositeImageData();
      if (!compositeData) return;
      const worldPoint = coordinateSystem.screenToWorld(e.clientX, e.clientY);
      const imagePoint = worldToImage(worldPoint.x, worldPoint.y, compositeData);
      
      if (!lassoState.isActive) {
        // Start new lasso
        lassoEngineRef.current.startLasso(imagePoint);
        setLassoState({
          isActive: true,
          path: lassoEngineRef.current.getState().currentPath,
          previewPath: [],
          anchors: [],
        });
        toast.info('Lasso started. Click to add anchors, double-click to complete.');
      } else {
        // Add anchor point
        lassoEngineRef.current.addAnchor(imagePoint);
        const state = lassoEngineRef.current.getState();
        setLassoState(prev => ({
          ...prev,
          path: state.currentPath,
          anchors: state.currentPath?.anchors || [],
        }));
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
    if (activeTool === 'lasso' || activeTool === 'magnetic-lasso') return 'crosshair';
    if (activeTool === 'move') return 'move';
    if (activeTool === 'zoom') return 'zoom-in';
    if (activeTool === 'brush' || activeTool === 'eraser') return 'crosshair';
    return 'default';
  };

  // Handle double-click to complete lasso
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((activeTool === 'lasso' || activeTool === 'magnetic-lasso') && lassoState.isActive && lassoEngineRef.current) {
      const completedPath = lassoEngineRef.current.completeLasso(true);
      if (completedPath && completedPath.isClosed) {
        const compositeData = getCompositeImageData();
        if (compositeData) {
          const mask = lassoPathToMask(completedPath, compositeData.width, compositeData.height);
          toast.success(`Lasso completed with ${completedPath.points.length} points`);
          // TODO: Create layer from mask or set as active selection
        }
      }
      setLassoState({ isActive: false, path: null, previewPath: [], anchors: [] });
    }
  }, [activeTool, lassoState.isActive, getCompositeImageData]);

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
        onDoubleClick={handleDoubleClick}
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

      {(activeTool === 'lasso' || activeTool === 'magnetic-lasso') && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-panel-bg/90 backdrop-blur-sm rounded-md border border-border space-y-1">
          <span className="font-mono-precision text-xs text-muted-foreground block">
            {activeTool === 'magnetic-lasso' ? 'Magnetic Lasso' : 'Freehand Lasso'}
          </span>
          {lassoState.isActive && (
            <span className="font-mono-precision text-xs text-primary block">
              {lassoState.anchors.length} anchor{lassoState.anchors.length !== 1 ? 's' : ''} · Double-click to complete
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70 block">
            Click to add anchors · Esc to cancel
          </span>
        </div>
      )}
    </div>
  );
}
