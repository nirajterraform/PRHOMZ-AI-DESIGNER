
import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Check, CreditCard, Loader2, RefreshCw, Trash2, ArrowUpRight, DollarSign, Package } from 'lucide-react';
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
    }
  }, [isOpen, image]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const items = await generateProductList(image);
      setProducts(items);
      const initialSelections: Record<string, string> = {};
      items.forEach(item => {
        if (item.colors.length > 0) initialSelections[item.id] = item.colors[0];
      });
      setSelections(initialSelections);
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
      setSuccess(true);
    }, 1500);
  };

  const handleSingleCheckout = (itemId: string) => {
    setPurchasedItems(prev => new Set(prev).add(itemId));
  };

  if (!isOpen) return null;

  const totalPrice = products.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl transition-all" onClick={onClose} />
      
      <div className="relative bg-brand-950 w-full max-w-6xl rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/5 flex flex-col md:flex-row overflow-hidden max-h-[95vh] animate-fade-in">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full text-white transition-all hover:scale-110 active:scale-90"
        >
          <X size={20} />
        </button>

        {/* Left Side: Cinematic Preview */}
        <div className="w-full md:w-5/12 bg-brand-950 relative hidden md:block border-r border-white/5">
          <img src={image} alt="Design Reference" className="w-full h-full object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 transition-all duration-1000" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-transparent" />
          <div className="absolute bottom-0 inset-x-0 p-12 space-y-4">
            <div className="h-px w-12 bg-brand-500 mb-6"></div>
            <h3 className="text-4xl font-serif text-white font-bold leading-tight">Curation <br/><span className="italic text-brand-400">Library</span></h3>
            <p className="text-brand-300/60 text-sm tracking-wide leading-relaxed font-light">
              PRHOMZ Vision Intelligence has identified these premium architectural components within your visualization.
            </p>
          </div>
        </div>

        {/* Right Side: Product Interface */}
        <div className="w-full md:w-7/12 flex flex-col h-full bg-brand-950/40 backdrop-blur-3xl">
          <div className="p-10 border-b border-white/5 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-2xl font-serif text-white font-bold">Selected Pieces</h3>
              <p className="text-[10px] text-brand-500 font-bold uppercase tracking-[0.4em]">Inventory Sourcing</p>
            </div>
            <div className="flex items-center space-x-2 bg-brand-500/10 px-4 py-1.5 rounded-full border border-brand-500/20">
               <Package className="w-3.5 h-3.5 text-brand-400" />
               <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">{products.length} Found</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-brand-500 space-y-6">
                <div className="relative">
                  <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
                  <ShoppingBag className="absolute inset-0 m-auto w-4 h-4 text-brand-500 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="font-serif italic text-xl text-white">Curating your selection</p>
                  <p className="text-[9px] uppercase tracking-[0.3em] mt-2 font-bold opacity-60">Architectural Inference Active</p>
                </div>
              </div>
            ) : success ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-8 animate-fade-in">
                <div className="w-24 h-24 bg-brand-500/10 text-brand-400 rounded-full flex items-center justify-center border border-brand-500/30 shadow-2xl">
                  <Check size={48} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-serif font-bold text-white tracking-tight">Purchase Successful</h3>
                  <p className="text-brand-300 max-w-sm mx-auto leading-relaxed">Your selected architectural assets have been reserved for fulfillment.</p>
                  <p className="text-brand-500 text-[10px] mt-6 font-mono uppercase tracking-widest opacity-60 border border-white/5 py-2 px-4 rounded-lg">ID: PRH-{Math.floor(Math.random() * 1000000)}</p>
                </div>
                <Button onClick={onClose} variant="secondary" className="px-10 rounded-full">Explore More</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {products.map((item) => {
                  const isPurchased = purchasedItems.has(item.id);
                  const isSwapping = swappingIds.has(item.id);

                  return (
                    <div key={item.id} className={`
                      group relative bg-brand-900/20 p-6 rounded-[2rem] border border-white/5 transition-all duration-500
                      ${isSwapping ? 'opacity-40 blur-sm scale-[0.98]' : 'hover:border-brand-500/30 hover:bg-brand-900/40'}
                      ${isPurchased ? 'border-brand-500/50 bg-brand-500/5' : ''}
                    `}>
                      <div className="flex-1 space-y-5">
                        <div className="flex justify-between items-start">
                          <div className="max-w-[70%] space-y-2">
                             <h4 className="font-serif text-xl font-bold text-white group-hover:text-brand-100 transition-colors">{item.name}</h4>
                             <p className="text-xs text-brand-400/80 leading-relaxed font-light">{item.description}</p>
                          </div>
                          <div className="text-right space-y-3">
                            <span className="font-mono text-xl font-bold text-white tracking-tighter">${item.price.toLocaleString()}</span>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => handleSwap(item.id)}
                                disabled={isPurchased || isSwapping}
                                className="p-2.5 text-brand-500 hover:text-white bg-white/5 rounded-xl transition-all hover:scale-110 active:scale-95"
                                title="Swap for Alternative"
                              >
                                <RefreshCw size={14} className={isSwapping ? 'animate-spin' : ''} />
                              </button>
                              <button 
                                onClick={() => handleRemove(item.id)}
                                disabled={isPurchased || isSwapping}
                                className="p-2.5 text-brand-500 hover:text-red-400 bg-white/5 rounded-xl transition-all hover:scale-110 active:scale-95"
                                title="Remove from list"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2 border-t border-white/5 mt-4">
                          <div className="space-y-2">
                            <p className="text-[9px] uppercase tracking-widest text-brand-600 font-bold">Variant Selection</p>
                            <div className="flex flex-wrap gap-2">
                              {item.colors.map((color) => {
                                const isSelected = selections[item.id] === color;
                                return (
                                  <button
                                    key={color}
                                    onClick={() => !isPurchased && handleColorSelect(item.id, color)}
                                    disabled={isPurchased || isSwapping}
                                    className={`
                                      px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border
                                      ${isSelected 
                                        ? 'bg-brand-500 border-brand-500 text-white shadow-lg' 
                                        : 'bg-brand-950/50 border-white/10 text-brand-500 hover:border-brand-500/50 hover:text-brand-300'}
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
                            variant={isPurchased ? "ghost" : "secondary"}
                            size="sm"
                            onClick={() => handleSingleCheckout(item.id)}
                            disabled={isPurchased || isSwapping}
                            className={`rounded-xl px-6 ${isPurchased ? "text-brand-300" : "bg-white/10 hover:bg-white/20 border-white/10"}`}
                          >
                            {isPurchased ? (
                              <><Check className="w-3.5 h-3.5 mr-2" /> Acquisition Finalized</>
                            ) : (
                              <><ArrowUpRight className="w-3.5 h-3.5 mr-2" /> Buy Item</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {products.length === 0 && (
                  <div className="text-center py-24 text-brand-700 flex flex-col items-center animate-fade-in">
                    <div className="w-20 h-20 rounded-full border border-brand-900 flex items-center justify-center mb-6 opacity-40">
                      <ShoppingBag size={32} />
                    </div>
                    <p className="font-serif italic text-2xl">Your curation is empty.</p>
                    <p className="text-[10px] uppercase tracking-[0.3em] mt-2 opacity-50">No identified pieces found</p>
                    <Button variant="ghost" size="sm" onClick={loadProducts} className="mt-8 border border-white/5 rounded-full px-8">
                      <RefreshCw className="w-3 h-3 mr-2" /> Refresh Inventory
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && !success && products.length > 0 && (
            <div className="p-10 bg-brand-950/60 backdrop-blur-3xl border-t border-white/5">
              <div className="flex justify-between items-baseline mb-8">
                <div className="space-y-1">
                  <span className="text-brand-500 text-[10px] font-bold uppercase tracking-[0.3em]">Total Value</span>
                  <p className="text-brand-300 text-xs font-light">{products.length} Premium Architectural Assets</p>
                </div>
                <div className="flex items-center space-x-1">
                   <span className="text-brand-500 font-serif text-xl">$</span>
                   <span className="text-4xl font-serif font-bold text-white tracking-tighter">{totalPrice.toLocaleString()}</span>
                </div>
              </div>
              <Button 
                onClick={handleBulkCheckout} 
                className="w-full py-6 rounded-2xl text-lg shadow-[0_20px_50px_rgba(86,119,114,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all"
                size="lg"
                isLoading={checkingOut}
              >
                {!checkingOut && <CreditCard className="mr-3 h-5 w-5" />}
                Complete Full Acquisition
              </Button>
              <div className="flex items-center justify-center space-x-2 mt-6 opacity-30">
                <div className="h-px w-8 bg-brand-500"></div>
                <p className="text-[9px] text-brand-500 font-bold uppercase tracking-[0.4em]">PRHOMZ Secure Transaction</p>
                <div className="h-px w-8 bg-brand-500"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
