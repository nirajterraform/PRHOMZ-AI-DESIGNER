
import React from 'react';
import { LayoutDashboard, Wand2, MessageSquare, Image as ImageIcon, Menu, X, Diamond } from 'lucide-react';
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
          className="p-3 bg-brand-900/80 backdrop-blur-md rounded-xl text-brand-100 shadow-2xl border border-white/10"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-brand-950/40 backdrop-blur-2xl border-r border-white/5 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-10 pb-12">
            <div className="flex items-center space-x-2 mb-2">
              <Diamond className="text-brand-500 w-5 h-5 fill-brand-500" />
              <h1 className="font-serif text-3xl font-bold tracking-tighter text-white">
                PRHOMZ
              </h1>
            </div>
            <div className="h-px w-12 bg-gradient-to-r from-brand-500 to-transparent mb-2"></div>
            <p className="text-[10px] text-brand-400 font-bold tracking-[0.4em] uppercase opacity-60">Architectural Vision</p>
          </div>

          <div className="flex-1 px-6 space-y-1">
            {navItems.map((item) => {
              const isActive = currentMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => {
                    onModeChange(item.mode);
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-4 px-5 py-4 rounded-xl transition-all duration-300 relative group
                    ${isActive 
                      ? 'bg-brand-500/10 text-brand-50 shadow-[0_0_20px_rgba(86,119,114,0.1)] border border-white/5' 
                      : 'text-brand-400/60 hover:text-brand-100 hover:bg-white/5'}
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 w-1 h-6 bg-brand-500 rounded-r-full shadow-[0_0_10px_#567772]" />
                  )}
                  <item.icon size={20} className={isActive ? 'text-brand-400' : 'group-hover:text-brand-300 transition-colors'} />
                  <span className={`text-sm font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <div className="bg-brand-900/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-700"></div>
              <p className="text-xs text-brand-300 leading-relaxed font-serif italic opacity-80">
                "Architecture is the learned game, correct and magnificent, of forms assembled in the light."
              </p>
              <p className="text-[9px] mt-3 text-brand-500 uppercase tracking-widest font-bold">— Le Corbusier</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-md transition-opacity duration-500"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
