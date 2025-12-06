import React from 'react';
import { LayoutDashboard, Wand2, MessageSquare, Image as ImageIcon, Menu, X } from 'lucide-react';
import { AppMode } from '../types';

interface NavigationProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentMode, onModeChange, isOpen, setIsOpen }) => {
  const navItems = [
    { mode: AppMode.GENERATE, label: 'Create Design', icon: Wand2 },
    { mode: AppMode.REMODEL, label: 'Remodel Room', icon: LayoutDashboard },
    { mode: AppMode.ASSISTANT, label: 'AI Architect', icon: MessageSquare },
    { mode: AppMode.GALLERY, label: 'My Gallery', icon: ImageIcon },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-brand-900 rounded-md text-brand-100 shadow-lg border border-brand-700"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-brand-950 border-r border-brand-800 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-8 border-b border-brand-800">
            <h1 className="font-serif text-2xl font-bold tracking-wider text-white">
              PRHOMZ<span className="text-brand-500">.</span>
            </h1>
            <p className="text-xs text-brand-400 mt-1 tracking-widest uppercase">AI Designer</p>
          </div>

          <div className="flex-1 px-4 py-8 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.mode}
                onClick={() => {
                  onModeChange(item.mode);
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${currentMode === item.mode 
                    ? 'bg-brand-800 text-white shadow-md border border-brand-700' 
                    : 'text-brand-400 hover:bg-brand-900 hover:text-brand-200'}
                `}
              >
                <item.icon size={20} />
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-brand-800">
            <div className="bg-gradient-to-br from-brand-900 to-brand-800 rounded-lg p-4 border border-brand-700">
              <p className="text-xs text-brand-300 leading-relaxed">
                "Design is not just what it looks like and feels like. Design is how it works."
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};