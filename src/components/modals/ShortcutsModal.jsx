import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const ShortcutsModal = () => {
  const { isShortcutsModalOpen, setIsShortcutsModalOpen } = useWorkspace();

  if (!isShortcutsModalOpen) return null;

  const shortcutsList = [
    { key: '⌘ K or /', action: 'Focus search bar across all node titles, tags & citations' },
    { key: 'C or N', action: 'Open quick task creation modal' },
    { key: 'Esc', action: 'Close Side-Peek Details Drawer or any open modal' },
    { key: '1', action: 'Switch to Workspace Overview Hub' },
    { key: '2', action: 'Switch to All Issues & Data Stack View' },
    { key: '3', action: 'Switch to Urgent Action Queue' },
    { key: '4', action: 'Switch to My Assigned Tasks' },
    { key: '?', action: 'Toggle keyboard shortcuts cheatsheet modal' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsShortcutsModalOpen(false)}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#151516] border border-[#262626] rounded-xl shadow-2xl z-10 overflow-hidden text-gray-200 animate-in-fade">
        
        {/* Header */}
        <div className="p-4 border-b border-[#262626] bg-[#111112] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Keyboard Navigation Shortcuts</h3>
          </div>
          <button 
            onClick={() => setIsShortcutsModalOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-2.5 text-xs">
          {shortcutsList.map((sc, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1A1A1E] border border-[#262626]">
              <span className="text-gray-300">{sc.action}</span>
              <kbd className="font-mono bg-[#151516] text-indigo-300 border border-[#5E6AD2]/30 px-2 py-0.5 rounded text-[11px]">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3 bg-[#111112] border-t border-[#262626] text-center text-[11px] text-gray-400">
          Press <kbd className="text-white font-mono">Esc</kbd> at any time to close
        </div>
      </div>
    </div>
  );
};
