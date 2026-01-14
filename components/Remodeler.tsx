
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, ShoppingBag, Plus, ImageIcon, CheckCircle2, ChevronRight, Wand2, ShieldCheck, RefreshCcw, Layout, AlertTriangle, Crown } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { GeneratedImage, DESIGN_PRESETS, UserAccount } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
  initialImage?: string | null;
  onClearInitial?: () => void;
  currentUser: UserAccount | null;
}

export const Remodeler: React.FC<RemodelerProps> = ({ onImageGenerated, initialImage, onClearInitial, currentUser }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage || null);
  const [instruction, setInstruction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [budget, setBudget] = useState(5000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImage) {
      setPreviewUrl(initialImage);
      setResultImage(null);
    }
  }, [initialImage]);

  // Quota calculation logic
  const getRecentRendersCount = () => {
    if (!currentUser || currentUser.role !== 'Client') return 0;
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const history = currentUser.renderTimestamps || [];
    return history.filter(ts => ts > twentyFourHoursAgo).length;
  };

  const rendersUsedToday = getRecentRendersCount();
  const isQuotaReached = currentUser?.role === 'Client' && rendersUsedToday >= 2;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
        setResultImage(null);
        if (onClearInitial) onClearInitial();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemodel = async () => {
    if (isQuotaReached) return;
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
        timestamp: Date.now(),
        projectName: projectName || 'Untitled Iteration'
      });
    } catch (error) {
      alert("Something went wrong with the remodel. Please ensure your prompt focuses on home design.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setResultImage(null);
    setSelectedFile(null);
    setProjectName('');
    if (onClearInitial) onClearInitial();
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheck size={18} className="text-google-blue" />
            <span className="text-xs font-bold text-google-blue uppercase tracking-widest">Industry Specific Engine</span>
          </div>
          <h2 className="text-3xl font-semibold text-google-dark mb-2">
            {initialImage ? 'Refine Iteration' : 'Remodel your Space'}
          </h2>
          <p className="text-google-gray font-medium text-base">Let PRHOMZ AI Designer curate Furnishings and Decor Changes</p>
        </div>
        {previewUrl && (
          <button 
            onClick={handleReset}
            className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-google-gray hover:text-google-dark transition-colors"
          >
            <RefreshCcw size={14} />
            <span>Upload New Photo</span>
          </button>
        )}
      </header>

      {currentUser?.role === 'Client' && (
        <div className={`mb-8 p-6 rounded-2xl border flex items-center justify-between ${isQuotaReached ? 'bg-red-400/10 border-red-400/30' : 'bg-google-blue/5 border-google-blue/20'}`}>
          <div className="flex items-center space-x-4">
            {isQuotaReached ? <AlertTriangle className="text-red-400" size={24} /> : <Crown className="text-google-blue" size={24} />}
            <div>
              <p className={`text-sm font-bold uppercase tracking-widest ${isQuotaReached ? 'text-red-400' : 'text-google-blue'}`}>
                {isQuotaReached ? 'Daily Quota Reached' : 'Essential Account Quota'}
              </p>
              <p className="text-xs text-google-gray font-medium mt-0.5">
                {isQuotaReached 
                  ? 'Free users are limited to 2 transformations per 24h. Upgrade for unlimited access.' 
                  : `${rendersUsedToday}/2 transformations used in the last 24h.`}
              </p>
            </div>
          </div>
          {!isQuotaReached && (
            <div className="flex h-2 w-32 bg-google-bg rounded-full overflow-hidden border border-google-border">
              <div 
                className="h-full bg-google-blue transition-all duration-1000" 
                style={{ width: `${(rendersUsedToday / 2) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Panel */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-google-surface border border-google-border rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-google-gray uppercase tracking-wider flex items-center">
              <Layout size={16} className="mr-2" /> Project Meta
            </h3>
            <input 
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Master Suite Revamp"
              className="w-full bg-google-bg border border-google-border rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none text-google-dark placeholder-google-gray transition-all"
            />
          </section>

          <section className="bg-google-surface border border-google-border rounded-2xl overflow-hidden p-6 space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-google-gray uppercase tracking-wider">Step 1: Upload Room Photo</h3>
            <div 
              onClick={() => !isQuotaReached && fileInputRef.current?.click()}
              className={`
                relative h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${previewUrl ? 'border-google-blue bg-google-blue/10' : 'border-google-border bg-google-bg hover:bg-google-surface'}
                ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {previewUrl ? (
                <div className="relative w-full h-full group">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-lg opacity-90" />
                  {!isQuotaReached && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                      <span className="text-xs font-bold text-white uppercase tracking-widest">Change Photo</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 bg-google-surface rounded-full flex items-center justify-center mx-auto shadow-sm border border-google-border">
                    <Plus className="w-5 h-5 text-google-blue" />
                  </div>
                  <p className="text-sm font-medium text-google-gray">Select interior photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          </section>

          <section className="bg-google-surface border border-google-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-google-gray uppercase tracking-wider">Step 2: Redesign Instruction</h3>
            <div className="grid grid-cols-2 gap-3">
              {DESIGN_PRESETS.map((style) => (
                <button
                  key={style.id}
                  disabled={isQuotaReached}
                  onClick={() => setSelectedStyle(prev => prev === style.id ? '' : style.id)}
                  className={`
                    px-3 py-2.5 text-xs font-semibold border rounded-lg transition-all text-left
                    ${selectedStyle === style.id ? 'bg-google-blue text-google-bg border-google-blue font-bold' : 'bg-google-bg border-google-border text-google-gray hover:text-google-dark hover:bg-google-surface'}
                    ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <textarea
              value={instruction}
              disabled={isQuotaReached}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Swap the sofa for a modern sectional, add mid-century lamps..."
              className={`w-full bg-google-bg border border-google-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none min-h-[140px] resize-none text-google-dark placeholder-google-gray leading-relaxed ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </section>

          <section className="bg-google-surface border border-google-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-google-gray uppercase tracking-wider">Furnishing Budget</h3>
              <span className="text-base font-bold text-google-dark">${budget.toLocaleString()}</span>
            </div>
            <input 
              type="range" min="500" max="50000" step="500" value={budget}
              disabled={isQuotaReached}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              className={`w-full h-2 rounded-full cursor-pointer ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </section>

          <Button 
            onClick={handleRemodel} 
            isLoading={isProcessing} 
            className={`w-full rounded-xl py-4.5 text-base font-bold ${isQuotaReached ? 'bg-google-gray cursor-not-allowed' : ''}`}
            disabled={!previewUrl || (!instruction.trim() && !selectedStyle) || isQuotaReached}
          >
            <Wand2 className="w-5 h-5 mr-2" />
            {isQuotaReached ? 'Quota Reached' : initialImage ? 'Apply Refinements' : 'Apply Transformations'}
          </Button>
        </div>

        {/* Result Area */}
        <div className="lg:col-span-8">
          <div className="bg-google-surface border border-google-border rounded-[2.5rem] overflow-hidden flex items-center justify-center min-h-[600px] relative group shadow-lg">
            {resultImage ? (
              <div className="w-full h-full relative">
                <img src={resultImage} alt="Remodeled" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-10 bg-gradient-to-t from-google-bg/95 to-transparent flex items-center justify-center space-x-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button onClick={() => setIsShopOpen(true)} className="rounded-full bg-google-dark text-google-bg hover:bg-white border-none px-10 py-4 text-sm font-bold shadow-2xl transition-all hover:scale-105 active:scale-95">
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Shop Furnishings
                  </Button>
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = resultImage;
                      link.download = 'remodel.png';
                      link.click();
                    }}
                    className="p-4 bg-google-surface/60 backdrop-blur-md text-google-dark rounded-full hover:bg-google-surface transition-all shadow-xl border border-google-border hover:scale-110 active:scale-90"
                  >
                    <Download size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-20 space-y-8">
                {isProcessing ? (
                  <div className="flex flex-col items-center space-y-8">
                    <div className="w-16 h-16 border-4 border-google-border border-t-google-blue rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-google-gray animate-pulse font-mono tracking-widest">REDRAWING ROOM ARCHITECTURE...</p>
                  </div>
                ) : (
                  <div className="opacity-40 flex flex-col items-center space-y-6">
                    <div className="w-24 h-24 border-2 border-dashed border-google-gray rounded-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-google-gray" />
                    </div>
                    <p className="text-base font-bold text-google-gray uppercase tracking-widest">
                      {isQuotaReached ? 'Daily Quota Reached' : 'Awaiting Interior Scene'}
                    </p>
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
