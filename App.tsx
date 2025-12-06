import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { Generator } from './components/Generator';
import { Remodeler } from './components/Remodeler';
import { Assistant } from './components/Assistant';
import { Gallery } from './components/Gallery';
import { AppMode, GeneratedImage } from './types';

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
    <div className="min-h-screen bg-brand-950 text-white font-sans selection:bg-brand-500 selection:text-white">
      <Navigation 
        currentMode={currentMode} 
        onModeChange={setCurrentMode}
        isOpen={isNavOpen}
        setIsOpen={setIsNavOpen}
      />

      <main className="md:pl-64 min-h-screen transition-all duration-300">
        {/* Top bar for mobile context or extra tools */}
        <header className="h-16 border-b border-brand-800 bg-brand-950/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6 md:px-8">
          <div className="md:hidden" /> {/* Spacer for menu button */}
          <div className="ml-auto flex items-center space-x-4 text-sm text-brand-400">
            <span className="hidden md:inline">v1.0.0 Beta</span>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="font-medium text-brand-200">System Online</span>
          </div>
        </header>

        <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;