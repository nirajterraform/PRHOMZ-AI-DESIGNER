
import React, { useState, useRef, useEffect } from 'react';
import { Download, ShoppingBag, Plus, ImageIcon, Wand2, RefreshCcw, Layout, Star, Clock, Zap } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { saveProductsToImage } from '../services/galleryService';
import { downloadImage } from '../services/downloadImage';
import { GeneratedImage, DESIGN_PRESETS, UserAccount } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';
import { QuotaBadge } from './QuotaBadge';
import { FeedbackForm } from './FeedbackForm';
import { PreRenderWarningModal } from './PreRenderWarningModal';
import { QuotaExceededModal, type QuotaExceededReason } from './QuotaExceededModal';
import {
  isQuotaExhausted,
  getDailyQuotaSnapshot,
  getMonthlyQuotaSnapshot,
} from '../services/quotaService';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
  initialImage?: string | null;
  onClearInitial?: () => void;
  currentUser: UserAccount | null;
  onNavigateToPricing?: () => void;
}

export const Remodeler: React.FC<RemodelerProps> = ({
  onImageGenerated,
  initialImage,
  onClearInitial,
  currentUser,
  onNavigateToPricing,
}) => {
  const [, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage || null);
  const [instruction, setInstruction] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [budget, setBudget] = useState(5000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [lastUploadedImageId, setLastUploadedImageId] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<number>(0);
  const [feedbackDismissed, setFeedbackDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('feedback-dismissed') === '1';
  });
  const dismissFeedback = () => {
    try { window.sessionStorage.setItem('feedback-dismissed', '1'); } catch { /* ignore */ }
    setFeedbackDismissed(true);
  };
  const [warningOpen, setWarningOpen] = useState(false);
  const [exceededInfo, setExceededInfo] = useState<{
    reason: QuotaExceededReason;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialImage) {
      setPreviewUrl(initialImage);
      setResultImage(null);
      setGenerationTime(null);
    }
  }, [initialImage]);

  const startTimer = () => {
    setActiveTimer(0);
    const start = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      setActiveTimer((Date.now() - start) / 1000);
    }, 100);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const isQuotaReached = isQuotaExhausted(currentUser);

  const warningStorageKey = (uid: string) => {
    const utcDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    return `prhomz:prerender-warning-shown:${uid}:${utcDate}`;
  };

  const wasWarningShownToday = (uid: string): boolean => {
    try {
      return localStorage.getItem(warningStorageKey(uid)) === '1';
    } catch {
      return false;
    }
  };

  const markWarningShownToday = (uid: string) => {
    try {
      localStorage.setItem(warningStorageKey(uid), '1');
    } catch {
      /* localStorage unavailable (private mode) — warning will reappear, acceptable */
    }
  };

  const canSubmit =
    !!previewUrl && (instruction.trim().length > 0 || !!selectedStyle) && !isProcessing && !isQuotaReached;

  const handleRemodelClick = () => {
    if (!canSubmit || !currentUser) return;
    const daily = getDailyQuotaSnapshot(currentUser);
    // Only warn on daily-limited tiers (Freemium / Basic), on the user's last allowed render.
    if (!daily.isUnlimited && daily.remaining === 1 && !wasWarningShownToday(currentUser.id)) {
      setWarningOpen(true);
      return;
    }
    void handleRemodel();
  };

  const handleWarningContinue = () => {
    if (!currentUser) return;
    markWarningShownToday(currentUser.id);
    setWarningOpen(false);
    void handleRemodel();
  };

  const handleWarningSeePlans = () => {
    setWarningOpen(false);
    onNavigateToPricing?.();
  };

  const handleExceededUpgrade = () => {
    setExceededInfo(null);
    onNavigateToPricing?.();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
        setResultImage(null);
        setGenerationTime(null);
        if (onClearInitial) onClearInitial();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemodel = async () => {
    if (isQuotaReached) return;
    if (!previewUrl || (!instruction.trim() && !selectedStyle)) return;
    if (!currentUser) return;

    setIsProcessing(true);
    setGenerationTime(null);
    setResultImage(null);
    setLastUploadedImageId(null);
    const apiStartTime = Date.now();
    startTimer();

    try {
      const styleContext = selectedStyle ? DESIGN_PRESETS.find(p => p.id === selectedStyle)?.prompt : '';
      const fullInstruction = `${instruction}. ${styleContext}. Budget Target: $${budget}`.trim();
      const result = await remodelImage({
        base64Image: previewUrl,
        instruction: fullInstruction,
        projectName: projectName || 'Untitled Iteration',
      });

      stopTimer();
      const duration = (Date.now() - apiStartTime) / 1000;
      setGenerationTime(duration);
      setResultImage(result.url);
      setLastUploadedImageId(result.imageId);

      onImageGenerated({
        id: result.imageId,
        url: result.url,
        prompt: fullInstruction,
        mode: 'edit',
        timestamp: Date.now(),
        createdAt: Date.now(),
        expiresAt: Date.now(),
        tierAtCreation: currentUser.tier,
        watermarked: result.watermarked,
        projectName: projectName || 'Untitled Iteration',
      } as GeneratedImage);
    } catch (error) {
      stopTimer();
      console.error(error);
      const err = error as { code?: string; message?: string; details?: { reason?: string } };
      if (err.code === 'resource-exhausted' && currentUser) {
        const reason: QuotaExceededReason =
          err.details?.reason === 'monthly_exceeded' ? 'monthly_exceeded' : 'daily_exceeded';
        const daily = getDailyQuotaSnapshot(currentUser);
        const monthly = getMonthlyQuotaSnapshot(currentUser);
        setExceededInfo({
          reason,
          dailyUsed: reason === 'daily_exceeded' && isFinite(daily.limit) ? daily.limit : daily.used,
          dailyLimit: daily.limit,
          monthlyUsed: reason === 'monthly_exceeded' && isFinite(monthly.limit) ? monthly.limit : monthly.used,
          monthlyLimit: monthly.limit,
        });
      } else {
        alert("Something went wrong with the remodel. Please ensure your prompt focuses on home design.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setResultImage(null);
    setSelectedFile(null);
    setProjectName('');
    setGenerationTime(null);
    if (onClearInitial) onClearInitial();
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade">
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
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

      {currentUser && (
        <div className="mb-4">
          <QuotaBadge user={currentUser} onUpgradeClick={onNavigateToPricing} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
                    <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
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
            <h3 className="text-sm font-bold text-google-gray uppercase tracking-wider">Step 2: Design Direction</h3>
            <div className="grid grid-cols-2 gap-3">
              {DESIGN_PRESETS.map((style) => (
                <button
                  key={style.id}
                  disabled={isQuotaReached}
                  onClick={() => setSelectedStyle(prev => prev === style.id ? '' : style.id)}
                  className={`
                    px-3 py-3 text-xs font-semibold border rounded-lg transition-all text-left relative overflow-hidden
                    ${selectedStyle === style.id ? 'bg-google-blue text-google-bg border-google-blue font-bold shadow-lg' : 'bg-google-bg border-google-border text-google-gray hover:text-google-dark hover:bg-google-surface'}
                    ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="relative z-10">{style.label}</span>
                  {style.isTrending && (
                    <div className="absolute top-0 right-0 p-1">
                      <Star size={10} className={selectedStyle === style.id ? 'text-google-bg' : 'text-google-blue'} fill="currentColor" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <textarea
              value={instruction}
              disabled={isQuotaReached}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Refine further: e.g. Swap sofa for velvet sectional, add gold accent lamps..."
              className={`w-full bg-google-bg border border-google-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none min-h-[120px] resize-none text-google-dark placeholder-google-gray leading-relaxed ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            onClick={handleRemodelClick}
            isLoading={isProcessing}
            className={`w-full rounded-xl py-4.5 text-base font-bold ${isQuotaReached ? 'bg-google-gray cursor-not-allowed' : ''}`}
            disabled={!canSubmit}
          >
            <Wand2 className="w-5 h-5 mr-2" />
            {isQuotaReached ? 'Quota Reached' : initialImage ? 'Apply Refinements' : 'Apply Transformations'}
          </Button>
        </div>

        <div className="lg:col-span-8 h-full min-h-[600px] flex flex-col">
          <div className="flex-1 bg-google-surface border border-google-border rounded-[2.5rem] overflow-hidden flex items-center justify-center relative group shadow-lg">
            {resultImage ? (
              <div className="absolute inset-0 w-full h-full">
                <img src={resultImage} alt="Remodeled" className="w-full h-full object-cover" />
                
                {/* Benchmark Indicator */}
                <div className="absolute top-6 left-6 flex flex-col space-y-2 z-10">
                  <div className="bg-google-bg/85 backdrop-blur-xl px-4 py-2 rounded-2xl border border-google-border flex items-center space-x-2 text-google-blue shadow-2xl animate-in slide-in-from-left-4 duration-500">
                    <Zap size={14} className="fill-google-blue" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Engine Benchmark: {generationTime?.toFixed(1)}s</span>
                  </div>
                  <div className="bg-google-bg/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/5 flex items-center space-x-2 text-google-gray">
                    <Clock size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">High Intensity Compute</span>
                  </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-google-bg/95 to-transparent flex items-center justify-center space-x-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20">
                  <Button onClick={() => setIsShopOpen(true)} className="rounded-full bg-google-dark text-google-bg hover:bg-white border-none px-10 py-4 text-sm font-bold shadow-2xl transition-all hover:scale-105 active:scale-95">
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    Shop Furnishings
                  </Button>
                  <button
                    onClick={() => downloadImage(resultImage, 'remodel.png')}
                    className="p-4 bg-google-surface/60 backdrop-blur-md text-google-dark rounded-full hover:bg-google-surface transition-all shadow-xl border border-google-border hover:scale-110 active:scale-90"
                  >
                    <Download size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-20 space-y-8">
                {isProcessing ? (
                  <div className="flex flex-col items-center space-y-10">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-google-border border-t-google-blue rounded-full animate-spin"></div>
                      <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-google-blue animate-pulse" size={24} />
                    </div>
                    <div className="flex flex-col items-center space-y-3">
                       <p className="text-sm font-bold text-google-gray animate-pulse font-mono tracking-[0.3em] uppercase">Redrawing Spatial Architecture</p>
                       <div className="flex items-center space-x-2 px-6 py-2 bg-google-lightBlue rounded-2xl border border-google-blue/20">
                          <Clock size={14} className="text-google-blue" />
                          <span className="text-google-blue font-mono font-black text-2xl tabular-nums">{activeTimer.toFixed(1)}s</span>
                       </div>
                    </div>
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
          {resultImage && currentUser && !feedbackDismissed && (
            <FeedbackForm
              user={currentUser}
              context="remodel-result"
              imageId={lastUploadedImageId}
              onSubmitted={dismissFeedback}
              onDismiss={dismissFeedback}
            />
          )}
        </div>
      </div>

      {currentUser && (
        <PreRenderWarningModal
          isOpen={warningOpen}
          user={currentUser}
          dailyUsed={getDailyQuotaSnapshot(currentUser).used}
          dailyLimit={getDailyQuotaSnapshot(currentUser).limit}
          onContinue={handleWarningContinue}
          onSeePlans={handleWarningSeePlans}
          onClose={() => setWarningOpen(false)}
        />
      )}

      {currentUser && exceededInfo && (
        <QuotaExceededModal
          isOpen={!!exceededInfo}
          user={currentUser}
          reason={exceededInfo.reason}
          dailyUsed={exceededInfo.dailyUsed}
          dailyLimit={exceededInfo.dailyLimit}
          monthlyUsed={exceededInfo.monthlyUsed}
          monthlyLimit={exceededInfo.monthlyLimit}
          onClose={() => setExceededInfo(null)}
          onUpgrade={handleExceededUpgrade}
        />
      )}

      {resultImage && (
        <ShopLookModal
          image={resultImage}
          isOpen={isShopOpen}
          onClose={() => setIsShopOpen(false)}
          budget={budget}
          onSaveProducts={async (products) => {
            if (currentUser && lastUploadedImageId) {
              await saveProductsToImage(currentUser.id, lastUploadedImageId, products);
            }
          }}
        />
      )}
    </div>
  );
};
