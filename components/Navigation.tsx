
import React from 'react';
import { MessageSquare, ImageIcon, ShieldCheck, Sparkles, Crown } from 'lucide-react';
import { AppMode } from '../types';

interface NavigationProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  userRole: 'Client' | 'Designer' | 'Admin';
}

/**
 * Top navigation menu. Previously a fixed 288px left rail; now a horizontal
 * segmented pill that lives inside the app header (brand on the left, avatar on
 * the right, this menu centered). On small screens the row scrolls horizontally
 * instead of collapsing behind a hamburger — all destinations stay visible.
 */
export const Navigation: React.FC<NavigationProps> = ({ currentMode, onModeChange, userRole }) => {
  const navItems = [
    { mode: AppMode.REMODEL, label: 'Remodel', icon: Sparkles, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.ASSISTANT, label: 'Assistant', icon: MessageSquare, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.GALLERY, label: 'Gallery', icon: ImageIcon, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.PRICING, label: 'Membership', icon: Crown, roles: ['Client', 'Designer', 'Admin'] },
    { mode: AppMode.ADMIN, label: 'Admin', icon: ShieldCheck, roles: ['Admin'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <nav className="flex items-center gap-1 bg-google-surface/50 border border-google-border rounded-2xl p-1 overflow-x-auto no-scrollbar">
      {visibleItems.map((item) => {
        const isActive = currentMode === item.mode;
        return (
          <button
            key={item.mode}
            onClick={() => onModeChange(item.mode)}
            className={`
              flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300
              ${isActive
                ? 'bg-google-lightBlue text-google-blue shadow-[0_0_15px_rgba(138,180,248,0.05)]'
                : 'text-google-gray hover:bg-google-surface hover:text-google-dark'}
            `}
          >
            <item.icon size={17} className={`${isActive ? 'text-google-blue' : 'text-google-gray'} transition-colors`} />
            <span className="tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
