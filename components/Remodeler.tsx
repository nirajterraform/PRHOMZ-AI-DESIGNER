
import React, { useState, useRef, useEffect } from 'react';
import { Download, ShoppingBag, Plus, ImageIcon, Wand2, RefreshCcw, Star, Clock, Zap, MoveHorizontal } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { saveProductsToImage } from '../services/galleryService';
import { downloadImage } from '../services/downloadImage';
import { GeneratedImage, DESIGN_PRESETS, UserAccount } from '../types';
import { Button } from './Button';
import { ShopLookModal } from './ShopLookModal';
import { FeedbackForm } from './FeedbackForm';
import { PreRenderWarningModal } from './PreRenderWarningModal';
import { QuotaExceededModal, type QuotaExceededReason } from './QuotaExceededModal';
import {
  isQuotaExhausted,
  getDailyQuotaSnapshot,
  getMonthlyQuotaSnapshot,
} from '../services/quotaService';
import { track } from '../services/analytics';

// Mood swatch per style preset (visual cue in the Design Direction dropdown).
const STYLE_SWATCHES: Record<string, string> = {
  modern: 'linear-gradient(135deg,#2f3b47,#8ab4f8)',
  boho: 'linear-gradient(135deg,#7a4a2c,#d59a63)',
  japandi: 'linear-gradient(135deg,#5c4a38,#cdb79a)',
  coastal: 'linear-gradient(135deg,#3f6f8a,#bfe0ee)',
  industrial: 'linear-gradient(135deg,#26262a,#63636b)',
  transitional: 'linear-gradient(135deg,#6f665c,#dccfc0)',
};
const swatchFor = (id: string) => STYLE_SWATCHES[id] ?? 'linear-gradient(135deg,#3c4043,#6b7075)';

// Default showcase before/after — master-bedroom pair from the prhomzai.com landing gallery.
const LANDING_BEFORE = 'https://files.elfsightcdn.com/eafe4a4d-3436-495d-b748-5bdce62d911d/693f4b74-d27c-424e-b077-f28b534017a9/WhatsApp-Image-2026-04-20-at-2-32-07-PM.jpg';
const LANDING_AFTER = 'https://files.elfsightcdn.com/eafe4a4d-3436-495d-b748-5bdce62d911d/9ff057c5-c1d3-4ed9-95f6-b9833524590d/remodel-28-.png';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
  initialImage?: string | null;
  onClearInitial?: () => void;
  currentUser: UserAccount | null;
  recentImages?: GeneratedImage[];
  onNavigateToPricing?: () => void;
}

export const Remodeler: React.FC<RemodelerProps> = ({
  onImageGenerated,
  initialImage,
  onClearInitial,
  currentUser,
  recentImages = [],
  onNavigateToPricing,
}) => {
  const [, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImage || null);
  const [instruction, setInstruction] = useState('');
  const [projectName] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [budget, setBudget] = useState(5000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [comparePos, setComparePos] = useState(50);
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
  const comparedRef = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Pointer-drag compare (grab anywhere on the image). Kept in a ref so the
  // window listeners below always call the latest closure without rebinding.
  const placeCompareRef = useRef<(clientX: number) => void>(() => {});
  placeCompareRef.current = (clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setComparePos(pct);
    if (!comparedRef.current) { comparedRef.current = true; track('compare_slider_used', { style_id: selectedStyle || 'none' }); }
  };
  useEffect(() => {
    const move = (e: MouseEvent) => { if (draggingRef.current) placeCompareRef.current(e.clientX); };
    const up = () => { draggingRef.current = false; };
    const tmove = (e: TouchEvent) => { if (draggingRef.current && e.touches[0]) placeCompareRef.current(e.touches[0].clientX); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tmove, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', up);
    };
  }, []);

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
    comparedRef.current = false;
    track('generate_design', { style_id: selectedStyle || 'none', budget });
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
      setComparePos(50);
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
    setGenerationTime(null);
    if (onClearInitial) onClearInitial();
  };

  const openShop = () => {
    track('shop_look_open', { style_id: selectedStyle || 'none' });
    setIsShopOpen(true);
  };

  const handleDownload = () => {
    if (!resultImage) return;
    track('download_design', { style_id: selectedStyle || 'none' });
    downloadImage(resultImage, 'remodel.png');
  };

  const strip = recentImages.slice(0, 8);
  const daily = currentUser ? getDailyQuotaSnapshot(currentUser) : null;
  const monthly = currentUser ? getMonthlyQuotaSnapshot(currentUser) : null;

  // Stage model: show the landing sample before/after by default, the uploaded
  // room once chosen, and the before/after wipe once a design is generated.
  const showResult = !!resultImage;
  const isSample = !previewUrl && !resultImage;
  const compareBefore = showResult ? previewUrl : (previewUrl || LANDING_BEFORE);
  const compareAfter = showResult ? resultImage : (previewUrl || LANDING_AFTER);
  const isCompare = showResult ? !!previewUrl : isSample; // two distinct images to wipe between
  const sampleStyleLabel = DESIGN_PRESETS.find(p => p.id === selectedStyle)?.label || 'Modern Chic';
  const steps = [
    { n: 1, label: 'Photo', done: !!previewUrl },
    { n: 2, label: 'Style', done: !!selectedStyle },
    { n: 3, label: 'Generate', done: !!resultImage },
  ];
  const currentStepIdx = steps.findIndex(s => !s.done);

  return (
    <div className="w-full animate-fade">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-serif text-google-dark leading-tight">
            {initialImage ? 'Refine Iteration' : 'Remodel your Space'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {daily && (
            <button
              onClick={onNavigateToPricing}
              className="hidden sm:inline-flex items-center gap-2 text-xs text-google-gray border border-google-border bg-google-surface rounded-lg px-3 py-1.5 hover:border-google-blue/40 transition-colors"
              title="Manage membership"
            >
              <Clock size={13} className="text-google-blue" />
              <span><b className="text-google-dark font-semibold">{daily.isUnlimited ? '∞' : `${daily.used}/${daily.limit}`}</b> today</span>
              {monthly && !monthly.isUnlimited && (
                <span className="text-google-gray/70">· {monthly.used}/{monthly.limit} mo</span>
              )}
            </button>
          )}
          {previewUrl && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-google-gray hover:text-google-dark transition-colors"
            >
              <RefreshCcw size={13} /> <span className="hidden md:inline">Upload New</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ===== condensed control panel ===== */}
        <div className="lg:col-span-3">
          <section className="bg-google-surface border border-google-border rounded-2xl p-3 space-y-2.5 shadow-sm">
            {/* steps 1·2·3 */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              {steps.map((s, i) => {
                const current = currentStepIdx === i;
                return (
                  <React.Fragment key={s.n}>
                    <div className={`flex items-center gap-1.5 ${s.done ? 'text-google-blue' : current ? 'text-google-dark' : 'text-google-gray'}`}>
                      <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${
                        s.done ? 'bg-google-blue text-google-bg' : current ? 'border border-google-blue text-google-blue' : 'border border-google-border'
                      }`}>{s.done ? '✓' : s.n}</span>
                      {s.label}
                    </div>
                    {i < steps.length - 1 && <span className="flex-1 h-px bg-google-border" />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* compact upload — full-width drop */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-google-gray uppercase tracking-wider">Your Room</p>
              <div
                onClick={() => !isQuotaReached && fileInputRef.current?.click()}
                className={`relative w-full h-24 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors border-2 border-dashed
                  ${previewUrl ? 'border-google-blue' : 'border-google-border bg-google-bg hover:bg-google-surface'}
                  ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Room" className="absolute inset-0 w-full h-full object-cover" />
                    {!isQuotaReached && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Change Photo</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-google-surface rounded-full flex items-center justify-center border border-google-border">
                      <Plus className="w-4 h-4 text-google-blue" />
                    </div>
                    <p className="text-xs font-medium text-google-gray">Add a photo <span className="text-google-gray/60">· or drag here</span></p>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>
            </div>

            {/* design direction — swatch grid (green editorial) */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-bold text-google-gray uppercase tracking-wider">Design Direction</p>
                {selectedStyle && <span className="text-[11px] font-semibold text-google-blue">{DESIGN_PRESETS.find(p => p.id === selectedStyle)?.label}</span>}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DESIGN_PRESETS.map((style) => {
                  const on = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      disabled={isQuotaReached}
                      onClick={() => {
                        const next = on ? '' : style.id;
                        if (!on) track('select_style', { style_id: style.id, style_name: style.label });
                        setSelectedStyle(next);
                      }}
                      style={{ background: swatchFor(style.id) }}
                      className={`relative h-12 rounded-xl overflow-hidden border transition-transform hover:-translate-y-0.5 ${
                        on ? 'border-google-blue ring-1 ring-google-blue' : 'border-transparent'
                      } ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                      <span className="absolute left-2 bottom-1.5 text-left text-xs font-semibold text-white drop-shadow">{style.label}</span>
                      {style.isTrending && <Star size={11} className="absolute top-1.5 left-2 text-white/90" fill="currentColor" />}
                      {on && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-google-blue text-google-bg grid place-items-center text-[9px] font-black">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={instruction}
                disabled={isQuotaReached}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Refine: swap sofa for velvet sectional, add gold accent lamps…"
                rows={2}
                className={`w-full bg-google-bg border border-google-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-google-blue focus:outline-none min-h-[40px] resize-none text-google-dark placeholder-google-gray leading-relaxed ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* inline budget */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-google-gray uppercase tracking-wider">Furnishing Budget</p>
                <span className="text-sm font-bold text-google-dark">${budget.toLocaleString()}</span>
              </div>
              <input
                type="range" min="500" max="50000" step="500" value={budget}
                disabled={isQuotaReached}
                onChange={(e) => setBudget(parseInt(e.target.value))}
                className={`w-full cursor-pointer ${isQuotaReached ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            <Button
              onClick={handleRemodelClick}
              isLoading={isProcessing}
              className={`w-full rounded-xl py-3 text-sm font-bold ${isQuotaReached ? 'bg-google-gray cursor-not-allowed' : ''}`}
              disabled={!canSubmit}
            >
              <Wand2 className="w-5 h-5 mr-2" />
              {isQuotaReached ? 'Quota Reached' : initialImage ? 'Apply Refinements' : 'Apply Transformations'}
            </Button>
          </section>
        </div>

        {/* ===== generated-design frame ===== */}
        <div className="lg:col-span-9 flex flex-col gap-3">
          <div className="relative min-h-[440px] lg:h-[calc(100vh-13rem)] lg:max-h-[760px] bg-google-surface border border-google-border rounded-[1.75rem] overflow-hidden flex items-center justify-center shadow-lg">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-google-border border-t-google-blue rounded-full animate-spin" />
                  <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-google-blue animate-pulse" size={24} />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-bold text-google-gray animate-pulse font-mono tracking-[0.3em] uppercase">Redrawing Spatial Architecture</p>
                  <div className="flex items-center gap-2 px-6 py-2 bg-google-lightBlue rounded-2xl border border-google-blue/20">
                    <Clock size={14} className="text-google-blue" />
                    <span className="text-google-blue font-mono font-black text-2xl tabular-nums">{activeTimer.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            ) : (isQuotaReached && !resultImage) ? (
              <div className="opacity-40 flex flex-col items-center gap-5">
                <div className="w-20 h-20 border-2 border-dashed border-google-gray rounded-full flex items-center justify-center">
                  <ImageIcon className="w-9 h-9 text-google-gray" />
                </div>
                <p className="text-sm font-bold text-google-gray uppercase tracking-widest">Daily Quota Reached</p>
              </div>
            ) : (
              /* Unified compare stage — sample by default, upload once chosen,
                 before/after once generated. Pointer-drag anywhere on the image. */
              <div
                ref={frameRef}
                className={`absolute inset-0 select-none ${isCompare ? 'cursor-ew-resize' : ''}`}
                onMouseDown={isCompare ? (e) => { draggingRef.current = true; placeCompareRef.current(e.clientX); e.preventDefault(); } : undefined}
                onTouchStart={isCompare ? (e) => { draggingRef.current = true; if (e.touches[0]) placeCompareRef.current(e.touches[0].clientX); } : undefined}
              >
                {compareAfter && <img src={compareAfter} alt="After" draggable={false} className="absolute inset-0 w-full h-full object-cover" />}
                {isCompare && compareBefore && (
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                    <img src={compareBefore} alt="Before" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                )}

                {isCompare && (
                  <div className="absolute inset-y-0 z-20 pointer-events-none" style={{ left: `${comparePos}%`, transform: 'translateX(-50%)' }}>
                    <div className="w-0.5 h-full bg-white/80 mx-auto" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-google-bg flex items-center justify-center shadow-lg">
                      <MoveHorizontal size={18} />
                    </div>
                  </div>
                )}

                {/* meta chip (top-left) */}
                <div className="absolute top-5 left-5 z-20 pointer-events-none flex items-center gap-2 bg-google-bg/70 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-google-dark">
                  {isSample ? <>Example · <span className="text-google-blue">{sampleStyleLabel}</span></> : <>Your room{selectedStyle ? <> · <span className="text-google-blue">{sampleStyleLabel}</span></> : null}</>}
                </div>

                {isSample && (
                  <span className="absolute top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-[10px] font-black uppercase tracking-widest bg-black/55 text-white px-3 py-1 rounded-lg">Sample · not your room</span>
                )}

                {isCompare && (
                  <span className="absolute bottom-5 left-5 z-20 pointer-events-none text-[10px] font-black uppercase tracking-widest bg-black/55 text-white px-2.5 py-1 rounded-lg">Before</span>
                )}
                {isCompare && (showResult ? (
                  <div className="absolute top-5 right-5 z-20 pointer-events-none flex items-center gap-2 bg-google-bg/85 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-google-border text-google-blue">
                    <Zap size={12} className="fill-google-blue" />
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono">After{generationTime ? ` · ${generationTime.toFixed(1)}s` : ''}</span>
                  </div>
                ) : (
                  <span className="absolute bottom-5 right-5 z-20 pointer-events-none text-[10px] font-black uppercase tracking-widest bg-white/85 text-google-bg px-2.5 py-1 rounded-lg">After</span>
                ))}

                {/* uploaded-but-not-generated hint */}
                {!isCompare && previewUrl && !resultImage && (
                  <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none bg-gradient-to-t from-google-bg/90 to-transparent flex items-center justify-center py-6">
                    <span className="text-sm font-bold text-google-dark uppercase tracking-widest">Ready — press Apply to generate</span>
                  </div>
                )}

                {/* result actions */}
                {showResult && (
                  <div onMouseDown={(e) => e.stopPropagation()} className="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-google-bg/95 to-transparent flex items-center justify-center gap-6 py-6">
                    <Button onClick={openShop} className="rounded-full bg-google-dark text-google-bg hover:bg-white border-none px-8 py-3 text-sm font-bold shadow-2xl">
                      <ShoppingBag className="w-5 h-5 mr-2" /> Shop Furnishings
                    </Button>
                    <button
                      onClick={handleDownload}
                      className="p-3 bg-google-surface/60 backdrop-blur-md text-google-dark rounded-full hover:bg-google-surface transition-all border border-google-border"
                    >
                      <Download size={22} />
                    </button>
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

          {/* iteration filmstrip — the user's recent generations */}
          {strip.length > 0 && (
            <div className="flex-none">
              <p className="text-[10px] font-bold text-google-gray uppercase tracking-wider mb-2">Your Designs</p>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                {strip.map((img) => {
                  const active = resultImage === img.url;
                  return (
                    <button
                      key={img.id}
                      onClick={() => { setResultImage(img.url); setLastUploadedImageId(img.id); setComparePos(50); }}
                      className={`relative flex-none w-24 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        active ? 'border-google-blue ring-2 ring-google-blue/30' : 'border-google-border opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.projectName || 'Design'} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentUser?.tier === 'freemium' && (
            <div className="flex-none flex items-center justify-between gap-4 bg-google-surface border border-google-border rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-google-dark">Keep every design</p>
                <p className="text-xs text-google-gray">Free designs disappear after 7 days. Premium keeps them and lifts your daily limit.</p>
              </div>
              <button onClick={onNavigateToPricing} className="flex-none border border-google-blue text-google-blue rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-google-blue hover:text-google-bg transition-colors">See membership</button>
            </div>
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
