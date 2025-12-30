import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Check, CreditCard, Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-brand-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-brand-700 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Left Side: Image */}
        <div className="w-full md:w-5/12 bg-brand-950 relative hidden md:block">
          <img src={image} alt="Design Reference" className="w-full h-full object-cover opacity-90" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-brand-950 to-transparent p-8">
            <h3 className="text-2xl font-serif text-white font-bold">Shop the Look</h3>
            <p className="text-brand-300 text-sm mt-1">Curated selection from your masterpiece.</p>
          </div>
        </div>

        {/* Right Side: Products */}
        <div className="w-full md:w-7/12 flex flex-col h-full bg-brand-900">
          <div className="p-6 border-b border-brand-800 md:hidden">
            <h3 className="text-xl font-serif text-white font-bold">Shop the Look</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-brand-400 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
                <p>Curating your personal shopping list...</p>
              </div>
            ) : success ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center">
                  <Check size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif font-bold text-white mb-2">Checkout Complete</h3>
                  <p className="text-brand-300">Your curated pieces are on their way.</p>
                  <p className="text-brand-400 text-sm mt-4 font-mono">Order: PRH-{Math.floor(Math.random() * 1000000)}</p>
                </div>
                <Button onClick={onClose} variant="secondary">Back to Design</Button>
              </div>
            ) : (
              products.map((item) => {
                const isPurchased = purchasedItems.has(item.id);
                const isSwapping = swappingIds.has(item.id);

                return (
                  <div key={item.id} className={`
                    group relative flex gap-4 bg-brand-950/40 p-5 rounded-xl border border-brand-800 transition-all
                    ${isSwapping ? 'opacity-50 blur-[1px]' : 'hover:border-brand-600'}
                  `}>
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="max-w-[70%]">
                           <h4 className="font-serif text-lg font-medium text-white leading-tight">{item.name}</h4>
                           <p className="text-xs text-brand-400 mt-1">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-lg text-brand-100">${item.price}</span>
                          <div className="flex gap-2 mt-2 justify-end">
                            <button 
                              onClick={() => handleSwap(item.id)}
                              disabled={isPurchased || isSwapping}
                              className="p-1.5 text-brand-400 hover:text-brand-200 bg-brand-900 rounded-md transition-colors"
                              title="Swap for Similar"
                            >
                              <RefreshCw size={14} className={isSwapping ? 'animate-spin' : ''} />
                            </button>
                            <button 
                              onClick={() => handleRemove(item.id)}
                              disabled={isPurchased || isSwapping}
                              className="p-1.5 text-brand-400 hover:text-red-400 bg-brand-900 rounded-md transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {item.colors.map((color) => {
                              const isSelected = selections[item.id] === color;
                              return (
                                <button
                                  key={color}
                                  onClick={() => !isPurchased && handleColorSelect(item.id, color)}
                                  disabled={isPurchased || isSwapping}
                                  className={`
                                    px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tighter transition-all border
                                    ${isSelected 
                                      ? 'bg-brand-500 border-brand-500 text-white' 
                                      : 'bg-brand-900 border-brand-800 text-brand-500 hover:border-brand-600'}
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
                          className={isPurchased ? "text-brand-300" : "bg-brand-800/50"}
                        >
                          {isPurchased ? (
                            <><Check className="w-3.5 h-3.5 mr-1.5" /> Ready</>
                          ) : (
                            <><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Buy Item</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {!loading && !success && products.length === 0 && (
              <div className="text-center py-20 text-brand-500 flex flex-col items-center">
                <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-serif italic">Your selection is empty.</p>
                <Button variant="ghost" size="sm" onClick={loadProducts} className="mt-4">
                  <RefreshCw className="w-3 h-3 mr-2" /> Reset Identification
                </Button>
              </div>
            )}
          </div>

          {!loading && !success && products.length > 0 && (
            <div className="p-6 bg-brand-950 border-t border-brand-800">
              <div className="flex justify-between items-baseline mb-6">
                <div>
                  <span className="text-brand-500 text-xs font-bold uppercase tracking-[0.2em]">Subtotal</span>
                  <p className="text-brand-300 text-sm">{products.length} Premium Pieces</p>
                </div>
                <span className="text-3xl font-serif font-bold text-white">${totalPrice.toLocaleString()}</span>
              </div>
              <Button 
                onClick={handleBulkCheckout} 
                className="w-full py-4 text-lg shadow-2xl"
                size="lg"
                isLoading={checkingOut}
              >
                {!checkingOut && <ShoppingBag className="mr-3 h-5 w-5" />}
                Checkout Selected Design
              </Button>
              <p className="text-center text-[10px] text-brand-500 mt-4 uppercase tracking-[0.3em] opacity-50">
                PRHOMZ Signature Secure Fulfillment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};