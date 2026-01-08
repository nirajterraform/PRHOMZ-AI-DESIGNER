
import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingBag, Check, CreditCard, Loader2, RefreshCw, Trash2, Package, Bookmark, AlertCircle, Info, Eye, EyeOff, ShieldCheck, ExternalLink, Zap } from 'lucide-react';
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
  };

  const handleBuyNow = (item: ProductItem) => {
    // Simulation: Shopify Direct Checkout URL
    // In production: window.location.href = `https://yourstore.com/cart/${item.shopifyId}:1`;
    window.open(`https://shopify.com/checkout?item=${item.shopifyId}`, '_blank');
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
  const actualTotal = products.reduce((sum, item) => sum + item.price, 0);
  const isOverBudget = budget !== undefined && actualTotal > budget;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-google-bg w-full max-w-5xl h-[90vh] rounded-[1.5rem] shadow-2xl border border-google-border flex flex-col md:flex-row overflow-hidden animate-fade">
        <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 text-google-gray hover:text-google-dark hover:bg-google-surface rounded-full transition-all">
          <X size={24} />
        </button>

        <div className="w-full md:w-80 bg-google-surface relative hidden md:flex flex-col border-r border-google-border p-8 justify-between">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-google-dark">Real Inventory</h3>
            <p className="text-xs text-google-gray leading-relaxed">
              We've synced the artifacts in this render with our live Shopify catalog. Prices and stock levels are real-time.
            </p>
            {budget !== undefined && (
              <div className="pt-4 border-t border-google-border">
                <span className="text-[10px] font-bold text-google-gray uppercase tracking-widest block mb-1">Budget Threshold</span>
                <span className="text-lg font-bold text-google-blue">${budget.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          <div className="rounded-xl overflow-hidden border border-google-border aspect-square relative group">
            <img src={image} alt="Reference" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-center space-x-2 opacity-50">
             <Package size={14} />
             <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Live Sync Active</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full bg-google-bg overflow-hidden">
          <div className="p-6 border-b border-google-border flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-google-dark">Artifact Curation</h3>
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-google-lightBlue text-google-blue border border-google-blue/20">
                  <Zap size={10} />
                  <span className="text-[9px] font-bold uppercase tracking-tighter">Verified SKUs Only</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-google-blue" />
                <p className="text-xs font-bold text-google-gray uppercase tracking-widest">Querying Inventory Systems...</p>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <ShoppingBag size={48} />
              </div>
            ) : (
              <div className="space-y-3">
                {visibleProducts.map((item) => (
                  <div key={item.id} className="bg-google-surface p-4 rounded-xl border border-google-border flex flex-col sm:flex-row gap-6 hover:border-google-blue/40 transition-colors">
                    <div className="w-full sm:w-28 h-28 flex-shrink-0 bg-google-bg rounded-lg overflow-hidden border border-google-border relative">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        {swappingIds.has(item.id) && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 size={16} className="text-google-blue animate-spin" /></div>}
                    </div>

                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                             <h4 className="font-bold text-google-dark text-sm">{item.name}</h4>
                             {item.stockLevel && item.stockLevel > 0 ? (
                               <span className="text-[8px] px-1.5 py-0.5 bg-green-400/10 text-green-400 border border-green-400/20 rounded-full font-bold uppercase tracking-widest">In Stock ({item.stockLevel})</span>
                             ) : (
                               <span className="text-[8px] px-1.5 py-0.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-full font-bold uppercase tracking-widest">Sourcing Required</span>
                             )}
                          </div>
                          <p className="text-[10px] text-google-gray mt-1 line-clamp-2">{item.description}</p>
                        </div>
                        <span className="text-md font-bold text-google-blue">${item.price.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-1">
                          {item.colors.map(color => (
                            <button key={color} onClick={() => handleColorSelect(item.id, color)} className={`px-2 py-0.5 text-[8px] font-bold rounded-full border ${selections[item.id] === color ? 'bg-google-blue text-google-bg border-google-blue' : 'bg-google-bg border-google-border text-google-gray'}`}>
                              {color}
                            </button>
                          ))}
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => handleSwap(item.id)} className="p-1.5 text-google-gray border border-google-border rounded-lg hover:text-google-blue transition-colors"><RefreshCw size={12} /></button>
                          <button 
                            onClick={() => handleBuyNow(item)} 
                            className="px-4 py-1.5 bg-google-blue text-google-bg rounded-lg text-[10px] font-bold flex items-center shadow-lg hover:brightness-110 transition-all"
                            disabled={!item.shopifyId || item.shopifyId === 'external_referral'}
                          >
                            <ExternalLink size={10} className="mr-1.5" /> 
                            {item.shopifyId === 'external_referral' ? 'Sourcing Info' : 'Direct Buy'}
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
            <div className="p-6 border-t border-google-border bg-google-surface">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <span className="text-[10px] font-bold text-google-gray uppercase tracking-widest block">Project Subtotal</span>
                  <span className="text-xl font-bold text-google-dark">${currentTotal.toLocaleString()}</span>
                </div>
                <div className="flex space-x-2">
                   <Button variant="secondary" className="rounded-xl px-6 h-12 text-xs">Save Selection</Button>
                   <Button className="rounded-xl px-8 h-12 text-xs shadow-xl"><CreditCard size={14} className="mr-2" /> Complete Order</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
