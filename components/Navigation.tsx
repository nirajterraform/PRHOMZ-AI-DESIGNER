
import React from 'react';
import { LayoutDashboard, Wand2, MessageSquare, Image as ImageIcon, Menu, X, Diamond, ArrowRight } from 'lucide-react';
import { AppMode } from '../types';

interface NavigationProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentMode, onModeChange, isOpen, setIsOpen }) => {
  const navItems = [
    { mode: AppMode.GENERATE, label: 'Design Space', icon: Wand2 },
    { mode: AppMode.REMODEL, label: 'Decor Remodel', icon: LayoutDashboard },
    { mode: AppMode.ASSISTANT, label: 'Concierge AI', icon: MessageSquare },
    { mode: AppMode.GALLERY, label: 'Private Gallery', icon: ImageIcon },
  ];

  return (
    <>
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-brand-900/90 backdrop-blur-xl rounded-full text-brand-100 shadow-2xl border border-gold-500/20"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <nav className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-brand-950/80 backdrop-blur-3xl border-r border-gold-500/10 transform transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-10 pt-12 pb-16">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gold-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(197,160,89,0.3)]">
                  <Diamond size={20} className="text-white fill-white/20" />
                </div>
                <h1 className="font-serif text-3xl font-black tracking-tight text-white italic">
                  PRHOMZ
                </h1>
              </div>
              <div className="space-y-1">
                <p className="font-nav text-gold-500 opacity-90">Design</p>
                <p className="font-nav text-brand-400">Decor</p>
                <p className="font-nav text-brand-500 opacity-60">Delivered</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 space-y-2">
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
                    w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all duration-500 relative group
                    ${isActive 
                      ? 'bg-gold-500/10 text-white shadow-inner border border-gold-500/20' 
                      : 'text-brand-500 hover:text-gold-300 hover:bg-white/5'}
                  `}
                >
                  <div className={`
                    p-2 rounded-xl transition-colors
                    ${isActive ? 'bg-gold-500 text-white shadow-lg' : 'bg-brand-900/50 group-hover:bg-gold-500/20'}
                  `}>
                    <item.icon size={18} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <ArrowRight size={14} className="ml-auto text-gold-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-8">
            <div className="glass-card rounded-[2rem] p-6 border border-gold-500/20 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-gold-500/10 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-1000"></div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold-500 mb-2">Membership</p>
              <p className="text-xs text-brand-200 font-serif leading-relaxed italic">
                Experience the pinnacle of AI-driven interior curation.
              </p>
              <div className="mt-4 flex items-center space-x-2 text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">
                <div className="h-px flex-1 bg-white/10"></div>
                <span>Elite Access</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/95 z-30 md:hidden backdrop-blur-md transition-opacity duration-700"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
