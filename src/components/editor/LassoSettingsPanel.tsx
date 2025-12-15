/**
 * V3 Lasso Settings Panel
 * Comprehensive settings for magnetic lasso tool
 */

import React from 'react';
import { LassoOptions, LassoVariation, LassoAnchorMode, EdgeMethod } from '@/lib/canvas/types';
import { DEFAULT_LASSO_OPTIONS } from '@/lib/canvas/LassoEngine';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface LassoSettingsPanelProps {
  options: LassoOptions;
  onOptionsChange: (options: Partial<LassoOptions>) => void;
  metrics?: {
    fps: number;
    pathComputationTime: number;
    totalPathPoints: number;
    anchorCount: number;
    edgeQuality: number;
    cursorSpeed: number;
  };
}

const LASSO_VARIATIONS: { value: LassoVariation; label: string; description: string }[] = [
  { 
    value: 'classic-dijkstra', 
    label: 'Classic (Dijkstra)', 
    description: 'Pure edge-following with manual anchors' 
  },
  { 
    value: 'photoshop-style', 
    label: 'Photoshop Style', 
    description: 'Auto-anchoring based on distance/time' 
  },
  { 
    value: 'elastic-progressive', 
    label: 'Elastic Progressive', 
    description: 'Anchors start weak and strengthen over time' 
  },
  { 
    value: 'predictive-directional', 
    label: 'Predictive', 
    description: 'Movement pattern analysis for direction prediction' 
  },
];

const ANCHOR_MODES: { value: LassoAnchorMode; label: string }[] = [
  { value: 'manual', label: 'Manual Click' },
  { value: 'distance', label: 'Distance Based' },
  { value: 'time', label: 'Time Based' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'elastic', label: 'Elastic' },
  { value: 'edge-quality', label: 'Edge Quality' },
  { value: 'predictive', label: 'Predictive' },
];

const EDGE_METHODS: { value: EdgeMethod; label: string }[] = [
  { value: 'sobel', label: 'Sobel' },
  { value: 'prewitt', label: 'Prewitt' },
  { value: 'scharr', label: 'Scharr' },
  { value: 'roberts', label: 'Roberts' },
  { value: 'laplacian', label: 'Laplacian' },
  { value: 'canny', label: 'Canny' },
];

export function LassoSettingsPanel({ options, onOptionsChange, metrics }: LassoSettingsPanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Variation Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Lasso Variation</Label>
          <Select
            value={options.variation}
            onValueChange={(value: LassoVariation) => onOptionsChange({ variation: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LASSO_VARIATIONS.map(v => (
                <SelectItem key={v.value} value={v.value}>
                  <div className="flex flex-col">
                    <span>{v.label}</span>
                    <span className="text-xs text-muted-foreground">{v.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metrics Display */}
        {metrics && options.showMetricsOverlay && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span>FPS:</span>
              <span className={metrics.fps < 30 ? 'text-destructive' : 'text-primary'}>{metrics.fps}</span>
            </div>
            <div className="flex justify-between">
              <span>Path Time:</span>
              <span>{metrics.pathComputationTime.toFixed(1)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Points:</span>
              <span>{metrics.totalPathPoints}</span>
            </div>
            <div className="flex justify-between">
              <span>Anchors:</span>
              <span>{metrics.anchorCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Edge Quality:</span>
              <span>{(metrics.edgeQuality * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Cursor Speed:</span>
              <span>{metrics.cursorSpeed.toFixed(1)}px/f</span>
            </div>
          </div>
        )}

        <Separator />

        <Tabs defaultValue="cursor" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="edge">Edge</TabsTrigger>
            <TabsTrigger value="anchor">Anchor</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
          </TabsList>

          {/* Cursor Settings */}
          <TabsContent value="cursor" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Cursor Radius</Label>
                <span className="text-xs text-muted-foreground">{options.cursorRadius}px</span>
              </div>
              <Slider
                value={[options.cursorRadius]}
                onValueChange={([v]) => onOptionsChange({ cursorRadius: v })}
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Edge Search Radius</Label>
                <span className="text-xs text-muted-foreground">{options.edgeSearchRadius}px</span>
              </div>
              <Slider
                value={[options.edgeSearchRadius]}
                onValueChange={([v]) => onOptionsChange({ edgeSearchRadius: v })}
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Smoothing Factor</Label>
                <span className="text-xs text-muted-foreground">{options.smoothingFactor.toFixed(2)}</span>
              </div>
              <Slider
                value={[options.smoothingFactor * 100]}
                onValueChange={([v]) => onOptionsChange({ smoothingFactor: v / 100 })}
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Trajectory Lookback</Label>
                <span className="text-xs text-muted-foreground">{options.trajectoryLookback}</span>
              </div>
              <Slider
                value={[options.trajectoryLookback]}
                onValueChange={([v]) => onOptionsChange({ trajectoryLookback: v })}
                min={2}
                max={15}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Cursor Influence</Label>
                <span className="text-xs text-muted-foreground">{options.cursorInfluence}%</span>
              </div>
              <Slider
                value={[options.cursorInfluence]}
                onValueChange={([v]) => onOptionsChange({ cursorInfluence: v })}
                min={0}
                max={100}
                step={5}
              />
            </div>
          </TabsContent>

          {/* Edge Detection Settings */}
          <TabsContent value="edge" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Edge Method</Label>
              <Select
                value={options.edgeMethod}
                onValueChange={(value: EdgeMethod) => onOptionsChange({ edgeMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDGE_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Edge Sensitivity</Label>
                <span className="text-xs text-muted-foreground">{options.edgeSensitivity}</span>
              </div>
              <Slider
                value={[options.edgeSensitivity]}
                onValueChange={([v]) => onOptionsChange({ edgeSensitivity: v })}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Edge Threshold</Label>
                <span className="text-xs text-muted-foreground">{options.edgeThreshold}</span>
              </div>
              <Slider
                value={[options.edgeThreshold]}
                onValueChange={([v]) => onOptionsChange({ edgeThreshold: v })}
                min={0}
                max={255}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Hysteresis Threshold</Label>
                <span className="text-xs text-muted-foreground">{options.hysteresisThreshold}</span>
              </div>
              <Slider
                value={[options.hysteresisThreshold]}
                onValueChange={([v]) => onOptionsChange({ hysteresisThreshold: v })}
                min={0}
                max={255}
                step={1}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Non-Max Suppression</Label>
              <Switch
                checked={options.nonMaxSuppression}
                onCheckedChange={(checked) => onOptionsChange({ nonMaxSuppression: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Gaussian Blur</Label>
              <Switch
                checked={options.gaussianBlur}
                onCheckedChange={(checked) => onOptionsChange({ gaussianBlur: checked })}
              />
            </div>

            {options.gaussianBlur && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Blur Radius</Label>
                  <span className="text-xs text-muted-foreground">{options.gaussianRadius.toFixed(1)}</span>
                </div>
                <Slider
                  value={[options.gaussianRadius * 10]}
                  onValueChange={([v]) => onOptionsChange({ gaussianRadius: v / 10 })}
                  min={5}
                  max={50}
                  step={1}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Adaptive Edge</Label>
              <Switch
                checked={options.adaptiveEdge}
                onCheckedChange={(checked) => onOptionsChange({ adaptiveEdge: checked })}
              />
            </div>
          </TabsContent>

          {/* Anchoring Settings */}
          <TabsContent value="anchor" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Anchor Mode</Label>
              <Select
                value={options.anchorMode}
                onValueChange={(value: LassoAnchorMode) => onOptionsChange({ anchorMode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANCHOR_MODES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Auto-Anchor Distance</Label>
                <span className="text-xs text-muted-foreground">{options.autoAnchorDistance}px</span>
              </div>
              <Slider
                value={[options.autoAnchorDistance]}
                onValueChange={([v]) => onOptionsChange({ autoAnchorDistance: v })}
                min={10}
                max={200}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Auto-Anchor Interval</Label>
                <span className="text-xs text-muted-foreground">{options.autoAnchorTimeInterval}ms</span>
              </div>
              <Slider
                value={[options.autoAnchorTimeInterval]}
                onValueChange={([v]) => onOptionsChange({ autoAnchorTimeInterval: v })}
                min={100}
                max={2000}
                step={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Pathfinding Algorithm</Label>
              <Select
                value={options.pathfindingAlgorithm}
                onValueChange={(value: 'dijkstra' | 'astar') => onOptionsChange({ pathfindingAlgorithm: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dijkstra">Dijkstra</SelectItem>
                  <SelectItem value="astar">A*</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Neighbor Mode</Label>
              <Select
                value={String(options.neighborMode)}
                onValueChange={(value) => onOptionsChange({ neighborMode: parseInt(value) as 4 | 8 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4-Connected</SelectItem>
                  <SelectItem value="8">8-Connected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Direction Continuity</Label>
                <span className="text-xs text-muted-foreground">{options.directionContinuityCost.toFixed(2)}</span>
              </div>
              <Slider
                value={[options.directionContinuityCost * 100]}
                onValueChange={([v]) => onOptionsChange({ directionContinuityCost: v / 100 })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            {options.anchorMode === 'elastic' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Elastic Zone Length</Label>
                    <span className="text-xs text-muted-foreground">{options.elasticZoneLength}px</span>
                  </div>
                  <Slider
                    value={[options.elasticZoneLength]}
                    onValueChange={([v]) => onOptionsChange({ elasticZoneLength: v })}
                    min={20}
                    max={300}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Strength Curve</Label>
                  <Select
                    value={options.elasticStrengthCurve}
                    onValueChange={(value: 'linear' | 'exponential' | 'ease-in-out') => 
                      onOptionsChange({ elasticStrengthCurve: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="exponential">Exponential</SelectItem>
                      <SelectItem value="ease-in-out">Ease In/Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {options.variation === 'predictive-directional' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Prediction Cone Angle</Label>
                    <span className="text-xs text-muted-foreground">{options.predictionConeAngle}°</span>
                  </div>
                  <Slider
                    value={[options.predictionConeAngle]}
                    onValueChange={([v]) => onOptionsChange({ predictionConeAngle: v })}
                    min={15}
                    max={90}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Prediction Weight</Label>
                    <span className="text-xs text-muted-foreground">{(options.predictionConfidenceWeight * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[options.predictionConfidenceWeight * 100]}
                    onValueChange={([v]) => onOptionsChange({ predictionConfidenceWeight: v / 100 })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* Visualization Settings */}
          <TabsContent value="visual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Path Color</Label>
              <Input
                type="color"
                value={options.pathColor}
                onChange={(e) => onOptionsChange({ pathColor: e.target.value })}
                className="h-10 w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Node Color</Label>
              <Input
                type="color"
                value={options.nodeColor}
                onChange={(e) => onOptionsChange({ nodeColor: e.target.value })}
                className="h-10 w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Node Size</Label>
                <span className="text-xs text-muted-foreground">{options.nodeSize}px</span>
              </div>
              <Slider
                value={[options.nodeSize]}
                onValueChange={([v]) => onOptionsChange({ nodeSize: v })}
                min={2}
                max={16}
                step={1}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Show Edge Trail Node</Label>
              <Switch
                checked={options.showEdgeTrailNode}
                onCheckedChange={(checked) => onOptionsChange({ showEdgeTrailNode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Elastic Gradient</Label>
              <Switch
                checked={options.showElasticGradient}
                onCheckedChange={(checked) => onOptionsChange({ showElasticGradient: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Prediction Zone</Label>
              <Switch
                checked={options.showPredictionZone}
                onCheckedChange={(checked) => onOptionsChange({ showPredictionZone: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Metrics Overlay</Label>
              <Switch
                checked={options.showMetricsOverlay}
                onCheckedChange={(checked) => onOptionsChange({ showMetricsOverlay: checked })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Usage Instructions */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Controls:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><kbd className="px-1 bg-muted rounded">Click</kbd> - Place anchor point</li>
            <li><kbd className="px-1 bg-muted rounded">Shift+Click</kbd> - Add to multi-selection</li>
            <li><kbd className="px-1 bg-muted rounded">Double-click</kbd> - Complete selection</li>
            <li><kbd className="px-1 bg-muted rounded">Escape</kbd> - Cancel selection</li>
            <li><kbd className="px-1 bg-muted rounded">Backspace</kbd> - Remove last anchor</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}
