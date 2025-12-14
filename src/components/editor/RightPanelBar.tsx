/**
 * V3 Right Panel Bar
 * Vertical icon button bar for accessing drawer panels
 */

import React from 'react';
import {
  Layers,
  History,
  Wand2,
  Settings,
  Activity,
  Scan,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type PanelType = 'layers' | 'history' | 'wand-settings' | 'tool-settings' | 'color' | 'settings' | 'diagnostics' | 'filters' | 'ai-pin';

interface PanelConfig {
  id: PanelType;
  name: string;
  icon: React.ElementType;
  shortcut?: string;
}

const panels: PanelConfig[] = [
  { id: 'layers', name: 'Layers', icon: Layers, shortcut: 'L' },
  { id: 'history', name: 'History', icon: History, shortcut: 'Y' },
  { id: 'wand-settings', name: 'Magic Wand', icon: Wand2 },
  { id: 'filters', name: 'Image Filters', icon: Scan },
  { id: 'ai-pin', name: 'AI Segmentation', icon: Sparkles },
  { id: 'diagnostics', name: 'Diagnostics', icon: Activity },
];

interface RightPanelBarProps {
  activePanel: PanelType | null;
  onPanelChange: (panel: PanelType | null) => void;
}

export function RightPanelBar({ activePanel, onPanelChange }: RightPanelBarProps) {
  const handleClick = (panelId: PanelType) => {
    if (activePanel === panelId) {
      onPanelChange(null);
    } else {
      onPanelChange(panelId);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 p-2 bg-panel-bg border-l border-border h-full">
      {panels.map((panel) => {
        const Icon = panel.icon;
        const isActive = activePanel === panel.id;

        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleClick(panel.id)}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200',
                  isActive && 'bg-primary text-primary-foreground shadow-lg',
                  !isActive && 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="flex items-center gap-2">
              <span>{panel.name}</span>
              {panel.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
                  {panel.shortcut}
                </kbd>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
