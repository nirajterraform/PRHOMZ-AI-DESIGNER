
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Remodeler } from './components/Remodeler';
import { Assistant } from './components/Assistant';
import { Gallery } from './components/Gallery';
import { AdminDashboard } from './components/AdminDashboard';
import { Auth } from './components/Auth';
import { AppMode, GeneratedImage, UserAccount, ProductItem } from './types';
import { ChevronDown, Search, HelpCircle, Settings, Grid, X, Loader2, ShoppingCart, LogOut } from 'lucide-react';
import { fetchShopifyProducts } from './services/dataService';
import { searchCatalog } from './services/geminiService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.REMODEL);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeEditImage, setActiveEditImage] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductItem[] | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('prhomz_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    const storedImages = localStorage.getItem('prhomz_gallery');
    if (storedImages) {
      setGeneratedImages(JSON.parse(storedImages));
    }
  }, []);

  useEffect(() => {
    if (generatedImages.length > 0) {
      localStorage.setItem('prhomz_gallery', JSON.stringify(generatedImages));
    }
  }, [generatedImages]);

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentMode(AppMode.REMODEL);
  };

  const handleLogout = () => {
    localStorage.removeItem('prhomz_user');
    setCurrentUser(null);
    setGeneratedImages([]);
    setIsProfileOpen(false);
  };

  const handleImageGenerated = (image: GeneratedImage) => {
    setGeneratedImages(prev => [...prev, image]);
    
    if (currentUser) {
      const now = Date.now();
      const updatedUser: UserAccount = {
        ...currentUser,
        totalRenders: (currentUser.totalRenders || 0) + 1,
        renderTimestamps: [...(currentUser.renderTimestamps || []), now]
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('prhomz_user', JSON.stringify(updatedUser));
    }
  };

  const handleSaveProductsToImage = (imageUrl: string, products: ProductItem[]) => {
    setGeneratedImages(prev => prev.map(img => 
      img.url === imageUrl ? { ...img, savedProducts: products } : img
    ));
  };

  const handleEditFromGallery = (imageUrl: string) => {
    setActiveEditImage(imageUrl);
    setCurrentMode(AppMode.REMODEL);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchCatalog(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.REMODEL: 
        return <Remodeler 
          onImageGenerated={handleImageGenerated} 
          initialImage={activeEditImage} 
          onClearInitial={() => setActiveEditImage(null)}
          currentUser={currentUser}
          onSaveProducts={handleSaveProductsToImage}
        />;
      case AppMode.ASSISTANT: return <Assistant />;
      case AppMode.GALLERY: 
        return <Gallery 
          images={generatedImages} 
          onEdit={handleEditFromGallery}
        />;
      case AppMode.ADMIN: return <AdminDashboard />;
      default: return <Remodeler onImageGenerated={handleImageGenerated} currentUser={currentUser} onSaveProducts={handleSaveProductsToImage} />;
    }
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-google-bg text-google-dark font-sans flex flex-col md:flex-row">
      <Navigation 
        currentMode={currentMode} 
        onModeChange={(mode) => {
          setCurrentMode(mode);
          if (mode === AppMode.REMODEL) setActiveEditImage(null);
        }}
        isOpen={isNavOpen}
        setIsOpen={setIsNavOpen}
        userRole={currentUser?.role || 'Client'}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 border-b border-google-border bg-google-bg/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center flex-1">
            <div className="md:hidden flex flex-col ml-12">
               <h1 className="text-lg font-serif italic tracking-tighter text-google-dark leading-none">
                 PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI</span>
               </h1>
            </div>

            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl bg-google-surface rounded-2xl px-5 py-2.5 items-center border border-google-border shadow-inner focus-within:border-google-blue/50 transition-all relative">
              <Search size={16} className="text-google-gray mr-4" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PRHOMZ Catalog for furniture..." 
                className="bg-transparent border-none focus:outline-none text-sm w-full text-google-dark placeholder-google-gray font-medium"
              />
              {isSearching && <Loader2 size={16} className="animate-spin text-google-blue absolute right-4" />}
              {!isSearching && searchQuery && (
                <button type="button" onClick={clearSearch} className="text-google-gray hover:text-google-dark absolute right-4">
                  <X size={16} />
                </button>
              )}
            </form>
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
            
            <div className="relative pl-6 border-l border-google-border flex items-center space-x-3 group cursor-pointer" onClick={() => setIsProfileOpen(!isProfileOpen)}>
              <div className="flex flex-col text-right hidden sm:block">
                 <span className="text-[10px] font-bold text-google-dark uppercase tracking-wider">{currentUser?.name || 'Guest User'}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-google-blue text-google-bg flex items-center justify-center text-sm font-black shadow-lg shadow-google-blue/20 transition-transform group-hover:scale-105">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-google-surface border border-google-border rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-google-border mb-1">
                    <p className="text-[10px] font-bold text-google-gray uppercase tracking-widest">{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {searchResults && (
          <div className="fixed inset-0 top-20 z-40 bg-google-bg/95 backdrop-blur-md overflow-y-auto animate-fade">
            <div className="max-w-6xl mx-auto p-8 md:p-12">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl font-bold text-google-dark">Catalog Results</h2>
                  <p className="text-google-gray text-xs font-bold uppercase tracking-widest mt-2">Showing matches for "{searchQuery}"</p>
                </div>
                <button 
                  onClick={clearSearch}
                  className="px-6 py-2.5 rounded-full border border-google-border text-[10px] font-bold uppercase tracking-widest hover:bg-google-surface transition-all flex items-center"
                >
                  <X size={14} className="mr-2" /> Close Results
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {searchResults.map((item) => (
                  <div key={item.id} className="group bg-google-surface rounded-2xl border border-google-border overflow-hidden hover:border-google-blue transition-all shadow-sm flex flex-col">
                    <div className="aspect-square bg-google-bg relative overflow-hidden">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/400x400/1e1e1e/8ab4f8?text=${encodeURIComponent(item.name)}`;
                        }}
                      />
                      <div className="absolute top-4 right-4">
                        <span className="bg-google-blue/90 text-google-bg px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          ${item.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-2 mb-6">
                        <h4 className="font-bold text-google-dark text-lg leading-tight">{item.name}</h4>
                        <p className="text-xs text-google-gray leading-relaxed line-clamp-3">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a 
                          href={item.productUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex-1 bg-google-blue text-google-bg py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center"
                        >
                          <ShoppingCart size={14} className="mr-2" /> View on Store
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {searchResults.length === 0 && (
                <div className="py-20 text-center opacity-40">
                  <Search size={48} className="mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No matching artifacts found in catalog</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-16 custom-scrollbar">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
