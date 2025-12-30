
import React, { useState } from 'react';
import { Sparkles, Download, ShoppingBag, DollarSign, Layers, Maximize2, Diamond } from 'lucide-react';
import { generateDesignImage } from '../services/geminiService';
import { AspectRatio, GeneratedImage } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';

interface GeneratorProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Generator: React.FC<GeneratorProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [budget, setBudget] = useState(5000);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);

  const getBudgetTier = (val: number) => {
    if (val < 2000) return 'Essential Curation';
    if (val < 10000) return 'Signature Design';
    if (val < 25000) return 'Premium Collection';
    return 'Elite Atelier';
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const budgetContext = `The project budget is approximately $${budget.toLocaleString()} (${getBudgetTier(budget)} tier). Ensure the materials, furniture, and finishes reflect this budget level. Focus on high-end luxury aesthetics.`;
      const fullPrompt = `${prompt}. ${budgetContext}`;
      
      const base64Image = await generateDesignImage(fullPrompt, aspectRatio);
      setCurrentImage(base64Image);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: base64Image,
        prompt: prompt,
        mode: 'creation',
        timestamp: Date.now()
      };
      
      onImageGenerated(newImage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (currentImage) {
      const link = document.createElement('a');
      link.href = currentImage;
      link.download = `prhomz-design-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-16 pb-24 animate-slide-up">
      <div className="space-y-6 max-w-3xl">
        <div className="inline-flex items-center space-x-3 bg-gold-500/10 border border-gold-500/20 px-5 py-2 rounded-full mb-2">
          <Diamond className="w-3.5 h-3.5 text-gold-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-500">Design Initializer</span>
        </div>
        <h2 className="text-6xl md:text-7xl font-serif font-black text-white tracking-tighter leading-none italic">
          Imagine <span className="text-gold-500 not-italic">Limitless</span> <br/>Refinement.
        </h2>
        <p className="text-brand-300 text-xl font-light leading-relaxed max-w-2xl italic">
          PRHOMZ AI synthesizes architectural brilliance with high-fashion decor to deliver your next masterpiece.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-5 space-y-10">
          <form onSubmit={handleGenerate} className="glass-card p-10 rounded-[3rem] space-y-10 border border-gold-500/10">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-500">Vision Script</label>
                <Layers className="w-4 h-4 text-brand-700" />
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., A sprawling Brutalist villa in the Swiss Alps with warm cedar ceilings and oversized mohair sectionals..."
                className="w-full h-44 bg-brand-950/80 border border-white/5 rounded-[2rem] p-7 text-white placeholder-brand-800 text-lg font-serif italic focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/20 transition-all resize-none shadow-inner"
              />
            </div>

            <div className="space-y-8">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-500">Financial Portrait</label>
                <div className="px-3 py-1 bg-gold-500/5 rounded-lg border border-gold-500/20">
                  <span className="text-gold-500 text-[9px] font-black uppercase tracking-widest">
                    {getBudgetTier(budget)}
                  </span>
                </div>
              </div>
              <div className="space-y-6">
                <input 
                  type="range" 
                  min="1000" 
                  max="100000" 
                  step="1000"
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value))}
                  className="w-full h-1 bg-brand-900 rounded-lg appearance-none cursor-pointer accent-gold-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-brand-700 font-black tracking-widest">$1,000</span>
                  <span className="text-white font-serif text-3xl font-black italic tracking-tighter">${budget.toLocaleString()}</span>
                  <span className="text-[9px] text-brand-700 font-black tracking-widest">$100,000</span>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-500 px-1">Perspective</label>
              <div className="grid grid-cols-3 gap-4">
                {(['16:9', '1:1', '9:16'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`
                      py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden border
                      ${aspectRatio === ratio 
                        ? 'bg-gold-500 border-gold-400 text-white shadow-lg' 
                        : 'bg-brand-950/80 text-brand-600 border-white/5 hover:border-gold-500/30 hover:text-gold-300'}
                    `}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-6 rounded-3xl shadow-[0_20px_50px_rgba(197,160,89,0.2)] hover:scale-[1.02] active:scale-95 transition-all text-xl font-serif italic font-bold h-20" 
              isLoading={isGenerating}
              disabled={!prompt.trim()}
            >
              <Sparkles className="w-5 h-5 mr-3" />
              Manifest Design
            </Button>
          </form>
        </div>

        <div className="lg:col-span-7 h-full">
          <div className="relative group min-h-[600px] lg:h-full flex items-center justify-center bg-black rounded-[4rem] border border-gold-500/10 overflow-hidden shadow-inner">
            <div className="absolute inset-0 gold-shimmer opacity-20 pointer-events-none"></div>
            {currentImage ? (
              <div className="relative w-full h-full animate-slide-up">
                <img 
                  src={currentImage} 
                  alt="Render" 
                  className="w-full h-full object-cover shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 flex flex-col items-center justify-center space-y-8">
                   <Button 
                      onClick={() => setIsShopOpen(true)}
                      className="bg-white text-brand-950 hover:bg-gold-500 hover:text-white px-12 py-5 rounded-full border-none shadow-[0_30px_60px_rgba(0,0,0,0.6)] transform translate-y-6 group-hover:translate-y-0 transition-all duration-700 font-serif italic font-bold text-lg"
                    >
                      <ShoppingBag className="w-5 h-5 mr-4" />
                      Shop the Decor
                    </Button>
                    <div className="flex space-x-4 transform translate-y-12 group-hover:translate-y-0 transition-all duration-1000 delay-100">
                      <Button variant="ghost" size="sm" onClick={downloadImage} className="bg-white/5 backdrop-blur-3xl px-8 h-12 rounded-full border border-white/10 hover:border-gold-500/50">
                        <Download className="w-4 h-4 mr-3" />
                        Archive
                      </Button>
                      <Button variant="ghost" size="sm" className="bg-white/5 backdrop-blur-3xl px-8 h-12 rounded-full border border-white/10 hover:border-gold-500/50">
                        <Maximize2 className="w-4 h-4 mr-3" />
                        Exhibition
                      </Button>
                    </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-20 space-y-8 flex flex-col items-center">
                {isGenerating ? (
                  <div className="space-y-10 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-24 h-24 border-2 border-gold-500 rounded-full animate-spin border-t-transparent"></div>
                      <Diamond className="absolute inset-0 m-auto w-8 h-8 text-gold-500 animate-pulse" />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-white font-serif text-3xl italic font-bold tracking-tight">Architectural Synthesis</h4>
                      <div className="flex items-center justify-center space-x-3">
                         <div className="h-px w-8 bg-gold-500/40"></div>
                         <p className="text-gold-500 text-[10px] font-black uppercase tracking-[0.5em]">Delivering Vision</p>
                         <div className="h-px w-8 bg-gold-500/40"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 flex flex-col items-center opacity-30 group-hover:opacity-70 transition-all duration-1000">
                    <div className="w-32 h-32 rounded-[2.5rem] border-2 border-dashed border-gold-500/30 flex items-center justify-center rotate-45 group-hover:rotate-0 transition-transform duration-1000">
                      <Sparkles className="w-12 h-12 text-gold-500" />
                    </div>
                    <div className="space-y-2">
                       <p className="font-serif italic text-3xl text-white">Your Canvas is Boundless</p>
                       <p className="text-[9px] uppercase tracking-[0.6em] text-gold-500 font-black">Begin Signature Process</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {currentImage && (
        <ShopLookModal 
          image={currentImage} 
          isOpen={isShopOpen} 
          onClose={() => setIsShopOpen(false)} 
        />
      )}
    </div>
  );
};
