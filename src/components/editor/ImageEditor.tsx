/**
 * V3 Image Editor
 * Main editor layout component
 */

import React from 'react';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { EditorCanvas } from './EditorCanvas';
import { Toolbar } from './Toolbar';
import { LayersPanel } from './LayersPanel';
import { ToolOptions } from './ToolOptions';
import { StatusBar } from './StatusBar';

export function ImageEditor() {
  return (
    <ProjectProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
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

          {/* Right Panel */}
          <LayersPanel />
        </div>

        {/* Status Bar */}
        <StatusBar />
      </div>
    </ProjectProvider>
  );
}

export default ImageEditor;
