/**
 * V3 Image Editor
 * Main editor layout with drawer-based right panel
 */

import React, { useState, useEffect } from 'react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { HistoryProvider, useHistory } from '@/contexts/HistoryContext';
import { EditorCanvas } from './EditorCanvas';
import { Toolbar } from './Toolbar';
import { LayersPanel } from './LayersPanel';
import { HistoryPanel } from './HistoryPanel';
import { ToolOptions } from './ToolOptions';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import { RightPanelBar, PanelType } from './RightPanelBar';
import { WandSettingsPanel } from './WandSettingsPanel';
import { ToolSettingsPanel } from './ToolSettingsPanel';
import { LassoSettingsPanel } from './LassoSettingsPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ImageFiltersPanel } from './ImageFiltersPanel';
import { AIPinPanel } from './AIPinPanel';
import { LassoOptions } from '@/lib/canvas/types';
import { DEFAULT_LASSO_OPTIONS } from '@/lib/canvas/LassoEngine';

function EditorWithHistory() {
  const { project, transform, setLayers, setTransform, activeTool } = useProject();
  const { undo, redo, canUndo, canRedo } = useHistory();
  const [activePanel, setActivePanel] = useState<PanelType | null>('layers');
  const [lassoOptions, setLassoOptions] = useState<LassoOptions>(DEFAULT_LASSO_OPTIONS);
  const [aiPins, setAiPins] = useState<import('@/lib/canvas/types').SegmentPin[]>([]);
  const [isPinMode, setIsPinMode] = useState(false);

  const handleLassoOptionsChange = (options: Partial<LassoOptions>) => {
    setLassoOptions(prev => ({ ...prev, ...options }));
  };

  const handleAddPin = (x: number, y: number) => {
    const pinColors = [
      { r: 255, g: 0, b: 0, a: 1 },
      { r: 0, g: 255, b: 0, a: 1 },
      { r: 0, g: 0, b: 255, a: 1 },
      { r: 255, g: 255, b: 0, a: 1 },
      { r: 255, g: 0, b: 255, a: 1 },
      { r: 0, g: 255, b: 255, a: 1 },
    ];
    const newPin: import('@/lib/canvas/types').SegmentPin = {
      id: crypto.randomUUID(),
      x,
      y,
      label: `Pin ${aiPins.length + 1}`,
      color: pinColors[aiPins.length % pinColors.length],
      status: 'pending',
    };
    setAiPins(prev => [...prev, newPin]);
  };

  // Handle keyboard shortcuts for undo/redo and panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          const snapshot = undo();
          if (snapshot) {
            setLayers(snapshot.projectSnapshot.layers);
            setTransform(snapshot.transform);
          }
        }
      }

      // Redo: Ctrl+Y or Cmd+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) {
          const snapshot = redo();
          if (snapshot) {
            setLayers(snapshot.projectSnapshot.layers);
            setTransform(snapshot.transform);
          }
        }
      }

      // Panel shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'l') {
          setActivePanel(prev => prev === 'layers' ? null : 'layers');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, setLayers, setTransform]);

  // Render the active panel content
  const renderPanel = () => {
    switch (activePanel) {
      case 'layers':
        return <LayersPanel />;
      case 'history':
        return <HistoryPanel />;
      case 'wand-settings':
        return <WandSettingsPanel />;
      case 'tool-settings':
        return <ToolSettingsPanel />;
      case 'lasso-settings':
        return (
          <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
            <LassoSettingsPanel 
              options={lassoOptions} 
              onOptionsChange={handleLassoOptionsChange}
            />
          </div>
        );
      case 'diagnostics':
        return <DiagnosticsPanel />;
      case 'filters':
        return <ImageFiltersPanel />;
      case 'ai-pin':
        return (
          <AIPinPanel 
            pins={aiPins}
            onPinsChange={setAiPins}
            onPinModeChange={setIsPinMode}
            isPinMode={isPinMode}
          />
        );
      case 'color':
        return (
          <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
              <span className="text-sm font-medium">Color</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground">
              Color picker coming soon
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex flex-col h-full bg-panel-bg border-l border-border w-80">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
              <span className="text-sm font-medium">Settings</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground">
              Project settings coming soon
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Top Bar */}
      <TopBar />

      {/* Tool Options Bar */}
      <ToolOptions />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <Toolbar />

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <EditorCanvas 
            lassoOptions={lassoOptions} 
            aiPins={aiPins}
            isPinMode={isPinMode}
            onAddPin={handleAddPin}
          />
        </div>

        {/* Right Panel Content */}
        {activePanel && renderPanel()}

        {/* Right Panel Bar (icons) */}
        <RightPanelBar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

export function ImageEditor() {
  return (
    <ProjectProvider>
      <HistoryProvider>
        <EditorWithHistory />
      </HistoryProvider>
    </ProjectProvider>
  );
}

export default ImageEditor;
