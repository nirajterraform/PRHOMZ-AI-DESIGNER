
import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Check, CreditCard, Loader2, RefreshCw, Trash2, ArrowUpRight, DollarSign, Package, Diamond, Sparkles } from 'lucide-react';
import { ProductItem } from '../types';
import { generateProductList, swapProduct } from '../services/geminiService';
import { Button } from './Button';

interface ShopLookModalProps {
  image: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ShopLookModal: React.FC<ShopLookModalProps> = ({ image, isOpen, onClose }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [swappingIds, setSwappingIds] = useState<Set<string>>(new Set());
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set());
  const [workflowStep, setWorkflowStep] = useState<'design' | 'decor' | 'delivered'>('design');

  useEffect(() => {
    if (isOpen && image) {
      loadProducts();
    } else {
      setProducts([]);
      setSelections({});
      setSuccess(false);
      setCheckingOut(false);
      setSwappingIds(new Set());
      setPurchasedItems(new Set());
      setWorkflowStep('design');
    }
  }, [isOpen, image]);

  const loadProducts = async () => {
    setLoading(true);
    setWorkflowStep('design');
    try {
      const items = await generateProductList(image);
      setProducts(items);
      const initialSelections: Record<string, string> = {};
      items.forEach(item => {
        if (item.colors.length > 0) initialSelections[item.id] = item.colors[0];
      });
      setSelections(initialSelections);
      setWorkflowStep('decor');
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setLoading(false);
    }
  };

  const handleColorSelect = (productId: string, color: string) => {
    setSelections(prev => ({ ...prev, [productId]: color }));
  };

  const handleRemove = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleSwap = async (productId: string) => {
    const productToSwap = products.find(p => p.id === productId);
    if (!productToSwap) return;

    setSwappingIds(prev => new Set(prev).add(productId));
    try {
      const newProduct = await swapProduct(image, productToSwap);
      setProducts(prev => prev.map(p => p.id === productId ? newProduct : p));
      if (newProduct.colors.length > 0) {
        setSelections(prev => ({ ...prev, [newProduct.id]: newProduct.colors[0] }));
      }
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

  const handleBulkCheckout = () => {
    setCheckingOut(true);
    setTimeout(() => {
      setCheckingOut(false);
      setWorkflowStep('delivered');
      setSuccess(true);
    }, 2000);
  };

  const handleSingleCheckout = (itemId: string) => {
    setPurchasedItems(prev => new Set(prev).add(itemId));
  };

  if (!isOpen) return null;

  const totalPrice = products.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12 overflow-hidden">
      <div className="absolute inset-0 bg-brand-950/95 backdrop-blur-3xl transition-all" onClick={onClose} />
      
      <div className="relative bg-brand-950 w-full max-w-7xl h-[90vh] rounded-[3rem] shadow-[0_50px_120px_rgba(0,0,0,0.9)] border border-gold-500/10 flex flex-col md:flex-row overflow-hidden animate-slide-up">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 z-50 p-4 bg-white/5 hover:bg-gold-500/10 backdrop-blur-3xl rounded-full text-white transition-all hover:scale-110 active:scale-90 border border-white/5"
        >
          <X size={20} />
        </button>

        {/* Branding Sidebar */}
        <div className="w-full md:w-5/12 bg-black relative hidden md:flex flex-col border-r border-white/5">
          <img src={image} alt="Ref" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay hover:opacity-70 transition-opacity duration-1000" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          
          <div className="relative flex-1 p-16 flex flex-col justify-end space-y-8">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-gold-500">
                <Diamond size={16} />
                <span className="text-[10px] font-bold uppercase tracking-[0.5em]">Vision Sourcing</span>
              </div>
              <h3 className="text-5xl font-serif text-white font-bold leading-none italic">PRHOMZ</h3>
              <p className="text-2xl font-serif text-gold-200/60 font-light italic">Curated Excellence.</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex flex-col items-center space-y-2 transition-all duration-700 ${workflowStep === 'design' ? 'scale-110' : 'opacity-40'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${workflowStep === 'design' ? 'bg-gold-500 border-gold-400 text-white' : 'border-white/20 text-white/40'}`}>
                  <Sparkles size={16} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-gold-500">Design</span>
              </div>
              <div className="h-px w-8 bg-white/10 mt-[-18px]"></div>
              <div className={`flex flex-col items-center space-y-2 transition-all duration-700 ${workflowStep === 'decor' ? 'scale-110' : 'opacity-40'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${workflowStep === 'decor' ? 'bg-gold-500 border-gold-400 text-white' : 'border-white/20 text-white/40'}`}>
                  <Package size={16} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-gold-500">Decor</span>
              </div>
              <div className="h-px w-8 bg-white/10 mt-[-18px]"></div>
              <div className={`flex flex-col items-center space-y-2 transition-all duration-700 ${workflowStep === 'delivered' ? 'scale-110' : 'opacity-40'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${workflowStep === 'delivered' ? 'bg-gold-500 border-gold-400 text-white' : 'border-white/20 text-white/40'}`}>
                  <ShoppingBag size={16} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-gold-500">Delivered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full md:w-7/12 flex flex-col h-full bg-brand-950/50 backdrop-blur-3xl">
          <div className="p-12 border-b border-white/5 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-3xl font-serif text-white font-bold tracking-tight">The Curation</h3>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-500">Sourced Components</span>
                <span className="h-1 w-1 bg-gold-500 rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-gold-500">{products.length} Items</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-brand-950 bg-brand-800 overflow-hidden shadow-xl">
                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=P${i}`} alt="Partner" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                  <div className="w-24 h-24 border-2 border-gold-500/20 rounded-full animate-ping"></div>
                  <Loader2 className="absolute inset-0 m-auto w-10 h-10 animate-spin text-gold-500" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-serif italic text-2xl text-white">Identifying Masterpieces</p>
                  <p className="text-[10px] uppercase tracking-[0.5em] text-gold-500 font-black">Design Analysis In Progress</p>
                </div>
              </div>
            ) : success ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-16 space-y-12 animate-slide-up">
                <div className="relative">
                  <div className="absolute inset-0 bg-gold-500/30 blur-3xl animate-pulse rounded-full"></div>
                  <div className="relative w-32 h-32 bg-gold-500 text-white rounded-[2rem] flex items-center justify-center shadow-[0_20px_60px_rgba(197,160,89,0.5)] rotate-12 hover:rotate-0 transition-transform duration-700">
                    <Check size={60} strokeWidth={3} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-serif font-bold text-white tracking-tight">Order Finalized.</h3>
                  <p className="text-brand-300 max-w-sm mx-auto leading-relaxed text-lg">Your curated pieces are being prepared for dispatch by our white-glove logistics team.</p>
                  <div className="pt-8">
                     <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gold-500 mb-2">Tracking Passport</p>
                     <p className="text-white font-mono text-sm border border-gold-500/20 inline-block px-6 py-2 rounded-full bg-gold-500/5">#PRH-2025-XQ-9281</p>
                  </div>
                </div>
                <Button onClick={onClose} variant="secondary" className="px-12 py-4 rounded-full border-gold-500/30 text-gold-500 hover:bg-gold-500 hover:text-white transition-all">Exit Concierge</Button>
              </div>
            ) : (
              <div className="space-y-8">
                {products.map((item) => {
                  const isPurchased = purchasedItems.has(item.id);
                  const isSwapping = swappingIds.has(item.id);

                  return (
                    <div key={item.id} className={`
                      group relative bg-brand-900/10 p-8 rounded-[2.5rem] border border-white/5 transition-all duration-700
                      ${isSwapping ? 'opacity-30 blur-md scale-[0.95]' : 'hover:border-gold-500/30 hover:bg-white/5'}
                      ${isPurchased ? 'border-gold-500/40 bg-gold-500/5 shadow-[0_10px_40px_rgba(197,160,89,0.1)]' : ''}
                    `}>
                      <div className="flex-1 space-y-8">
                        <div className="flex justify-between items-start gap-10">
                          <div className="space-y-3">
                             <div className="flex items-center space-x-2">
                               <span className="text-[9px] font-black uppercase tracking-widest text-gold-500 opacity-60">Sourced Item</span>
                               <div className="h-px w-8 bg-gold-500/30"></div>
                             </div>
                             <h4 className="font-serif text-2xl font-bold text-white group-hover:text-gold-100 transition-colors leading-tight italic">{item.name}</h4>
                             <p className="text-sm text-brand-400 leading-relaxed font-light line-clamp-2">{item.description}</p>
                          </div>
                          <div className="text-right flex flex-col items-end space-y-4">
                            <div className="flex items-center space-x-1">
                               <span className="text-gold-500 text-sm">$</span>
                               <span className="font-serif text-3xl font-black text-white tracking-tighter italic">{item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => handleSwap(item.id)}
                                disabled={isPurchased || isSwapping}
                                className="p-3.5 text-brand-500 hover:text-gold-500 bg-white/5 rounded-2xl transition-all hover:scale-110 active:scale-95 border border-white/5"
                                title="Swap for Alternative"
                              >
                                <RefreshCw size={16} className={isSwapping ? 'animate-spin' : ''} />
                              </button>
                              <button 
                                onClick={() => handleRemove(item.id)}
                                disabled={isPurchased || isSwapping}
                                className="p-3.5 text-brand-500 hover:text-red-400 bg-white/5 rounded-2xl transition-all hover:scale-110 active:scale-95 border border-white/5"
                                title="Remove from list"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 pt-8 border-t border-white/5">
                          <div className="space-y-3">
                            <p className="text-[9px] uppercase tracking-[0.3em] text-brand-500 font-black">Material & Finish</p>
                            <div className="flex flex-wrap gap-2">
                              {item.colors.map((color) => {
                                const isSelected = selections[item.id] === color;
                                return (
                                  <button
                                    key={color}
                                    onClick={() => !isPurchased && handleColorSelect(item.id, color)}
                                    disabled={isPurchased || isSwapping}
                                    className={`
                                      px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                                      ${isSelected 
                                        ? 'bg-gold-500 border-gold-400 text-white shadow-lg' 
                                        : 'bg-brand-950/50 border-white/10 text-brand-500 hover:border-gold-500/50 hover:text-gold-200'}
                                      ${isPurchased ? 'opacity-30' : ''}
                                    `}
                                  >
                                    {color}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <Button 
                            variant={isPurchased ? "ghost" : "primary"}
                            size="sm"
                            onClick={() => handleSingleCheckout(item.id)}
                            disabled={isPurchased || isSwapping}
                            className={`rounded-2xl px-10 h-12 ${isPurchased ? "text-gold-500 border-gold-500/20" : "shadow-[0_10px_30px_rgba(197,160,89,0.3)]"}`}
                          >
                            {isPurchased ? (
                              <><Check className="w-4 h-4 mr-2" /> Reserved</>
                            ) : (
                              <><Package className="w-4 h-4 mr-2" /> Purchase Individually</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {products.length === 0 && (
                  <div className="text-center py-32 text-brand-700 flex flex-col items-center animate-slide-up">
                    <div className="w-24 h-24 rounded-full border border-gold-500/10 flex items-center justify-center mb-8 opacity-20">
                      <ShoppingBag size={40} />
                    </div>
                    <p className="font-serif italic text-3xl text-white/50">Curation Void.</p>
                    <p className="text-[10px] uppercase tracking-[0.5em] mt-4 opacity-40 font-black">No artifacts currently matched</p>
                    <Button variant="ghost" size="sm" onClick={loadProducts} className="mt-12 border border-gold-500/20 rounded-full px-12 h-14 hover:bg-gold-500/10 text-gold-500">
                      <RefreshCw className="w-4 h-4 mr-2" /> Re-scan Visuals
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && !success && products.length > 0 && (
            <div className="p-12 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <span className="text-gold-500 text-[10px] font-black uppercase tracking-[0.5em]">Grand Total Curation</span>
                  <p className="text-brand-500 text-xs font-light italic">White-Glove Delivery Included</p>
                </div>
                <div className="flex items-baseline space-x-1">
                   <span className="text-gold-500 font-serif text-xl">$</span>
                   <span className="text-5xl font-serif font-black text-white tracking-tighter italic">{totalPrice.toLocaleString()}</span>
                </div>
              </div>
              <Button 
                onClick={handleBulkCheckout} 
                className="w-full h-20 rounded-3xl text-xl shadow-[0_20px_80px_rgba(197,160,89,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all font-serif italic font-bold"
                size="lg"
                isLoading={checkingOut}
              >
                {!checkingOut && <CreditCard className="mr-4 h-6 w-6" />}
                Design • Decor • Delivered
              </Button>
              <div className="mt-8 flex justify-center items-center space-x-6 opacity-30">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" className="h-5 invert" alt="Stripe" />
                 <div className="h-4 w-px bg-white/20"></div>
                 <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Encrypted Vault Processing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
