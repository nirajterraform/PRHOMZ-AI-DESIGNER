
import React, { useState } from 'react';
import { Sparkles, Download, ShoppingBag, Send, Box, Zap, ShieldAlert } from 'lucide-react';
import { generateDesignImage } from '../services/geminiService';
import { downloadImage } from '../services/downloadImage';
import { AspectRatio, GeneratedImage, DESIGN_PRESETS } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';

interface GeneratorProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Generator: React.FC<GeneratorProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [budget, setBudget] = useState(10000); // Default budget for generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>('');
  const [isShopOpen, setIsShopOpen] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !selectedStyle) return;
    setIsGenerating(true);
    try {
      const styleContext = selectedStyle 
        ? DESIGN_PRESETS.find(p => p.id === selectedStyle)?.prompt 
        : '';
      const finalPrompt = `${prompt} ${styleContext}`.trim();
      
      const result = await generateDesignImage({ prompt: finalPrompt, aspectRatio });
      setCurrentImage(result.url);
      onImageGenerated({
        id: result.imageId,
        url: result.url,
        prompt: finalPrompt,
        mode: 'creation',
        timestamp: Date.now(),
        createdAt: Date.now(),
        expiresAt: Date.now(),
        tierAtCreation: 'freemium',
        watermarked: result.watermarked,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleStyle = (id: string) => {
    setSelectedStyle(prev => prev === id ? '' : id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-16 animate-fade">
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-google-blue mb-1">
          <ShieldAlert size={14} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Interior Domain Restricted</span>
        </div>
        <p className="text-neutral-500 text-sm tracking-wide uppercase font-medium">Curate high-fidelity interior visions. Optimized for furniture and room upgrades.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-12 space-y-10">
          <form onSubmit={handleGenerate} className="relative group border-b border-google-border focus-within:border-google-blue transition-colors pb-4">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your room vision (e.g., Parisian apartment with velvet sofas)..."
              className="w-full bg-transparent py-4 text-xl md:text-2xl font-serif italic focus:outline-none text-google-dark placeholder:text-neutral-700"
            />
            <button 
              type="submit" 
              disabled={(!prompt.trim() && !selectedStyle) || isGenerating}
              className="absolute right-0 bottom-4 text-google-blue disabled:opacity-20 transition-all hover:scale-110 p-2"
            >
              {isGenerating ? <Box size={24} className="animate-spin" /> : <Send size={24} />}
            </button>
          </form>

          {/* Style Presets and Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
               <div className="flex items-center space-x-2 text-neutral-500">
                  <Box size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Design Manifestos</span>
               </div>
               <div className="flex flex-wrap gap-3">
                  {DESIGN_PRESETS.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => toggleStyle(style.id)}
                      className={`
                        px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest border transition-all rounded-sm
                        ${selectedStyle === style.id 
                          ? 'bg-google-blue border-google-blue text-google-bg shadow-[0_0_20px_rgba(138,180,248,0.2)]' 
                          : 'bg-transparent border-google-border text-neutral-500 hover:border-white/30 hover:text-white'}
                      `}
                    >
                      {style.label}
                    </button>
                  ))}
               </div>
            </div>

            <div className="space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-neutral-500">
                    <Zap size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Canvas Ratio</span>
                  </div>
                  <div className="flex space-x-8">
                    {(['16:9', '1:1', '9:16'] as AspectRatio[]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`text-[9px] font-bold uppercase tracking-widest transition-all ${aspectRatio === ratio ? 'text-google-blue border-b border-google-blue pb-1' : 'text-neutral-500 hover:text-white'}`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between items-center text-neutral-500">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Estimated Budget</span>
                    </div>
                    <span className="text-sm font-bold text-google-blue">${budget.toLocaleString()}</span>
                  </div>
                  <input 
                    type="range" min="1000" max="100000" step="1000" value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    className="w-full accent-google-blue"
                  />
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-12">
          <div className="relative aspect-video bg-neutral-900 overflow-hidden border border-google-border flex items-center justify-center rounded-xl shadow-2xl">
            {currentImage ? (
              <div className="w-full h-full group">
                <img src={currentImage} alt="Result" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-6">
                  <Button onClick={() => setIsShopOpen(true)} className="bg-white text-black px-8 py-3 rounded-none font-bold">Shop the Look</Button>
                  <button onClick={() => downloadImage(currentImage, 'design.png')} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-none border border-white/20"><Download size={20}/></button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                {isGenerating ? (
                  <div className="animate-pulse text-google-blue text-[10px] font-bold uppercase tracking-widest">PRHOMZ AI is Processing Spatial Data...</div>
                ) : (
                  <div className="text-neutral-800 uppercase text-[10px] font-bold tracking-[0.4em]">Awaiting Interior Instruction</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {currentImage && <ShopLookModal image={currentImage} isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} budget={budget} />}
    </div>
  );
};
