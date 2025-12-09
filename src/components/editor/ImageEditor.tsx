/**
 * V3 Image Editor
 * Main editor layout with history integration
 */

import React, { useEffect } from 'react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { HistoryProvider, useHistory } from '@/contexts/HistoryContext';
import { EditorCanvas } from './EditorCanvas';
import { Toolbar } from './Toolbar';
import { LayersPanel } from './LayersPanel';
import { HistoryPanel } from './HistoryPanel';
import { ToolOptions } from './ToolOptions';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';

function EditorWithHistory() {
  const { project, transform, setLayers, setTransform } = useProject();
  const { undo, redo, canUndo, canRedo } = useHistory();

  // Handle keyboard shortcuts for undo/redo
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, setLayers, setTransform]);

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
          <EditorCanvas />
        </div>

        {/* Right Panel: Layers */}
        <LayersPanel />

        {/* Far Right: History */}
        <HistoryPanel />
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
