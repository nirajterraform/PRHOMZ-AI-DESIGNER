
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ShoppingBag, Loader2, RefreshCw, Package, ExternalLink, Zap, Bookmark, Scan, ShieldCheck, BadgeCheck, CheckCircle2, Clock, Search, Globe, ChevronRight } from 'lucide-react';
import { ProductItem, ProductSource } from '../types';
import { generateProductList, swapProduct } from '../services/geminiService';
import { Button } from './Button';
import { SHOPIFY_STORE_URL } from '../services/dataService';

interface ShopLookModalProps {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  budget?: number;
  onSaveProducts?: (products: ProductItem[]) => void;
}

export const ShopLookModal: React.FC<ShopLookModalProps> = ({ image, isOpen, onClose, budget, onSaveProducts }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<ProductSource | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [swappingIds, setSwappingIds] = useState<Set<string>>(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<number>(0);
  
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSource(null);
      setProducts([]);
      setSelections({});
      setSwappingIds(new Set());
      setIsSaved(false);
      setAnalysisTime(null);
      stopTimer();
    }
  }, [isOpen]);

  const startTimer = () => {
    setActiveTimer(0);
    const start = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      setActiveTimer((Date.now() - start) / 1000);
    }, 100);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handleSourceSelection = (selectedSource: ProductSource) => {
    setSource(selectedSource);
    loadProducts(selectedSource);
  };

  const loadProducts = async (selectedSource: ProductSource) => {
    setLoading(true);
    setAnalysisTime(null);
    startTimer();
    
    try {
      const items = await generateProductList(image, selectedSource);
      stopTimer();
      setAnalysisTime(activeTimer);
      setProducts(items);
      const initialSelections: Record<string, string> = {};
      items.forEach(item => { if (item.colors.length > 0) initialSelections[item.id] = item.colors[0]; });
      setSelections(initialSelections);
    } catch (error) {
      stopTimer();
      console.error("Failed to load products", error);
    } finally {
      setLoading(false);
    }
  };

  const budgetCompliantProducts = useMemo(() => {
    if (budget === undefined || budget === 0) return products;
    let runningTotal = 0;
    return products.filter(product => {
      if (runningTotal + product.price <= budget) {
        runningTotal += product.price;
        return true;
      }
      return false;
    });
  }, [products, budget]);

  const handleColorSelect = (productId: string, color: string) => {
    setSelections(prev => ({ ...prev, [productId]: color }));
  };

  const handleSourcingAction = (item: ProductItem) => {
    if (item.productUrl) {
      window.open(item.productUrl, '_blank');
    } else {
      window.open(`${SHOPIFY_STORE_URL}/search?q=${encodeURIComponent(item.name)}`, '_blank');
    }
  };

  const handleSaveSelection = () => {
    if (onSaveProducts) {
      onSaveProducts(budgetCompliantProducts);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleSwap = async (productId: string) => {
    const productToSwap = products.find(p => p.id === productId);
    if (!productToSwap) return;
    setSwappingIds(prev => new Set(prev).add(productId));
    try {
      const newProduct = await swapProduct(image, productToSwap);
      setProducts(prev => prev.map(p => p.id === productId ? newProduct : p));
    } catch (error) { 
      console.error("Swap failed", error); 
    } finally { 
      setSwappingIds(prev => { 
        const next = new Set(prev); 
        next.delete(productId); 
        return next; 
      }); 
    }
  };

  if (!isOpen) return null;

  const currentTotal = budgetCompliantProducts.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-google-bg w-full max-w-6xl h-[90vh] rounded-[2rem] shadow-2xl border border-google-border flex flex-col md:flex-row overflow-hidden animate-fade">
        <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 text-google-gray hover:text-google-dark hover:bg-google-surface rounded-full transition-all">
          <X size={28} />
        </button>

        {!source ? (
          <div className="flex-1 flex flex-col items-center justify-start p-8 md:p-12 text-center space-y-8 md:space-y-10 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-google-blue mb-4">
                <Globe size={32} className="animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Choose where you'd like to shop</h2>
              </div>
              <p className="text-google-gray text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                Select a marketplace, brand, or affiliate partner to begin. Our AI will personalize product discovery and optimize recommendations by prioritizing relevant products from your chosen shopping source, helping you find the best fit to match your Style.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-4xl">
              {[
                { id: 'PRHOMZ', label: 'PRHOMZ', desc: 'Direct partner nodes & artisan collections.', icon: ShieldCheck, accent: 'google-blue' },
                { id: 'Amazon', label: 'Amazon', desc: 'Vast marketplace selection with fast, reliable delivery.', icon: ShoppingBag, accent: 'orange-400' }
              ].map((nexus) => (
                <button
                  key={nexus.id}
                  onClick={() => handleSourceSelection(nexus.id as ProductSource)}
                  className="group relative bg-google-surface border border-google-border rounded-[2rem] p-8 text-left hover:border-google-blue hover:shadow-2xl transition-all duration-500 overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-30 transition-opacity`}>
                    <nexus.icon size={80} />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <div className={`w-12 h-12 bg-${nexus.accent}/10 rounded-xl flex items-center justify-center mb-6 text-${nexus.accent} border border-${nexus.accent}/20`}>
                        <nexus.icon size={24} />
                      </div>
                      <h4 className="text-xl font-bold text-google-dark mb-2">{nexus.label}</h4>
                      {nexus.desc && <p className="text-sm text-google-gray leading-relaxed pr-8">{nexus.desc}</p>}
                    </div>
                    <div className="mt-8 flex items-center text-google-blue text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                      Initialize Link <ChevronRight size={14} className="ml-1" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
          </div>
        ) : (
          <>
            <div className="w-full md:w-96 bg-google-surface relative hidden md:flex flex-col border-r border-google-border p-10 justify-between">
              <div className="space-y-6">
                <div className="flex items-center space-x-2 text-google-blue">
                   <ShieldCheck size={20} />
                   <h3 className="text-2xl font-bold uppercase tracking-tight">PRHOMZ AI DESIGNER</h3>
                </div>
                <div className="p-4 bg-google-bg/50 border border-google-border rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-google-gray">Selected Source of Shopping</span>
                  <div className="flex items-center space-x-2 text-google-blue">
                    <Globe size={14} />
                    <span className="font-bold">{source}</span>
                  </div>
                </div>
                <p className="text-sm text-google-gray leading-relaxed">
                  Every artifact detected is matched against the <b>{source} Catalog</b> to ensure source-approximate pricing.
                </p>
                {budget !== undefined && (
                  <div className="pt-6 border-t border-google-border">
                    <span className="text-xs font-bold text-google-gray uppercase tracking-widest block mb-2">Project Threshold</span>
                    <span className="text-2xl font-bold text-google-blue">${budget.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="rounded-2xl overflow-hidden border border-google-border aspect-square relative group shadow-inner">
                <img src={image} alt="Reference" className="w-full h-full object-cover" />
                {loading && (
                   <div className="absolute inset-0 bg-google-blue/20 backdrop-blur-md flex flex-col items-center justify-center text-google-blue">
                      <Scan size={48} className="animate-pulse mb-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Exhaustive Spatial Scan</span>
                      <div className="mt-3 px-4 py-2 bg-google-bg/80 backdrop-blur-xl rounded-2xl border border-google-blue/20 flex items-center space-x-2">
                         <Clock size={14} />
                         <span className="text-lg font-mono font-black tabular-nums">{activeTimer.toFixed(1)}s</span>
                      </div>
                   </div>
                )}
              </div>

              <div className="flex items-center space-x-3 opacity-60">
                 <Package size={18} />
                 <span className="text-xs font-bold uppercase tracking-[0.2em]">PRHOMZ LIVE FEED</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col h-full bg-google-bg overflow-hidden">
              <div className="p-8 border-b border-google-border flex items-center justify-between bg-google-bg/50">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-google-dark">Spatial Catalog Results ({source})</h3>
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-google-lightBlue text-google-blue border border-google-blue/20">
                      <BadgeCheck size={14} />
                      <span className="text-xs font-bold uppercase tracking-tight">Approx Source Pricing</span>
                    </div>
                    {analysisTime !== null && (
                      <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-google-surface text-google-gray border border-google-border animate-in fade-in slide-in-from-top-2 duration-500">
                        <Zap size={12} className="text-google-blue fill-google-blue" />
                        <span className="text-[10px] font-bold uppercase tracking-tight font-mono">Sync Complete in {analysisTime.toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSource(null)}
                  className="text-xs font-bold text-google-gray hover:text-google-blue transition-colors flex items-center uppercase tracking-widest"
                >
                  <RefreshCw size={14} className="mr-2" /> Change Source
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-8">
                    <div className="relative">
                      <div className="w-16 h-16 border-2 border-google-border border-t-google-blue rounded-full animate-spin"></div>
                      <Search className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-google-blue animate-pulse" />
                    </div>
                    <div className="text-center space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-google-dark uppercase tracking-[0.2em]">Source Matrix Integration</p>
                        <p className="text-xs text-google-gray font-medium">Correlating image artifacts with {source} inventory nodes...</p>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                         <span className="h-1 w-12 bg-google-blue/20 rounded-full overflow-hidden">
                            <div className="h-full bg-google-blue animate-[loading_2s_infinite]"></div>
                         </span>
                         <div className="text-google-blue font-mono font-black text-2xl tabular-nums">{activeTimer.toFixed(1)}s</div>
                         <span className="h-1 w-12 bg-google-blue/20 rounded-full overflow-hidden">
                            <div className="h-full bg-google-blue animate-[loading_2s_infinite_reverse]"></div>
                         </span>
                      </div>
                    </div>
                  </div>
                ) : budgetCompliantProducts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <ShoppingBag size={64} />
                    <p className="text-sm font-bold mt-4 uppercase tracking-widest">No Matches</p>
                    <p className="text-xs mt-2">No items found within your threshold on {source}.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {budgetCompliantProducts.map((item) => (
                      <div key={item.id} className="bg-google-surface p-6 rounded-2xl border border-google-border flex flex-col hover:border-google-blue/40 transition-all group">
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div className="flex justify-between items-start">
                            <div className="max-w-[70%]">
                              <div className="flex items-center space-x-3 mb-2">
                                 {swappingIds.has(item.id) ? (
                                   <Loader2 size={16} className="text-google-blue animate-spin" />
                                 ) : (
                                   <Package size={16} className="text-google-blue opacity-50" />
                                 )}
                                 <h4 className="font-bold text-google-dark text-lg leading-tight truncate">{item.name}</h4>
                                 {item.isSynced && (
                                   <div className="flex items-center space-x-1 text-google-blue bg-google-blue/5 px-2 py-0.5 rounded border border-google-blue/10 flex-shrink-0">
                                     <BadgeCheck size={12} />
                                     <span className="text-[9px] font-black uppercase tracking-widest">Source Accurate</span>
                                   </div>
                                 )}
                              </div>
                              <p className="text-sm text-google-gray mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-bold text-google-blue block whitespace-nowrap">${item.price.toLocaleString()}</span>
                              <span className="text-[9px] font-bold uppercase text-google-gray tracking-tighter">Live Price ({source})</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-6">
                            <div className="flex gap-2">
                              {item.colors.map(color => (
                                <button key={color} onClick={() => handleColorSelect(item.id, color)} className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${selections[item.id] === color ? 'bg-google-blue text-google-bg border-google-blue' : 'bg-google-bg border-google-border text-google-gray hover:text-google-dark'}`}>
                                  {color}
                                </button>
                              ))}
                            </div>
                            <div className="flex space-x-3">
                              <button onClick={() => handleSwap(item.id)} className="p-2 text-google-gray border border-google-border rounded-xl hover:text-google-blue hover:bg-google-bg transition-all" title="Alternative Piece"><RefreshCw size={16} /></button>
                              <button 
                                onClick={() => handleSourcingAction(item)} 
                                className="px-6 py-2.5 bg-google-blue text-google-bg rounded-xl text-xs font-bold flex items-center shadow-xl hover:brightness-110 transition-all hover:scale-105 active:scale-95"
                              >
                                <ExternalLink size={14} className="mr-2" /> 
                                Buy Now
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!loading && budgetCompliantProducts.length > 0 && (
                <div className="p-8 border-t border-google-border bg-google-surface">
                  <div className="flex justify-between items-center max-w-5xl mx-auto">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-bold text-google-gray uppercase tracking-widest">Curation Total</span>
                        <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-400/10 text-green-400 rounded-md border border-green-400/10">
                          <Zap size={10} />
                          <span className="text-[10px] font-black uppercase">Predicted {source} Prices</span>
                        </div>
                      </div>
                      <span className="text-3xl font-black text-google-dark">${currentTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                       <p className="text-xs text-google-gray font-medium max-w-[200px] text-right hidden lg:block leading-tight">
                         AI-matched estimates from current {source} listings. <br/>
                         Confirm final price on the source.
                       </p>
                       <Button 
                        variant={isSaved ? "ghost" : "secondary"} 
                        onClick={handleSaveSelection}
                        className={`rounded-2xl px-8 h-14 text-sm font-bold flex items-center transition-all ${isSaved ? 'text-green-400' : ''}`}
                       >
                         {isSaved ? <CheckCircle2 size={18} className="mr-2" /> : <Bookmark size={18} className="mr-2" />}
                         {isSaved ? "Saved to Gallery" : "Save Selection"}
                       </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
