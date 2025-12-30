
import React, { useState } from 'react';
import { Sparkles, Download, ShoppingBag, DollarSign, Layers, Maximize2 } from 'lucide-react';
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
    if (val < 2000) return 'Essential';
    if (val < 10000) return 'Standard';
    if (val < 25000) return 'Premium';
    return 'Luxury';
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const budgetContext = `The project budget is approximately $${budget.toLocaleString()} (${getBudgetTier(budget)} tier). Ensure the materials, furniture, and finishes reflect this budget level.`;
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
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <div className="space-y-4 max-w-2xl">
        <div className="inline-flex items-center space-x-2 bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 rounded-full mb-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">Generative Architect</span>
        </div>
        <h2 className="text-5xl font-serif font-bold text-white tracking-tight leading-tight">
          Craft your <span className="italic text-brand-400">ideal sanctuary</span>
        </h2>
        <p className="text-brand-300/80 text-lg leading-relaxed">
          Translate your aesthetic desires into stunning, hyper-realistic interior visualizations instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 space-y-8">
          <form onSubmit={handleGenerate} className="glass-card p-8 rounded-3xl space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-400">Concept Vision</label>
                <Layers className="w-4 h-4 text-brand-700" />
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., A mid-century modern library with oak shelving and deep emerald velvet lounge chairs..."
                className="w-full h-40 bg-brand-950/50 border border-white/5 rounded-2xl p-5 text-white placeholder-brand-700/60 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/30 transition-all resize-none shadow-inner"
              />
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-400">Financial Tier</label>
                <div className="px-3 py-1 bg-brand-800/40 rounded-lg border border-white/5">
                  <span className="text-brand-200 text-[10px] font-mono uppercase tracking-tighter">
                    {getBudgetTier(budget)} Selection
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <input 
                  type="range" 
                  min="500" 
                  max="50000" 
                  step="500"
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value))}
                  className="w-full h-1 bg-brand-800 rounded-lg appearance-none cursor-pointer accent-brand-400"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-brand-600 font-bold">$500</span>
                  <span className="text-brand-100 font-serif text-2xl tracking-tighter">${budget.toLocaleString()}<span className="text-brand-500">{budget === 50000 ? '+' : ''}</span></span>
                  <span className="text-[10px] text-brand-600 font-bold">$50,000</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-400">Composition</label>
              <div className="grid grid-cols-3 gap-3">
                {(['16:9', '1:1', '9:16'] as AspectRatio[]).map((ratio) => (isActive => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`
                      py-3 px-4 rounded-xl text-xs font-bold transition-all relative overflow-hidden
                      ${aspectRatio === ratio 
                        ? 'bg-brand-500 text-white shadow-[0_0_15px_rgba(86,119,114,0.4)]' 
                        : 'bg-brand-950/80 text-brand-500 border border-white/5 hover:border-brand-500/50 hover:text-brand-300'}
                    `}
                  >
                    {ratio}
                  </button>
                ))(aspectRatio === ratio))}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-5 rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-transform" 
              isLoading={isGenerating}
              disabled={!prompt.trim()}
            >
              <Sparkles className="w-4 h-4 mr-3" />
              Initialize Rendering
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {['Minimalist Zen', 'Dark Academia', 'Biophilic', 'Futuristic', 'Art Deco'].map(tag => (
              <button
                key={tag}
                onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + tag)}
                className="px-4 py-2 bg-brand-900/20 text-[10px] text-brand-400 font-bold uppercase tracking-widest rounded-full border border-white/5 hover:bg-brand-800 hover:text-brand-100 transition-all duration-300"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 h-full">
          <div className="relative group min-h-[500px] lg:h-full flex items-center justify-center bg-brand-950 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-inner">
            {currentImage ? (
              <div className="relative w-full h-full animate-fade-in">
                <img 
                  src={currentImage} 
                  alt="Generated Design" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center space-y-6">
                   <Button 
                      onClick={() => setIsShopOpen(true)}
                      className="bg-white text-brand-950 hover:bg-brand-50 hover:text-brand-950 px-8 py-4 rounded-full border-none shadow-[0_20px_40px_rgba(0,0,0,0.5)] transform translate-y-4 group-hover:translate-y-0 transition-all duration-500"
                    >
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      Shop the Curation
                    </Button>
                    <div className="flex space-x-3 transform translate-y-8 group-hover:translate-y-0 transition-all duration-700 delay-75">
                      <Button variant="ghost" size="sm" onClick={downloadImage} className="bg-white/10 backdrop-blur-md px-6 rounded-full border border-white/10">
                        <Download className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" className="bg-white/10 backdrop-blur-md px-6 rounded-full border border-white/10">
                        <Maximize2 className="w-4 h-4 mr-2" />
                        Full Size
                      </Button>
                    </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-brand-700 p-12 space-y-6">
                {isGenerating ? (
                  <div className="space-y-8 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-t-2 border-brand-500 rounded-full animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-serif text-2xl italic tracking-wide">Processing your vision</h4>
                      <p className="text-brand-600 text-xs font-bold uppercase tracking-[0.3em]">Estimated completion: 15s</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col items-center opacity-40 group-hover:opacity-60 transition-opacity">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-brand-800 flex items-center justify-center">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <p className="font-serif italic text-xl">The canvas of your dreams awaits</p>
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
