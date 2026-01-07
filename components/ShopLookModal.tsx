
import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingBag, Check, CreditCard, Loader2, RefreshCw, Trash2, Package, Bookmark, AlertCircle, Info, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { ProductItem } from '../types';
import { generateProductList, swapProduct } from '../services/geminiService';
import { Button } from './Button';

interface ShopLookModalProps {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  budget?: number;
}

export const ShopLookModal: React.FC<ShopLookModalProps> = ({ image, isOpen, onClose, budget }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<'checkout' | 'save' | null>(null);
  const [success, setSuccess] = useState<'checkout' | 'save' | null>(null);
  const [swappingIds, setSwappingIds] = useState<Set<string>>(new Set());
  const [filterByBudget, setFilterByBudget] = useState(false);

  useEffect(() => {
    if (isOpen && image) {
      loadProducts();
    } else {
      setProducts([]);
      setSelections({});
      setSuccess(null);
      setIsProcessing(null);
      setSwappingIds(new Set());
      setFilterByBudget(false);
    }
  }, [isOpen, image]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const items = await generateProductList(image);
      setProducts(items);
      const initialSelections: Record<string, string> = {};
      items.forEach(item => { if (item.colors.length > 0) initialSelections[item.id] = item.colors[0]; });
      setSelections(initialSelections);
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setLoading(false);
    }
  };

  // Determine which products fit within the budget using greedy selection
  const budgetOptimizedProducts = useMemo(() => {
    if (budget === undefined) return products;
    let runningTotal = 0;
    return products.filter(product => {
      if (runningTotal + product.price <= budget) {
        runningTotal += product.price;
        return true;
      }
      return false;
    });
  }, [products, budget]);

  const visibleProducts = filterByBudget ? budgetOptimizedProducts : products;
  const hiddenCount = products.length - budgetOptimizedProducts.length;

  const handleColorSelect = (productId: string, color: string) => {
    setSelections(prev => ({ ...prev, [productId]: color }));
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          imageUrl: `https://loremflickr.com/300/300/furniture,interior,${encodeURIComponent((p.name + " " + color).replace(/\s+/g, ','))}`
        };
      }
      return p;
    }));
  };

  const handleDelete = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleAction = (type: 'checkout' | 'save') => {
    setIsProcessing(type);
    setTimeout(() => {
      setIsProcessing(null);
      setSuccess(type);
    }, 1200);
  };

  const handleSwap = async (productId: string) => {
    const productToSwap = products.find(p => p.id === productId);
    if (!productToSwap) return;
    setSwappingIds(prev => new Set(prev).add(productId));
    try {
      const newProduct = await swapProduct(image, productToSwap);
      setProducts(prev => prev.map(p => p.id === productId ? newProduct : p));
      if (newProduct.colors.length > 0) setSelections(prev => ({ ...prev, [newProduct.id]: newProduct.colors[0] }));
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

  const currentTotal = visibleProducts.reduce((sum, item) => sum + item.price, 0);
  const actualTotal = products.reduce((sum, item) => sum + item.price, 0);
  const isOverBudget = budget !== undefined && actualTotal > budget;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-google-bg w-full max-w-5xl h-[90vh] rounded-[1.5rem] shadow-2xl border border-google-border flex flex-col md:flex-row overflow-hidden animate-fade">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 text-google-gray hover:text-google-dark hover:bg-google-surface rounded-full transition-all">
          <X size={24} />
        </button>

        {/* Sidebar */}
        <div className="w-full md:w-80 bg-google-surface relative hidden md:flex flex-col border-r border-google-border p-8 justify-between">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-google-dark">Curated Selection</h3>
            <p className="text-xs text-google-gray leading-relaxed">
              Our AI detected these specific pieces in your render. You can purchase them now or save them to your profile.
            </p>
            {budget !== undefined && (
              <div className="pt-4 border-t border-google-border">
                <span className="text-[10px] font-bold text-google-gray uppercase tracking-widest block mb-1">Your Project Budget</span>
                <span className="text-lg font-bold text-google-blue">${budget.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          <div className="rounded-xl overflow-hidden border border-google-border aspect-square relative group">
            <img src={image} alt="Reference" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-[10px] font-bold text-white uppercase tracking-widest">Master Reference</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 opacity-50">
             <Package size={14} />
             <span className="text-[9px] font-bold uppercase tracking-[0.2em]">PRHOMZ AI DESIGNER FEED</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full bg-google-bg overflow-hidden">
          <div className="p-6 border-b border-google-border flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-google-dark">Shopping List</h3>
              <div className="flex items-center space-x-2 mt-1">
                <button 
                  onClick={() => setFilterByBudget(!filterByBudget)}
                  className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md border transition-all ${filterByBudget ? 'bg-google-blue/10 border-google-blue text-google-blue' : 'bg-google-surface border-google-border text-google-gray hover:text-google-dark'}`}
                >
                  {filterByBudget ? <ShieldCheck size={12} /> : <Eye size={12} />}
                  <span className="text-[9px] font-bold uppercase tracking-tighter">
                    {filterByBudget ? 'Budget Guard Active' : 'Showing All Items'}
                  </span>
                </button>
              </div>
            </div>
            <span className="text-xs font-bold text-google-blue bg-google-blue/10 px-3 py-1 rounded-full border border-google-blue/20">
              {visibleProducts.length} Items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
                <p className="text-xs font-bold text-google-gray uppercase tracking-widest animate-pulse">Scanning Inventory...</p>
              </div>
            ) : success ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="w-16 h-16 bg-google-blue/20 text-google-blue rounded-full flex items-center justify-center">
                  {success === 'checkout' ? <Check size={32} /> : <Bookmark size={32} />}
                </div>
                <h3 className="text-2xl font-bold text-google-dark">
                  {success === 'checkout' ? 'Request Received' : 'List Saved'}
                </h3>
                <p className="text-google-gray text-sm max-w-xs mx-auto">
                  {success === 'checkout' 
                    ? 'A concierge will reach out within 24 hours to confirm shipping and final customizations.' 
                    : 'Your curation has been added to your Atelier Gallery for later viewing.'}
                </p>
                <Button onClick={onClose} variant="secondary" className="rounded-full px-10">Return to Studio</Button>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <ShoppingBag size={48} />
                <p className="text-xs font-bold uppercase tracking-widest">Your list is currently empty</p>
                <Button onClick={onClose} variant="ghost" size="sm">Add More Items</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {isOverBudget && !filterByBudget && (
                  <div className="bg-red-400/10 border border-red-400/30 p-4 rounded-xl flex items-center justify-between animate-fade mb-6">
                    <div className="flex items-center space-x-3">
                      <AlertCircle size={20} className="text-red-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Budget Exceeded</p>
                        <p className="text-[11px] text-google-gray leading-tight mt-0.5">Total selection is ${actualTotal.toLocaleString()}. Budget is ${budget?.toLocaleString()}.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setFilterByBudget(true)}
                      className="px-3 py-1.5 bg-red-400/20 text-red-400 text-[10px] font-bold uppercase rounded-lg border border-red-400/30 hover:bg-red-400 hover:text-white transition-all"
                    >
                      Apply Budget Guard
                    </button>
                  </div>
                )}
                {visibleProducts.map((item) => (
                  <div key={item.id} className="bg-google-surface p-4 rounded-xl border border-google-border flex flex-col sm:flex-row gap-6 animate-fade hover:border-google-blue/40 transition-colors group">
                    <div className="w-full sm:w-32 h-32 flex-shrink-0 bg-google-bg rounded-lg overflow-hidden border border-google-border relative">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover bg-google-surface" 
                          key={item.imageUrl}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://placehold.co/300x300/1e1e1e/8ab4f8?text=${encodeURIComponent(item.name)}`;
                          }}
                        />
                        {swappingIds.has(item.id) && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 size={16} className="text-google-blue animate-spin" />
                          </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-google-dark text-md leading-tight">{item.name}</h4>
                          <p className="text-[11px] text-google-gray mt-1 leading-relaxed max-w-md">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-google-blue">${item.price.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 mt-auto pt-4">
                        <div className="flex flex-wrap gap-1.5">
                          {item.colors.map(color => (
                            <button 
                              key={color} 
                              onClick={() => handleColorSelect(item.id, color)} 
                              className={`px-3 py-1 text-[9px] font-bold rounded-full border transition-all ${selections[item.id] === color ? 'bg-google-blue text-google-bg border-google-blue' : 'bg-google-bg border-google-border text-google-gray hover:text-google-dark'}`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                        
                        <div className="flex space-x-1">
                          <button onClick={() => handleSwap(item.id)} className="p-2 text-google-gray hover:text-google-blue hover:bg-google-blue/10 rounded-lg transition-colors border border-google-border" title="Swap Piece">
                            <RefreshCw size={14} className={swappingIds.has(item.id) ? 'animate-spin' : ''} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-google-gray hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-google-border" title="Remove Item">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filterByBudget && hiddenCount > 0 && (
                  <div className="p-4 bg-google-surface border border-dashed border-google-border rounded-xl flex items-center justify-center space-x-3 opacity-60">
                    <EyeOff size={16} />
                    <span className="text-xs font-medium text-google-gray">{hiddenCount} products hidden by Budget Guard.</span>
                    <button 
                      onClick={() => setFilterByBudget(false)}
                      className="text-xs font-bold text-google-blue hover:underline"
                    >
                      Show all items
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && !success && visibleProducts.length > 0 && (
            <div className="p-6 border-t border-google-border bg-google-surface shadow-2xl">
              <div className="flex justify-between items-center mb-6 px-2">
                <div>
                  <span className={`font-bold text-[10px] uppercase tracking-widest block ${(isOverBudget && !filterByBudget) ? 'text-red-400' : 'text-google-gray'}`}>
                    {(isOverBudget && !filterByBudget) ? 'Subtotal (Exceeds Budget)' : 'Current Subtotal'}
                  </span>
                  <span className={`text-2xl font-bold ${(isOverBudget && !filterByBudget) ? 'text-red-400' : 'text-google-dark'}`}>
                    ${currentTotal.toLocaleString()}
                  </span>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="flex items-center space-x-1 text-google-blue mb-1 justify-end">
                    <Info size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                      {filterByBudget ? 'Optimized for Budget' : 'Full Selection View'}
                    </span>
                  </div>
                  <span className="text-google-gray text-[10px] font-medium uppercase tracking-tight">Concierge Delivery Included</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => handleAction('save')} 
                  variant="secondary" 
                  className="flex-1 h-14 rounded-xl text-sm font-bold border-google-border" 
                  isLoading={isProcessing === 'save'}
                  disabled={!!isProcessing}
                >
                  <Bookmark className="mr-2 w-4 h-4" /> Save for Later
                </Button>
                <Button 
                  onClick={() => handleAction('checkout')} 
                  className={`flex-[1.5] h-14 rounded-xl text-md font-bold shadow-xl ${(isOverBudget && !filterByBudget) ? 'bg-google-border cursor-not-allowed opacity-50' : 'bg-google-blue'}`}
                  isLoading={isProcessing === 'checkout'}
                  disabled={!!isProcessing || (isOverBudget && !filterByBudget)}
                >
                  <CreditCard className="mr-2 w-5 h-5" /> {(isOverBudget && !filterByBudget) ? 'Limit Exceeded' : 'Checkout Now'}
                </Button>
              </div>
              
              <p className="text-center text-[10px] text-google-gray mt-4 font-medium uppercase tracking-tighter opacity-60">
                Secured by PRHOMZ AI DESIGNER Logistics Protocol
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
