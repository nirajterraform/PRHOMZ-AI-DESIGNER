
import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { Generator } from './components/Generator';
import { Remodeler } from './components/Remodeler';
import { Assistant } from './components/Assistant';
import { Gallery } from './components/Gallery';
import { AppMode, GeneratedImage } from './types';
import { Diamond } from 'lucide-react';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERATE);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const handleImageGenerated = (image: GeneratedImage) => {
    setGeneratedImages(prev => [...prev, image]);
  };

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.GENERATE:
        return <Generator onImageGenerated={handleImageGenerated} />;
      case AppMode.REMODEL:
        return <Remodeler onImageGenerated={handleImageGenerated} />;
      case AppMode.ASSISTANT:
        return <Assistant />;
      case AppMode.GALLERY:
        return <Gallery images={generatedImages} />;
      default:
        return <Generator onImageGenerated={handleImageGenerated} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-white font-sans selection:bg-gold-500 selection:text-white">
      <Navigation 
        currentMode={currentMode} 
        onModeChange={setCurrentMode}
        isOpen={isNavOpen}
        setIsOpen={setIsNavOpen}
      />

      <main className="md:pl-72 min-h-screen transition-all duration-500 ease-in-out">
        <header className="h-20 border-b border-white/5 bg-brand-950/40 backdrop-blur-2xl sticky top-0 z-20 flex items-center justify-between px-8 md:px-12">
          <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center space-x-2">
                <Diamond size={14} className="text-gold-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-500">
                  DECOR • DESIGN • DELIVERED
                </span>
             </div>
          </div>
          
          <div className="flex items-center space-x-6 text-[10px] font-bold uppercase tracking-widest">
            <div className="hidden sm:flex items-center space-x-3 text-brand-500">
              <span className="hover:text-gold-500 cursor-pointer transition-colors">Catalog</span>
              <span className="w-1 h-1 bg-brand-800 rounded-full"></span>
              <span className="hover:text-gold-500 cursor-pointer transition-colors">Concierge</span>
              <span className="w-1 h-1 bg-brand-800 rounded-full"></span>
              <span className="hover:text-gold-500 cursor-pointer transition-colors">Orders</span>
            </div>
            <div className="flex items-center space-x-3 bg-gold-500/10 px-4 py-2 rounded-full border border-gold-500/20">
              <div className="h-2 w-2 rounded-full bg-gold-500 animate-pulse"></div>
              <span className="text-gold-500">PRHOMZ AI ACTIVE</span>
            </div>
          </div>
        </header>

        <div className="p-8 md:p-12 lg:p-16 max-w-[1400px] mx-auto">
          {renderContent()}
        </div>
        
        <footer className="py-12 px-12 border-t border-white/5 text-center">
          <div className="flex flex-col items-center space-y-4 opacity-40 hover:opacity-100 transition-opacity duration-700">
            <h2 className="font-serif text-2xl font-black italic tracking-tighter">PRHOMZ</h2>
            <div className="flex items-center space-x-6 text-[9px] font-bold uppercase tracking-[0.4em]">
               <span>Design</span>
               <span className="w-1 h-1 bg-gold-500 rounded-full"></span>
               <span>Decor</span>
               <span className="w-1 h-1 bg-gold-500 rounded-full"></span>
               <span>Delivered</span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-brand-600">© 2025 PRHOMZ AI DESIGNER GROUP. ALL RIGHTS RESERVED.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
