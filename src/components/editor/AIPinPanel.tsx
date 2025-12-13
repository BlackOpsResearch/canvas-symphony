/**
 * V3 AI Pin Segmentation Panel
 * Nano Banana powered object detection and segmentation
 */

import React, { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useHistory } from '@/contexts/HistoryContext';
import { supabase } from '@/integrations/supabase/client';
import { SegmentPin, Color } from '@/lib/canvas/types';
import { createLayerFromImageData } from '@/lib/canvas/LayerUtils';
import { v4 as uuidv4 } from 'uuid';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Pin, 
  Wand2, 
  Play, 
  Trash2, 
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Generate contrasting colors for pins
const PIN_COLORS: Color[] = [
  { r: 255, g: 0, b: 0, a: 1 },      // Red
  { r: 0, g: 255, b: 0, a: 1 },      // Green
  { r: 0, g: 0, b: 255, a: 1 },      // Blue
  { r: 255, g: 255, b: 0, a: 1 },    // Yellow
  { r: 255, g: 0, b: 255, a: 1 },    // Magenta
  { r: 0, g: 255, b: 255, a: 1 },    // Cyan
  { r: 255, g: 128, b: 0, a: 1 },    // Orange
  { r: 128, g: 0, b: 255, a: 1 },    // Purple
  { r: 0, g: 128, b: 255, a: 1 },    // Sky Blue
  { r: 255, g: 0, b: 128, a: 1 },    // Pink
];

interface AIPinPanelProps {
  pins: SegmentPin[];
  onPinsChange: (pins: SegmentPin[]) => void;
  onPinModeChange: (active: boolean) => void;
  isPinMode: boolean;
}

export function AIPinPanel({
  pins,
  onPinsChange,
  onPinModeChange,
  isPinMode,
}: AIPinPanelProps) {
  const { project, transform, addLayer, getActiveLayer } = useProject();
  const { pushSnapshot } = useHistory();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('idle');
  const [autoDetectPrompt, setAutoDetectPrompt] = useState('');
  const [detailLevel, setDetailLevel] = useState<'coarse' | 'medium' | 'fine'>('medium');
  const [dyeOpacity, setDyeOpacity] = useState(75);

  const activeLayer = getActiveLayer();

  const getNextColor = (): Color => {
    return PIN_COLORS[pins.length % PIN_COLORS.length];
  };

  const addPin = (x: number, y: number, label: string) => {
    const newPin: SegmentPin = {
      id: uuidv4(),
      x,
      y,
      label,
      color: getNextColor(),
      status: 'pending',
    };
    onPinsChange([...pins, newPin]);
  };

  const removePin = (id: string) => {
    onPinsChange(pins.filter(p => p.id !== id));
  };

  const updatePinLabel = (id: string, label: string) => {
    onPinsChange(pins.map(p => p.id === id ? { ...p, label } : p));
  };

  const clearPins = () => {
    onPinsChange([]);
  };

  // Run auto-detection with AI
  const runAutoDetection = async () => {
    if (!activeLayer?.imageData) {
      toast.error('Select a layer with image data');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('Analyzing image with AI...');

    try {
      // Convert imageData to base64
      const canvas = document.createElement('canvas');
      canvas.width = activeLayer.imageData.width;
      canvas.height = activeLayer.imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(activeLayer.imageData, 0, 0);
      const base64Image = canvas.toDataURL('image/png');

      // Call edge function for AI detection
      const { data, error } = await supabase.functions.invoke('ai-segment-detect', {
        body: {
          image: base64Image,
          detailLevel,
          customPrompt: autoDetectPrompt,
        },
      });

      if (error) throw error;

      if (data?.objects) {
        const newPins: SegmentPin[] = data.objects.map((obj: any, i: number) => ({
          id: uuidv4(),
          x: obj.x,
          y: obj.y,
          label: obj.label,
          color: PIN_COLORS[i % PIN_COLORS.length],
          status: 'pending' as const,
        }));
        onPinsChange([...pins, ...newPins]);
        toast.success(`Detected ${newPins.length} objects`);
      }
    } catch (error) {
      console.error('AI detection error:', error);
      toast.error('AI detection failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  };

  // Run full segmentation pipeline
  const runSegmentation = async () => {
    if (!activeLayer?.imageData || pins.length === 0) {
      toast.error('Need image and at least one pin');
      return;
    }

    setIsProcessing(true);
    pushSnapshot(
      'AI Segmentation',
      project.layers,
      project.selectedLayerIds,
      project.activeLayerId,
      transform
    );

    try {
      // Step 1: Generate dyed image
      setCurrentStep('Generating colored mask with AI...');
      
      const canvas = document.createElement('canvas');
      canvas.width = activeLayer.imageData.width;
      canvas.height = activeLayer.imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(activeLayer.imageData, 0, 0);
      const base64Image = canvas.toDataURL('image/png');

      const { data: dyeData, error: dyeError } = await supabase.functions.invoke('ai-segment-dye', {
        body: {
          image: base64Image,
          pins: pins.map(p => ({
            x: p.x,
            y: p.y,
            label: p.label,
            color: `rgb(${p.color.r},${p.color.g},${p.color.b})`,
          })),
          opacity: dyeOpacity,
        },
      });

      if (dyeError) throw dyeError;

      if (!dyeData?.dyedImage) {
        throw new Error('No dyed image returned');
      }

      // Step 2: Extract masks from dyed image
      setCurrentStep('Extracting segmentation masks...');
      
      const dyedImg = new Image();
      await new Promise((resolve, reject) => {
        dyedImg.onload = resolve;
        dyedImg.onerror = reject;
        dyedImg.src = dyeData.dyedImage;
      });

      const dyedCanvas = document.createElement('canvas');
      dyedCanvas.width = dyedImg.width;
      dyedCanvas.height = dyedImg.height;
      const dyedCtx = dyedCanvas.getContext('2d')!;
      dyedCtx.drawImage(dyedImg, 0, 0);
      const dyedImageData = dyedCtx.getImageData(0, 0, dyedCanvas.width, dyedCanvas.height);

      // Step 3: Create layers for each pin
      setCurrentStep('Creating segment layers...');
      
      for (const pin of pins) {
        // Extract pixels matching pin color
        const mask = new ImageData(dyedImageData.width, dyedImageData.height);
        const targetR = pin.color.r;
        const targetG = pin.color.g;
        const targetB = pin.color.b;
        const tolerance = 30;

        let pixelCount = 0;
        for (let i = 0; i < dyedImageData.data.length; i += 4) {
          const r = dyedImageData.data[i];
          const g = dyedImageData.data[i + 1];
          const b = dyedImageData.data[i + 2];

          const dist = Math.sqrt(
            (r - targetR) ** 2 + 
            (g - targetG) ** 2 + 
            (b - targetB) ** 2
          );

          if (dist < tolerance) {
            // Apply to original image
            mask.data[i] = activeLayer.imageData.data[i];
            mask.data[i + 1] = activeLayer.imageData.data[i + 1];
            mask.data[i + 2] = activeLayer.imageData.data[i + 2];
            mask.data[i + 3] = activeLayer.imageData.data[i + 3];
            pixelCount++;
          }
        }

        if (pixelCount > 100) {
          const newLayer = createLayerFromImageData(
            `AI: ${pin.label}`,
            mask
          );
          addLayer(newLayer);
        }
      }

      // Update pin statuses
      onPinsChange(pins.map(p => ({ ...p, status: 'completed' as const })));
      toast.success('Segmentation complete!');
    } catch (error) {
      console.error('Segmentation error:', error);
      toast.error('Segmentation failed. Please try again.');
      onPinsChange(pins.map(p => ({ ...p, status: 'error' as const })));
    } finally {
      setIsProcessing(false);
      setCurrentStep('idle');
    }
  };

  const colorToHex = (c: Color) => 
    `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">AI Pin Segmentation</span>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Pin Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
          <div>
            <Label className="text-xs font-medium">Pin Placement Mode</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Click on image to place pins
            </p>
          </div>
          <Switch
            checked={isPinMode}
            onCheckedChange={onPinModeChange}
          />
        </div>

        {/* Auto-Detection */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Auto-Detect Objects
          </h3>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Detail Level</Label>
            <div className="flex gap-1">
              {(['coarse', 'medium', 'fine'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDetailLevel(level)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded transition-colors capitalize',
                    detailLevel === level
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Coarse: Major objects. Fine: Individual elements.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custom Prompt (optional)</Label>
            <Textarea
              value={autoDetectPrompt}
              onChange={(e) => setAutoDetectPrompt(e.target.value)}
              placeholder="e.g., 'focus on faces and hands' or 'detect all text'"
              className="h-16 text-xs resize-none"
            />
          </div>

          <Button
            onClick={runAutoDetection}
            disabled={!activeLayer?.imageData || isProcessing}
            className="w-full h-8 text-xs"
            variant="secondary"
          >
            {isProcessing && currentStep.includes('Analyzing') ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Detect Objects
          </Button>
        </div>

        {/* Pins List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pins ({pins.length})
            </h3>
            {pins.length > 0 && (
              <button
                onClick={clearPins}
                className="text-xs text-destructive hover:text-destructive/80"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pins.map((pin, i) => (
              <div
                key={pin.id}
                className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border"
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                  style={{ backgroundColor: colorToHex(pin.color) }}
                />
                <Input
                  value={pin.label}
                  onChange={(e) => updatePinLabel(pin.id, e.target.value)}
                  className="h-6 text-xs flex-1"
                  placeholder="Label..."
                />
                <span className={cn(
                  'text-[10px]',
                  pin.status === 'completed' && 'text-green-500',
                  pin.status === 'error' && 'text-red-500',
                  pin.status === 'processing' && 'text-primary',
                )}>
                  {pin.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                  {pin.status === 'error' && <AlertCircle className="w-3 h-3" />}
                  {pin.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                </span>
                <button
                  onClick={() => removePin(pin.id)}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {pins.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                {isPinMode 
                  ? 'Click on the image to place pins'
                  : 'Enable pin mode or use auto-detect'}
              </div>
            )}
          </div>
        </div>

        {/* Segmentation Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Segmentation Settings
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Dye Opacity</Label>
              <span className="text-xs font-mono-precision text-muted-foreground">
                {dyeOpacity}%
              </span>
            </div>
            <Slider
              value={[dyeOpacity]}
              min={50}
              max={100}
              step={5}
              onValueChange={(v) => setDyeOpacity(v[0])}
            />
          </div>
        </div>

        {/* Run Segmentation */}
        <Button
          onClick={runSegmentation}
          disabled={pins.length === 0 || !activeLayer?.imageData || isProcessing}
          className="w-full h-10 text-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {currentStep}
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Segmentation ({pins.length} pins)
            </>
          )}
        </Button>

        {/* Info */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-[10px] text-muted-foreground">
            <strong>Workflow:</strong><br />
            1. Place pins on objects to segment<br />
            2. Label each pin (e.g., "face", "hand")<br />
            3. AI generates colored mask<br />
            4. Masks extracted to layers
          </p>
        </div>
      </div>
    </div>
  );
}
