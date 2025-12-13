/**
 * V3 Diagnostics Panel
 * Task manager for segment engine performance monitoring
 */

import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Clock, 
  Zap,
  BarChart3,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface PerformanceEntry {
  id: string;
  timestamp: number;
  operation: string;
  duration: number;
  pixels: number;
  details?: Record<string, unknown>;
}

interface ProcessMetrics {
  name: string;
  status: 'idle' | 'running' | 'completed';
  progress: number;
  memory: number;
  cpu: number;
  lastDuration: number;
}

// Global performance log for the segment engine
const performanceLog: PerformanceEntry[] = [];
const MAX_LOG_ENTRIES = 100;

export function logPerformance(
  operation: string, 
  duration: number, 
  pixels: number,
  details?: Record<string, unknown>
) {
  performanceLog.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    operation,
    duration,
    pixels,
    details,
  });
  
  if (performanceLog.length > MAX_LOG_ENTRIES) {
    performanceLog.pop();
  }
}

export function DiagnosticsPanel() {
  const { hoverPreview, activeSelection, project, toolOptions } = useProject();
  const [logs, setLogs] = useState<PerformanceEntry[]>([]);
  const [processes, setProcesses] = useState<ProcessMetrics[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Update logs periodically
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        setLogs([...performanceLog]);
      }, 100);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Compute process metrics
  useEffect(() => {
    const metrics: ProcessMetrics[] = [
      {
        name: 'Hover Preview',
        status: hoverPreview ? 'completed' : 'idle',
        progress: hoverPreview ? 100 : 0,
        memory: hoverPreview ? (hoverPreview.metadata.pixelCount * 4) / 1024 : 0,
        cpu: 0,
        lastDuration: hoverPreview?.metadata.processingTime ?? 0,
      },
      {
        name: 'Active Selection',
        status: activeSelection ? 'completed' : 'idle',
        progress: activeSelection ? 100 : 0,
        memory: activeSelection ? (activeSelection.metadata.pixelCount * 4) / 1024 : 0,
        cpu: 0,
        lastDuration: activeSelection?.metadata.processingTime ?? 0,
      },
      {
        name: 'Layer Compositor',
        status: project.layers.length > 0 ? 'running' : 'idle',
        progress: 100,
        memory: project.layers.reduce((acc, l) => 
          acc + (l.imageData ? l.imageData.width * l.imageData.height * 4 / 1024 : 0), 0
        ),
        cpu: 0,
        lastDuration: 0,
      },
    ];
    
    setProcesses(metrics);
  }, [hoverPreview, activeSelection, project.layers]);

  const clearLogs = () => {
    performanceLog.length = 0;
    setLogs([]);
  };

  const formatBytes = (kb: number) => {
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const avgPreviewTime = logs
    .filter(l => l.operation.includes('preview'))
    .slice(0, 10)
    .reduce((acc, l, _, arr) => acc + l.duration / arr.length, 0);

  const avgSegmentTime = logs
    .filter(l => l.operation.includes('segment') && !l.operation.includes('preview'))
    .slice(0, 10)
    .reduce((acc, l, _, arr) => acc + l.duration / arr.length, 0);

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-panel-header">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Diagnostics</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn(
              "w-3.5 h-3.5",
              autoRefresh && "animate-spin text-primary"
            )} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearLogs}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto panel-scroll p-4 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="w-3 h-3" />
              <span>Avg Preview</span>
            </div>
            <div className="text-lg font-mono-precision text-foreground">
              {formatDuration(avgPreviewTime)}
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Zap className="w-3 h-3" />
              <span>Avg Segment</span>
            </div>
            <div className="text-lg font-mono-precision text-foreground">
              {formatDuration(avgSegmentTime)}
            </div>
          </div>
        </div>

        {/* Settings Quick View */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Current Limits</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preview:</span>
              <span className="font-mono-precision">
                {toolOptions.maxPreviewPixels === 0 ? 'Unlimited' : toolOptions.maxPreviewPixels.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Segment:</span>
              <span className="font-mono-precision">
                {toolOptions.maxSegmentPixels === 0 ? 'Unlimited' : toolOptions.maxSegmentPixels.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tolerance:</span>
              <span className="font-mono-precision">{toolOptions.tolerance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connectivity:</span>
              <span className="font-mono-precision">{toolOptions.connectivity}-way</span>
            </div>
          </div>
        </div>

        {/* Processes */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" />
            Processes
          </h3>
          
          {processes.map((proc) => (
            <div 
              key={proc.name}
              className="p-3 rounded-lg bg-muted/30 border border-border space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{proc.name}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded uppercase font-medium",
                  proc.status === 'running' && 'bg-primary/20 text-primary',
                  proc.status === 'completed' && 'bg-green-500/20 text-green-500',
                  proc.status === 'idle' && 'bg-muted text-muted-foreground'
                )}>
                  {proc.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>{formatBytes(proc.memory)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(proc.lastDuration)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Log */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            Recent Operations ({logs.length})
          </h3>
          
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {logs.slice(0, 20).map((log) => (
              <div 
                key={log.id}
                className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-[10px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    log.duration < 10 && 'bg-green-500',
                    log.duration >= 10 && log.duration < 50 && 'bg-yellow-500',
                    log.duration >= 50 && 'bg-red-500'
                  )} />
                  <span className="truncate text-muted-foreground">
                    {log.operation}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono-precision">
                  <span className="text-muted-foreground/70">
                    {log.pixels.toLocaleString()}px
                  </span>
                  <span className={cn(
                    log.duration < 10 && 'text-green-500',
                    log.duration >= 10 && log.duration < 50 && 'text-yellow-500',
                    log.duration >= 50 && 'text-red-500'
                  )}>
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </div>
            ))}
            
            {logs.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                No operations recorded yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
