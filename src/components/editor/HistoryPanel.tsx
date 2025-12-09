/**
 * V3 History Panel
 * Visual history of all actions with undo/redo navigation
 */

import React from 'react';
import { useHistory } from '@/contexts/HistoryContext';
import { useProject } from '@/contexts/ProjectContext';
import { 
  History, 
  ChevronRight,
  Image,
  Wand2,
  Paintbrush,
  Eraser,
  Trash2,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const actionIcons: Record<string, React.ElementType> = {
  'upload': Image,
  'magic-wand': Wand2,
  'brush': Paintbrush,
  'eraser': Eraser,
  'delete': Trash2,
  'duplicate': Copy,
  'visibility': Eye,
};

function getActionIcon(description: string): React.ElementType {
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('upload') || lowerDesc.includes('load')) return Image;
  if (lowerDesc.includes('magic') || lowerDesc.includes('wand') || lowerDesc.includes('select')) return Wand2;
  if (lowerDesc.includes('brush') || lowerDesc.includes('paint')) return Paintbrush;
  if (lowerDesc.includes('erase')) return Eraser;
  if (lowerDesc.includes('delete')) return Trash2;
  if (lowerDesc.includes('duplicate') || lowerDesc.includes('copy')) return Copy;
  if (lowerDesc.includes('visibility') || lowerDesc.includes('hide') || lowerDesc.includes('show')) return Eye;
  return History;
}

export function HistoryPanel() {
  const { snapshots, currentIndex, goToIndex } = useHistory();
  const { setLayers, setTransform } = useProject();

  const handleGoToSnapshot = (index: number) => {
    const snapshot = goToIndex(index);
    if (snapshot) {
      setLayers(snapshot.projectSnapshot.layers);
      setTransform(snapshot.transform);
      toast.success(`Restored: ${snapshot.description}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-border w-64">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-panel-header">
        <History className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">History</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {snapshots.length} actions
        </span>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No history yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Actions will appear here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {snapshots.map((snapshot, index) => {
              const isCurrent = index === currentIndex;
              const isPast = index < currentIndex;
              const Icon = getActionIcon(snapshot.description);

              return (
                <button
                  key={snapshot.id}
                  onClick={() => handleGoToSnapshot(index)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all',
                    isCurrent && 'bg-primary/10 border border-primary/30',
                    !isCurrent && isPast && 'opacity-60 hover:opacity-100 hover:bg-muted',
                    !isCurrent && !isPast && 'opacity-40 hover:opacity-70 hover:bg-muted'
                  )}
                >
                  {/* Current indicator */}
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full transition-colors',
                    isCurrent ? 'bg-primary' : 'bg-transparent'
                  )} />
                  
                  {/* Icon */}
                  <div className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center',
                    isCurrent ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-medium truncate',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {snapshot.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(snapshot.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                  
                  {/* Index */}
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    #{index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border bg-panel-header">
        <p className="text-[10px] text-muted-foreground text-center">
          <kbd className="px-1 py-0.5 bg-muted rounded">⌘Z</kbd> Undo
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 bg-muted rounded">⌘Y</kbd> Redo
        </p>
      </div>
    </div>
  );
}
