
import React from 'react';
import { MessageSquare, ImageIcon, ShieldCheck, Sparkles, Menu, X, Crown } from 'lucide-react';
import { AppMode } from '../types';

interface NavigationProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userRole: 'Client' | 'Designer' | 'Admin';
}

export const Navigation: React.FC<NavigationProps> = ({ currentMode, onModeChange, isOpen, setIsOpen, userRole }) => {
  const navItems = [
    { mode: AppMode.REMODEL, label: 'Remodel', icon: Sparkles, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.ASSISTANT, label: 'Assistant', icon: MessageSquare, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.GALLERY, label: 'Gallery', icon: ImageIcon, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.PRICING, label: 'Membership', icon: Crown, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.ADMIN, label: 'Admin', icon: ShieldCheck, roles: ['Admin'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      <div className="md:hidden fixed top-3 left-4 z-50">
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="p-2.5 bg-google-surface border border-google-border rounded-xl shadow-lg text-google-dark active:scale-95 transition-transform"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-google-bg border-r border-google-border transition-transform duration-500 ease-in-out md:translate-x-0 md:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* REFINED BRANDING BLOCK */}
          <div className="h-28 flex flex-col justify-center px-8 border-b border-google-border bg-gradient-to-b from-google-surface/20 to-transparent">
            <h1 className="text-2xl font-serif italic tracking-tighter text-google-dark leading-none">
              PRHOMZ <span className="text-google-blue not-italic font-sans font-black ml-0.5">AI</span>
            </h1>
          </div>

          <div className="flex-1 py-8 px-4 space-y-2">
            {visibleItems.map((item) => {
              const isActive = currentMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => {
                    onModeChange(item.mode);
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-4 px-6 py-4 text-sm font-semibold rounded-2xl transition-all duration-300
                    ${isActive 
                      ? 'bg-google-lightBlue text-google-blue shadow-[0_0_15px_rgba(138,180,248,0.05)]' 
                      : 'text-google-gray hover:bg-google-surface/50 hover:text-google-dark'}
                  `}
                >
                  <item.icon size={20} className={`${isActive ? 'text-google-blue' : 'text-google-gray'} transition-colors`} />
                  <span className="tracking-wide text-sm"> {item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-8 border-t border-google-border bg-google-surface/10">
             <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-google-surface border border-google-border flex items-center justify-center shadow-inner">
                   <ShieldCheck size={22} className="text-google-blue" />
                </div>
                <div className="overflow-hidden">
                   <p className="text-sm font-bold text-google-dark truncate">Signature Member</p>
                   <p className="text-xs text-google-gray truncate font-bold uppercase tracking-widest mt-0.5">PRO Verified</p>
                </div>
             </div>
          </div>
        </div>
      </aside>

      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade" onClick={() => setIsOpen(false)} />}
    </>
  );
};
