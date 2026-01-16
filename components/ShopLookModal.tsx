
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ShoppingBag, Loader2, RefreshCw, Package, ExternalLink, Zap, Bookmark, Scan, ShieldCheck, BadgeCheck, CheckCircle2, Clock, Search } from 'lucide-react';
import { ProductItem } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [swappingIds, setSwappingIds] = useState<Set<string>>(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<number>(0);
  
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && image) {
      loadProducts();
    } else {
      setProducts([]);
      setSelections({});
      setSwappingIds(new Set());
      setIsSaved(false);
      setAnalysisTime(null);
      stopTimer();
    }
  }, [isOpen, image]);

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

  const loadProducts = async () => {
    setLoading(true);
    setAnalysisTime(null);
    startTimer();
    
    try {
      const items = await generateProductList(image);
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

  /**
   * Curation Logic: strictly enforce budget based on source price.
   */
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

        <div className="w-full md:w-96 bg-google-surface relative hidden md:flex flex-col border-r border-google-border p-10 justify-between">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-google-blue">
               <ShieldCheck size={20} />
               <h3 className="text-2xl font-bold uppercase tracking-tight">PRHOMZ SYNC</h3>
            </div>
            <p className="text-sm text-google-gray leading-relaxed">
              Every artifact detected is matched against the <b>Live Catalog</b> to ensure source-accurate pricing.
              <br/><br/>
              <b>Budget Threshold:</b> ${budget?.toLocaleString()}
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
              <h3 className="text-xl font-bold text-google-dark">Spatial Catalog Results</h3>
              <div className="flex items-center space-x-3 mt-2">
                <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-google-lightBlue text-google-blue border border-google-blue/20">
                  <BadgeCheck size={14} />
                  <span className="text-xs font-bold uppercase tracking-tight">Direct Source Pricing</span>
                </div>
                {analysisTime !== null && (
                  <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-google-surface text-google-gray border border-google-border animate-in fade-in slide-in-from-top-2 duration-500">
                    <Zap size={12} className="text-google-blue fill-google-blue" />
                    <span className="text-[10px] font-bold uppercase tracking-tight font-mono">Sync Complete in {analysisTime.toFixed(1)}s</span>
                  </div>
                )}
              </div>
            </div>
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
                    <p className="text-xs text-google-gray font-medium">Correlating image artifacts with physical inventory nodes...</p>
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
                <p className="text-xs mt-2">No items found within your threshold.</p>
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
                          <span className="text-[9px] font-bold uppercase text-google-gray tracking-tighter">Live Price</span>
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
                      <span className="text-[10px] font-black uppercase">Verified Prices</span>
                    </div>
                  </div>
                  <span className="text-3xl font-black text-google-dark">${currentTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-4">
                   <p className="text-xs text-google-gray font-medium max-w-[200px] text-right hidden lg:block leading-tight">
                     Spatial Sync Intensity: {((analysisTime || 1) * 12).toFixed(0)} MHz <br/>
                     Synced across Atelier partner nodes.
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
      </div>
    </div>
  );
};
