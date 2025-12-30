
import React, { useState, useRef } from 'react';
import { Upload, Paintbrush, Download, ArrowRight, ShoppingBag, DollarSign, Image as ImageIcon, Sparkles } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { GeneratedImage } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Remodeler: React.FC<RemodelerProps> = ({ onImageGenerated }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [budget, setBudget] = useState(2500);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBudgetTier = (val: number) => {
    if (val < 1500) return 'Essential';
    if (val < 5000) return 'Standard';
    if (val < 15000) return 'Premium';
    return 'Luxury';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemodel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl || !instruction.trim()) return;

    setIsProcessing(true);
    try {
      const budgetContext = `The remodel budget is $${budget.toLocaleString()} (${getBudgetTier(budget)} tier). Prioritize changes and additions that fit this cost profile.`;
      const fullInstruction = `${instruction}. ${budgetContext}`;
      
      const outputBase64 = await remodelImage(previewUrl, fullInstruction);
      setResultImage(outputBase64);

      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: outputBase64,
        prompt: `Remodel ($${budget.toLocaleString()}): ${instruction}`,
        mode: 'edit',
        timestamp: Date.now()
      };
      onImageGenerated(newImage);
    } catch (error) {
      alert("Failed to remodel image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12 animate-fade-in">
      <div className="space-y-4 max-w-2xl">
        <div className="inline-flex items-center space-x-2 bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 rounded-full mb-2">
          <Paintbrush className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">Space Transformation</span>
        </div>
        <h2 className="text-5xl font-serif font-bold text-white tracking-tight leading-tight">
          Reimagine your <span className="italic text-brand-400">physical world</span>
        </h2>
        <p className="text-brand-300/80 text-lg leading-relaxed">
          Upload an existing space and let PRHOMZ apply architectural updates with surgical precision.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-5 space-y-8">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative h-72 border border-white/5 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden glass-card
              ${previewUrl 
                ? 'bg-brand-950/80' 
                : 'bg-brand-900/20 hover:bg-brand-900/40 hover:border-brand-500/30'}
            `}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Original" className="w-full h-full object-cover p-1 rounded-[2rem]" />
            ) : (
              <div className="text-center p-12 space-y-4 text-brand-500 transition-all group-hover:text-brand-300">
                <div className="w-16 h-16 bg-brand-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-white">Upload Reference</p>
                  <p className="text-[10px] uppercase tracking-widest mt-1 opacity-60">High-Resolution Preferred</p>
                </div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden" 
            />
            {previewUrl && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white text-brand-950 px-4 py-2 rounded-full">Replace Image</span>
              </div>
            )}
          </div>

          <form onSubmit={handleRemodel} className="glass-card p-8 rounded-[2rem] space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-400">Transformation Brief</label>
              <div className="relative">
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="E.g., Replace the sofa with a curved ivory boucle lounge..."
                  className="w-full bg-brand-950/50 border border-white/5 rounded-2xl py-5 px-6 pr-14 text-white placeholder-brand-700/60 focus:ring-2 focus:ring-brand-500/30 focus:outline-none shadow-inner"
                />
                <Paintbrush className="absolute right-5 top-5 w-5 h-5 text-brand-700" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-400">Remodel Budget</label>
                <div className="px-3 py-1 bg-brand-800/40 rounded-lg border border-white/5">
                  <span className="text-brand-200 text-[10px] font-mono uppercase tracking-tighter">
                    {getBudgetTier(budget)}
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
                  <span className="text-[10px] text-brand-600 font-bold tracking-widest">$500</span>
                  <span className="text-brand-100 font-serif text-2xl tracking-tighter">${budget.toLocaleString()}<span className="text-brand-500">{budget === 50000 ? '+' : ''}</span></span>
                  <span className="text-[10px] text-brand-600 font-bold tracking-widest">$50,000</span>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-5 rounded-2xl shadow-2xl hover:scale-[1.02] transition-all" 
              isLoading={isProcessing}
              disabled={!previewUrl || !instruction.trim()}
            >
              Initialize Transformation
            </Button>
          </form>
        </div>

        <div className="lg:col-span-7 h-full">
          <div className="relative group min-h-[500px] lg:h-full flex items-center justify-center bg-brand-950 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-inner">
            {resultImage ? (
              <div className="relative w-full h-full animate-fade-in">
                <img src={resultImage} alt="Remodeled" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center space-y-6">
                   <Button 
                      onClick={() => setIsShopOpen(true)}
                      className="bg-white text-brand-950 hover:bg-brand-50 px-8 py-4 rounded-full border-none shadow-[0_20px_40px_rgba(0,0,0,0.5)] transform translate-y-4 group-hover:translate-y-0 transition-all duration-500"
                    >
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      Shop the Look
                    </Button>
                    <a 
                      href={resultImage} 
                      download={`prhomz-remodel-${Date.now()}.png`}
                      className="flex items-center px-6 py-2 bg-white/10 backdrop-blur-md text-white rounded-full border border-white/10 hover:bg-white/20 transition-all transform translate-y-8 group-hover:translate-y-0 transition-all duration-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Result
                    </a>
                </div>
              </div>
            ) : (
              <div className="text-center p-12 space-y-8 flex flex-col items-center">
                {isProcessing ? (
                  <div className="space-y-8 flex flex-col items-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-t-2 border-brand-500 rounded-full animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-brand-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-white font-serif text-2xl italic tracking-wide">Synthesizing Space</h4>
                      <p className="text-brand-600 text-[10px] font-bold uppercase tracking-[0.3em]">Allocating ${budget.toLocaleString()} Resources</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col items-center opacity-30 group-hover:opacity-50 transition-all">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-brand-800 flex items-center justify-center">
                      <ArrowRight className="w-10 h-10" />
                    </div>
                    <p className="font-serif italic text-xl">The future of your space appears here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {resultImage && (
        <ShopLookModal 
          image={resultImage} 
          isOpen={isShopOpen} 
          onClose={() => setIsShopOpen(false)} 
        />
      )}
    </div>
  );
};
