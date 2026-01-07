
import React, { useState, useRef } from 'react';
import { Upload, Download, ShoppingBag, Plus, ImageIcon, CheckCircle2, ChevronRight, Wand2, ShieldCheck } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { GeneratedImage, DESIGN_PRESETS } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Remodeler: React.FC<RemodelerProps> = ({ onImageGenerated }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [budget, setBudget] = useState(5000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleRemodel = async () => {
    if (!previewUrl || (!instruction.trim() && !selectedStyle)) return;
    setIsProcessing(true);
    try {
      const styleContext = selectedStyle ? DESIGN_PRESETS.find(p => p.id === selectedStyle)?.prompt : '';
      const fullInstruction = `${instruction}. ${styleContext}. Budget: $${budget}`.trim();
      const outputBase64 = await remodelImage(previewUrl, fullInstruction);
      setResultImage(outputBase64);
      onImageGenerated({
        id: Date.now().toString(),
        url: outputBase64,
        prompt: fullInstruction,
        mode: 'edit',
        timestamp: Date.now()
      });
    } catch (error) {
      alert("Something went wrong with the remodel. Please ensure your prompt focuses on home design.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade">
      <header className="mb-12">
        <div className="flex items-center space-x-2 mb-2">
          <ShieldCheck size={16} className="text-google-blue" />
          <span className="text-[10px] font-bold text-google-blue uppercase tracking-widest">Industry Specific Engine</span>
        </div>
        <h2 className="text-3xl font-semibold text-google-dark mb-2">Remodel your Space</h2>
        <p className="text-google-gray font-medium">Let PRHOMZ AI Designer curate Furnishings and Decor Changes</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Panel */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-google-surface border border-google-border rounded-2xl overflow-hidden p-6 space-y-6 shadow-sm">
            <h3 className="text-xs font-bold text-google-gray uppercase tracking-wider">Step 1: Upload Room Photo</h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${previewUrl ? 'border-google-blue bg-google-blue/10' : 'border-google-border bg-google-bg hover:bg-google-surface'}
              `}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-lg opacity-90" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 bg-google-surface rounded-full flex items-center justify-center mx-auto shadow-sm border border-google-border">
                    <Plus className="w-5 h-5 text-google-blue" />
                  </div>
                  <p className="text-xs font-medium text-google-gray">Select interior photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          </section>

          <section className="bg-google-surface border border-google-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h3 className="text-xs font-bold text-google-gray uppercase tracking-wider">Step 2: Redesign Instruction</h3>
            <div className="grid grid-cols-2 gap-2">
              {DESIGN_PRESETS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(prev => prev === style.id ? '' : style.id)}
                  className={`
                    px-3 py-2 text-xs font-medium border rounded-lg transition-all text-left
                    ${selectedStyle === style.id ? 'bg-google-blue text-google-bg border-google-blue font-bold' : 'bg-google-bg border-google-border text-google-gray hover:text-google-dark hover:bg-google-surface'}
                  `}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Swap the sofa for a modern sectional, add mid-century lamps..."
              className="w-full bg-google-bg border border-google-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none min-h-[120px] resize-none text-google-dark placeholder-google-gray"
            />
          </section>

          <section className="bg-google-surface border border-google-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-google-gray uppercase tracking-wider">Furnishing Budget</h3>
              <span className="text-sm font-semibold text-google-dark">${budget.toLocaleString()}</span>
            </div>
            <input 
              type="range" min="500" max="50000" step="500" value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              className="w-full"
            />
          </section>

          <Button 
            onClick={handleRemodel} 
            isLoading={isProcessing} 
            className="w-full rounded-xl py-4 font-bold"
            disabled={!previewUrl || (!instruction.trim() && !selectedStyle)}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Apply Transformations
          </Button>
        </div>

        {/* Result Area */}
        <div className="lg:col-span-8">
          <div className="bg-google-surface border border-google-border rounded-[2rem] overflow-hidden flex items-center justify-center min-h-[600px] relative group shadow-lg">
            {resultImage ? (
              <div className="w-full h-full relative">
                <img src={resultImage} alt="Remodeled" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-google-bg/90 to-transparent flex items-center justify-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button onClick={() => setIsShopOpen(true)} className="rounded-full bg-google-dark text-google-bg hover:bg-white border-none px-8 font-bold shadow-2xl">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Shop Furnishings
                  </Button>
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = resultImage;
                      link.download = 'remodel.png';
                      link.click();
                    }}
                    className="p-3 bg-google-surface/60 backdrop-blur-md text-google-dark rounded-full hover:bg-google-surface transition-all shadow-xl border border-google-border"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-20 space-y-6">
                {isProcessing ? (
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-12 h-12 border-4 border-google-border border-t-google-blue rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-google-gray animate-pulse font-mono tracking-tighter">REDRAWING ROOM ARCHITECTURE...</p>
                  </div>
                ) : (
                  <div className="opacity-40 flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 border-2 border-dashed border-google-gray rounded-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-google-gray" />
                    </div>
                    <p className="text-sm font-medium text-google-gray">Awaiting Interior Scene</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {resultImage && <ShopLookModal image={resultImage} isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} budget={budget} />}
    </div>
  );
};
