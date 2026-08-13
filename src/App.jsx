import React, { useEffect } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewHub } from './components/dashboard/OverviewHub';
import { GanttFullscreenView } from './components/dashboard/GanttFullscreenView';
import { IssuesDataStack } from './components/issues/IssuesDataStack';
import { SettingsView } from './components/settings/SettingsView';
import { SidePeekDrawer } from './components/drawer/SidePeekDrawer';
import { CreateTaskModal } from './components/modals/CreateTaskModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { PinGate } from './components/settings/PinGate';

const AppContent = () => {
  const { 
    currentView, 
    setCurrentView,
    setActiveDomain,
    isDrawerOpen,
    closeItemDetails,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen
  } = useWorkspace();

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing inside an input or textarea
      const targetTag = e.target.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

      // 1. Search focus (Cmd/Ctrl + K or /)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
        return;
      }
      if (!isInput && e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
        return;
      }

      // 2. Quick task creation modal (C or N)
      if (!isInput && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setIsCreateModalOpen(true);
        return;
      }

      // 3. Escape key (Close drawer or modals)
      if (e.key === 'Escape') {
        if (isCreateModalOpen) setIsCreateModalOpen(false);
        if (isShortcutsModalOpen) setIsShortcutsModalOpen(false);
        if (isDrawerOpen) closeItemDetails();
        return;
      }

      // 4. View Switcher Numbers (1, 2, 3, 4, 5, 6)
      if (!isInput && e.key === '1') {
        e.preventDefault();
        setCurrentView('overview');
        setActiveDomain('all');
      }
      if (!isInput && e.key === '2') {
        e.preventDefault();
        setCurrentView('gantt');
      }
      if (!isInput && e.key === '3') {
        e.preventDefault();
        setCurrentView('issues');
        setActiveDomain('all');
      }
      if (!isInput && e.key === '4') {
        e.preventDefault();
        setCurrentView('urgent');
      }
      if (!isInput && e.key === '5') {
        e.preventDefault();
        setCurrentView('my_tasks');
      }
      if (!isInput && e.key === '6') {
        e.preventDefault();
        setCurrentView('settings');
      }

      // 5. Help modal (?)
      if (!isInput && e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, isCreateModalOpen, isShortcutsModalOpen, closeItemDetails, setCurrentView, setActiveDomain, setIsCreateModalOpen, setIsShortcutsModalOpen]);

  return (
    <div className="flex min-h-screen bg-[#0B0B0C] text-gray-100 font-sans antialiased selection:bg-[#5E6AD2]/30 selection:text-indigo-200">
      {/* PIN Auth Gate — renders as fixed overlay when locked */}
      <PinGate />

      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto">
          {currentView === 'overview' ? (
            <OverviewHub />
          ) : currentView === 'gantt' ? (
            <GanttFullscreenView />
          ) : currentView === 'settings' ? (
            <SettingsView />
          ) : (
            <IssuesDataStack />
          )}
        </main>
      </div>

      {/* Side-Peek Details Drawer */}
      <SidePeekDrawer />

      {/* Quick Task Creation Modal */}
      <CreateTaskModal />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <ShortcutsModal />
    </div>
  );
};

export default function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}
