
import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingBag, Loader2, RefreshCw, Package, ExternalLink, Zap, Bookmark } from 'lucide-react';
import { ProductItem } from '../types';
import { generateProductList, swapProduct } from '../services/geminiService';
import { Button } from './Button';
import { SHOPIFY_STORE_URL } from '../services/dataService';

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
  const [swappingIds, setSwappingIds] = useState<Set<string>>(new Set());
  const [filterByBudget, setFilterByBudget] = useState(false);

  useEffect(() => {
    if (isOpen && image) {
      loadProducts();
    } else {
      setProducts([]);
      setSelections({});
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

  const handleColorSelect = (productId: string, color: string) => {
    setSelections(prev => ({ ...prev, [productId]: color }));
  };

  const handleSourcingAction = (item: ProductItem) => {
    if (item.productUrl) {
      window.open(item.productUrl, '_blank');
    } else if (item.shopifyId && item.shopifyId !== 'external_referral') {
      window.open(`${SHOPIFY_STORE_URL}/cart/${item.shopifyId}:1`, '_blank');
    } else {
      window.open(SHOPIFY_STORE_URL, '_blank');
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

  const currentTotal = visibleProducts.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-google-bg w-full max-w-6xl h-[90vh] rounded-[2rem] shadow-2xl border border-google-border flex flex-col md:flex-row overflow-hidden animate-fade">
        <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 text-google-gray hover:text-google-dark hover:bg-google-surface rounded-full transition-all">
          <X size={28} />
        </button>

        <div className="w-full md:w-96 bg-google-surface relative hidden md:flex flex-col border-r border-google-border p-10 justify-between">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-google-dark">Real Inventory</h3>
            <p className="text-sm text-google-gray leading-relaxed">
              We've synced the artifacts in this render with our live PRHOMZ inventory. Prices and stock levels are updated in real-time for your specific region.
            </p>
            {budget !== undefined && (
              <div className="pt-6 border-t border-google-border">
                <span className="text-xs font-bold text-google-gray uppercase tracking-widest block mb-2">Budget Threshold</span>
                <span className="text-2xl font-bold text-google-blue">${budget.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          <div className="rounded-2xl overflow-hidden border border-google-border aspect-square relative group shadow-inner">
            <img src={image} alt="Reference" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center space-x-3 opacity-60">
             <Package size={18} />
             <span className="text-xs font-bold uppercase tracking-[0.2em]">PRHOMZ LIVE SYNC</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full bg-google-bg overflow-hidden">
          <div className="p-8 border-b border-google-border flex items-center justify-between bg-google-bg/50">
            <div className="flex flex-col">
              <h3 className="text-xl font-bold text-google-dark">Artifact Curation</h3>
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-google-lightBlue text-google-blue border border-google-blue/20">
                  <Zap size={14} />
                  <span className="text-xs font-bold uppercase tracking-tight">Verified Premium SKUs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6">
                <Loader2 className="w-10 h-10 animate-spin text-google-blue" />
                <p className="text-sm font-bold text-google-gray uppercase tracking-widest">Querying Inventory Systems...</p>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <ShoppingBag size={64} />
                <p className="text-sm font-bold mt-4 uppercase tracking-widest">No artifacts detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleProducts.map((item) => (
                  <div key={item.id} className="bg-google-surface p-6 rounded-2xl border border-google-border flex flex-col hover:border-google-blue/40 transition-all group">
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                             {swappingIds.has(item.id) ? (
                               <Loader2 size={16} className="text-google-blue animate-spin" />
                             ) : (
                               <Package size={16} className="text-google-blue opacity-50" />
                             )}
                             <h4 className="font-bold text-google-dark text-lg leading-tight">{item.name}</h4>
                             {item.stockLevel && item.stockLevel > 0 ? (
                               <span className="text-xs px-2 py-0.5 bg-green-400/10 text-green-400 border border-green-400/20 rounded-full font-bold uppercase tracking-widest">In Stock ({item.stockLevel})</span>
                             ) : (
                               <span className="text-xs px-2 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full font-bold uppercase tracking-widest">Special Order</span>
                             )}
                          </div>
                          <p className="text-sm text-google-gray mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                        </div>
                        <span className="text-xl font-bold text-google-blue ml-4">${item.price.toLocaleString()}</span>
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
                          <button onClick={() => handleSwap(item.id)} className="p-2 text-google-gray border border-google-border rounded-xl hover:text-google-blue hover:bg-google-bg transition-all" title="Request Alternative"><RefreshCw size={16} /></button>
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

          {!loading && visibleProducts.length > 0 && (
            <div className="p-8 border-t border-google-border bg-google-surface">
              <div className="flex justify-between items-center max-w-5xl mx-auto">
                <div>
                  <span className="text-xs font-bold text-google-gray uppercase tracking-widest block mb-1">Estimated Total</span>
                  <span className="text-3xl font-black text-google-dark">${currentTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-4">
                   <p className="text-xs text-google-gray font-medium max-w-[200px] text-right hidden sm:block">
                     Individual items are purchased directly through PRHOMZ.
                   </p>
                   <Button variant="secondary" className="rounded-2xl px-8 h-14 text-sm font-bold flex items-center">
                     <Bookmark size={18} className="mr-2" />
                     Save to Project
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
