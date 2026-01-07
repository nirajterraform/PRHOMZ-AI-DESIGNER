
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Remodeler } from './components/Remodeler';
import { Assistant } from './components/Assistant';
import { Gallery } from './components/Gallery';
import { AdminDashboard } from './components/AdminDashboard';
import { AppMode, GeneratedImage, UserAccount } from './types';
import { ChevronDown, Search, HelpCircle, Settings, Grid } from 'lucide-react';
import { fetchUserDirectory } from './services/dataService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.REMODEL);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    const initUser = async () => {
      const users = await fetchUserDirectory();
      setCurrentUser(users[0]);
    };
    initUser();
  }, []);

  const handleImageGenerated = (image: GeneratedImage) => {
    setGeneratedImages(prev => [...prev, image]);
  };

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.REMODEL: return <Remodeler onImageGenerated={handleImageGenerated} />;
      case AppMode.ASSISTANT: return <Assistant />;
      case AppMode.GALLERY: return <Gallery images={generatedImages} />;
      case AppMode.ADMIN: return <AdminDashboard />;
      default: return <Remodeler onImageGenerated={handleImageGenerated} />;
    }
  };

  return (
    <div className="min-h-screen bg-google-bg text-google-dark font-sans flex flex-col md:flex-row">
      <Navigation 
        currentMode={currentMode} 
        onModeChange={setCurrentMode}
        isOpen={isNavOpen}
        setIsOpen={setIsNavOpen}
        userRole={currentUser?.role || 'Client'}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 border-b border-google-border bg-google-bg/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center flex-1">
            {/* MOBILE BRANDING - Refined to just PRHOMZ AI */}
            <div className="md:hidden flex flex-col ml-12">
               <h1 className="text-lg font-serif italic tracking-tighter text-google-dark leading-none">
                 PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI</span>
               </h1>
            </div>

            <div className="hidden md:flex flex-1 max-w-xl bg-google-surface rounded-2xl px-5 py-2.5 items-center border border-google-border shadow-inner focus-within:border-google-blue/50 transition-all">
              <Search size={16} className="text-google-gray mr-4" />
              <input 
                type="text" 
                placeholder="Search Atelier designs & furniture" 
                className="bg-transparent border-none focus:outline-none text-sm w-full text-google-dark placeholder-google-gray font-medium"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-4">
            <div className="hidden lg:flex items-center space-x-1 mr-4">
               <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                 <HelpCircle size={18} />
               </button>
               <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                 <Settings size={18} />
               </button>
               <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                 <Grid size={18} />
               </button>
            </div>
            
            <div className="pl-6 border-l border-google-border flex items-center space-x-3 group cursor-pointer">
              <div className="flex flex-col text-right hidden sm:block">
                 <span className="text-[10px] font-bold text-google-dark uppercase tracking-wider">{currentUser?.name || 'Guest User'}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-google-blue text-google-bg flex items-center justify-center text-sm font-black shadow-lg shadow-google-blue/20 transition-transform group-hover:scale-105">
                {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-16 custom-scrollbar">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
