/**
 * V3 Image Filters Panel
 * Edge detection and image processing filters
 */

import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { 
  applyEdgeDetection, 
  applyImageFilter 
} from '@/lib/canvas/ImageProcessing';
import { createLayerFromImageData } from '@/lib/canvas/LayerUtils';
import { 
  EdgeDetectionAlgorithm, 
  ImageFilterType,
  EDGE_ALGORITHMS,
  IMAGE_FILTERS,
} from '@/lib/canvas/types';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Scan, 
  Layers, 
  Eye, 
  Plus,
  Wand2,
  Palette,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ImageFiltersPanel() {
  const { project, transform, addLayer, getActiveLayer } = useProject();
  const { pushSnapshot } = useHistory();

  // Edge detection state
  const [edgeAlgorithm, setEdgeAlgorithm] = useState<EdgeDetectionAlgorithm>('sobel');
  const [edgeThreshold, setEdgeThreshold] = useState(30);
  const [edgeKernelSize, setEdgeKernelSize] = useState<3 | 5>(3);
  const [edgeLowThreshold, setEdgeLowThreshold] = useState(50);
  const [edgeHighThreshold, setEdgeHighThreshold] = useState(150);
  const [edgeAsOverlay, setEdgeAsOverlay] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<ImageFilterType>('grayscale');
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [filterThreshold, setFilterThreshold] = useState(128);
  const [filterLevels, setFilterLevels] = useState(4);

  const activeLayer = getActiveLayer();

  const applyEdgeToLayer = () => {
    if (!activeLayer?.imageData) {
      toast.error('Select a layer with image data');
      return;
    }

    pushSnapshot(
      `Edge detection: ${edgeAlgorithm}`,
      project.layers,
      project.selectedLayerIds,
      project.activeLayerId,
      transform
    );

    const result = applyEdgeDetection(activeLayer.imageData, {
      algorithm: edgeAlgorithm,
      threshold: edgeThreshold,
      kernelSize: edgeKernelSize,
      lowThreshold: edgeLowThreshold,
      highThreshold: edgeHighThreshold,
    });

    const newLayer = createLayerFromImageData(
      `${edgeAlgorithm.charAt(0).toUpperCase() + edgeAlgorithm.slice(1)} Edge`,
      result
    );
    newLayer.type = 'edge-map';
    
    if (edgeAsOverlay) {
      newLayer.blendMode = 'multiply';
      newLayer.opacity = 0.5;
    }

    addLayer(newLayer);
    toast.success(`Created ${edgeAlgorithm} edge layer`);
  };

  const applyFilterToLayer = () => {
    if (!activeLayer?.imageData) {
      toast.error('Select a layer with image data');
      return;
    }

    pushSnapshot(
      `Filter: ${filterType}`,
      project.layers,
      project.selectedLayerIds,
      project.activeLayerId,
      transform
    );

    const result = applyImageFilter(activeLayer.imageData, {
      type: filterType,
      intensity: filterIntensity,
      threshold: filterThreshold,
      levels: filterLevels,
    });

    const newLayer = createLayerFromImageData(
      `${filterType.charAt(0).toUpperCase() + filterType.slice(1).replace('-', ' ')}`,
      result
    );

    addLayer(newLayer);
    toast.success(`Created ${filterType} layer`);
  };

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
        <Scan className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Image Processing</span>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Edge Detection */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5" />
            Edge Detection
          </h3>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Algorithm</Label>
            <Select
              value={edgeAlgorithm}
              onValueChange={(v) => setEdgeAlgorithm(v as EdgeDetectionAlgorithm)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_ALGORITHMS.map((alg) => (
                  <SelectItem key={alg.value} value={alg.value} className="text-xs">
                    {alg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Threshold</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {edgeThreshold}
              </span>
            </div>
            <Slider
              value={[edgeThreshold]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => setEdgeThreshold(v[0])}
            />
          </div>

          {edgeAlgorithm === 'laplacian' && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Kernel Size</Label>
              <Select
                value={String(edgeKernelSize)}
                onValueChange={(v) => setEdgeKernelSize(Number(v) as 3 | 5)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3" className="text-xs">3×3</SelectItem>
                  <SelectItem value="5" className="text-xs">5×5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {edgeAlgorithm === 'canny' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Low Threshold</Label>
                  <span className="text-xs font-mono-precision text-muted-foreground">
                    {edgeLowThreshold}
                  </span>
                </div>
                <Slider
                  value={[edgeLowThreshold]}
                  min={0}
                  max={255}
                  step={1}
                  onValueChange={(v) => setEdgeLowThreshold(v[0])}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">High Threshold</Label>
                  <span className="text-xs font-mono-precision text-muted-foreground">
                    {edgeHighThreshold}
                  </span>
                </div>
                <Slider
                  value={[edgeHighThreshold]}
                  min={0}
                  max={255}
                  step={1}
                  onValueChange={(v) => setEdgeHighThreshold(v[0])}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">As Overlay</Label>
              <p className="text-[10px] text-muted-foreground/70">
                Add as blend layer instead of opaque
              </p>
            </div>
            <Switch
              checked={edgeAsOverlay}
              onCheckedChange={setEdgeAsOverlay}
            />
          </div>

          <Button
            onClick={applyEdgeToLayer}
            disabled={!activeLayer?.imageData}
            className="w-full h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Edge Layer
          </Button>
        </div>

        {/* Image Filters */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Palette className="w-3.5 h-3.5" />
            Image Filters
          </h3>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Filter Type</Label>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as ImageFilterType)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value} className="text-xs">
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {['gaussian-blur', 'sharpen'].includes(filterType) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Intensity</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {filterIntensity}%
                </span>
              </div>
              <Slider
                value={[filterIntensity]}
                min={1}
                max={100}
                step={1}
                onValueChange={(v) => setFilterIntensity(v[0])}
              />
            </div>
          )}

          {filterType === 'threshold' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Threshold</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {filterThreshold}
                </span>
              </div>
              <Slider
                value={[filterThreshold]}
                min={0}
                max={255}
                step={1}
                onValueChange={(v) => setFilterThreshold(v[0])}
              />
            </div>
          )}

          {filterType === 'posterize' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Levels</Label>
                <span className="text-xs font-mono-precision text-muted-foreground">
                  {filterLevels}
                </span>
              </div>
              <Slider
                value={[filterLevels]}
                min={2}
                max={16}
                step={1}
                onValueChange={(v) => setFilterLevels(v[0])}
              />
            </div>
          )}

          <Button
            onClick={applyFilterToLayer}
            disabled={!activeLayer?.imageData}
            className="w-full h-8 text-xs"
            variant="secondary"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Filter Layer
          </Button>
        </div>

        {/* Tips */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-[10px] text-muted-foreground">
            <strong>Tip:</strong> Edge detection layers can aid magic wand selection by highlighting boundaries. Use Sobel for general edges, Canny for detailed edges.
          </p>
        </div>
      </div>
    </div>
  );
}
