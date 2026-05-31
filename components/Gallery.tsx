import React, { useState } from 'react';
import { GeneratedImage, ProductItem, UserTier } from '../types';
import { Download, Calendar, ArrowUpRight, Maximize2, Trash2, Edit3, FolderOpen, ShoppingBag, X, ExternalLink, Package, ShoppingCart, Sparkles, Crown, Archive, AlertTriangle } from 'lucide-react';
import { SHOPIFY_STORE_URL } from '../services/dataService';
import { ExpiryChip } from './ExpiryChip';
import { RETENTION_DAYS_BY_TIER } from '../services/galleryService';
import { applySlotCap } from '../services/gallerySlotsService';
import { downloadImage } from '../services/downloadImage';

interface GalleryProps {
  images: GeneratedImage[];
  onEdit: (url: string) => void;
  tier: UserTier;
  isLoading?: boolean;
  onNavigateToPricing?: () => void;
}

const TIER_LABEL: Record<UserTier, string> = {
  freemium: 'Freemium',
  basic: 'Basic',
  advanced: 'Advanced',
  designer: 'Designer',
};

export const Gallery: React.FC<GalleryProps> = ({ images, onEdit, tier, isLoading, onNavigateToPricing }) => {
  const [viewingProducts, setViewingProducts] = useState<GeneratedImage | null>(null);

  const handleSourcingAction = (item: ProductItem) => {
    if (item.productUrl) window.open(item.productUrl, '_blank');
    else window.open(`${SHOPIFY_STORE_URL}/search?q=${encodeURIComponent(item.name)}`, '_blank');
  };

  const retentionDays = RETENTION_DAYS_BY_TIER[tier];
  const retentionLabel = retentionDays === 1 ? '24 hours' : `${retentionDays} days`;

  const slotState = applySlotCap(images, tier);
  const { visibleImages, hiddenCount, limit, totalImages, isUnlimited, isOverCapacity, isAtCapacity } = slotState;

  if (isLoading) {
    return (
      <div className="space-y-12 pb-20 animate-fade">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-google-dark">Spatial Archive</h2>
          <p className="text-sm font-medium text-google-gray uppercase tracking-widest">Loading...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-google-surface rounded-2xl border border-google-border overflow-hidden">
              <div className="aspect-[4/3] w-full bg-google-bg animate-pulse" />
              <div className="p-6 space-y-3">
                <div className="h-3 w-1/3 bg-google-bg animate-pulse rounded" />
                <div className="h-4 w-full bg-google-bg animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-google-gray animate-fade">
        <div className="w-20 h-20 rounded-full border border-google-border flex items-center justify-center mb-6 opacity-60 bg-google-surface">
          <Maximize2 size={24} className="text-google-blue" />
        </div>
        <h3 className="text-2xl font-medium text-google-dark mb-2">No iterations found</h3>
        <p className="text-sm font-medium uppercase tracking-widest text-google-gray mb-8">
          Generate a remodel to begin your archive
        </p>
        {tier === 'freemium' && (
          <div className="bg-google-surface border border-google-border rounded-2xl px-6 py-4 flex items-center space-x-3 max-w-md">
            <Crown size={18} className="text-google-blue flex-shrink-0" />
            <p className="text-xs text-google-gray leading-relaxed">
              On Freemium, designs auto-delete after 24 hours. Upgrade to keep your work for up to 30 days.
            </p>
          </div>
        )}
      </div>
    );
  }

  const slotIndicatorClass = isOverCapacity
    ? 'bg-red-400/10 border-red-400/30 text-red-400'
    : isAtCapacity
      ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-600'
      : 'bg-google-surface border-google-border text-google-gray';

  return (
    <div className="space-y-12 pb-20 animate-fade">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-google-dark">Spatial Archive</h2>
          <p className="text-sm font-medium text-google-gray uppercase tracking-widest">
            {visibleImages.length} captured design{visibleImages.length === 1 ? '' : 's'}
            {hiddenCount > 0 && (
              <span className="ml-2 normal-case tracking-normal text-google-gray/80">
                ({hiddenCount} hidden)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isUnlimited && (
            <div className={`rounded-2xl border px-4 py-3 flex items-center space-x-3 ${slotIndicatorClass}`}>
              <Archive size={16} className="flex-shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest tabular-nums">
                {totalImages} / {limit} slots
              </p>
            </div>
          )}
          <div className="bg-google-surface border border-google-border rounded-2xl px-4 py-3 flex items-center space-x-3 max-w-md">
            <Sparkles size={16} className="text-google-blue flex-shrink-0" />
            <p className="text-xs text-google-gray font-medium">
              Images auto-delete after <span className="text-google-dark font-bold">{retentionLabel}</span> on your{' '}
              <span className="text-google-blue font-bold uppercase tracking-wider">{TIER_LABEL[tier]}</span> plan.
            </p>
          </div>
        </div>
      </div>

      {isOverCapacity && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-google-dark mb-0.5">
                {hiddenCount} older design{hiddenCount === 1 ? '' : 's'} hidden
              </p>
              <p className="text-xs text-google-gray leading-relaxed">
                Your {TIER_LABEL[tier]} plan shows the {limit} newest design{limit === 1 ? '' : 's'}.
                Upgrade to keep more iterations visible at once.
              </p>
            </div>
          </div>
          {onNavigateToPricing && (
            <button
              onClick={onNavigateToPricing}
              className="px-5 py-2.5 rounded-xl bg-google-blue text-google-bg font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98] flex items-center space-x-2 whitespace-nowrap"
            >
              <Sparkles size={14} />
              <span>See plans</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {visibleImages.map((img) => (
          <div
            key={img.id}
            className="group bg-google-surface rounded-2xl overflow-hidden border border-google-border hover:border-google-blue transition-all duration-300 shadow-md hover:shadow-xl flex flex-col"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-google-bg relative">
              <img
                src={img.thumbnailUrl ?? img.url}
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90"
              />
              <div className="absolute inset-0 bg-google-bg/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                <button
                  onClick={() => onEdit(img.url)}
                  className="p-3 bg-google-blue text-google-bg rounded-full hover:brightness-110 transition-all shadow-lg flex items-center justify-center"
                  title="Refine Design"
                >
                  <Edit3 size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => downloadImage(img.url, `prhomz-${img.id}.png`)}
                  className="p-3 bg-google-dark text-google-bg rounded-full hover:bg-white transition-all shadow-lg"
                  title={img.watermarked ? 'Freemium exports will include a watermark — upgrade to remove' : 'Download'}
                >
                  <Download size={20} />
                </button>
              </div>
              <div className="absolute top-4 left-4 bg-google-bg/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-google-border flex items-center space-x-2">
                <FolderOpen size={12} className="text-google-blue" />
                <span className="text-[10px] font-bold text-google-dark truncate max-w-[120px] uppercase tracking-wider">
                  {img.projectName || 'Project Untitled'}
                </span>
              </div>
              <div className="absolute top-4 right-4 flex flex-col items-end space-y-1.5">
                <ExpiryChip expiresAt={img.expiresAt} />
                {img.watermarked && (
                  <div className="inline-flex items-center px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest">
                    Watermark
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-google-gray">
                  <span className="px-2 py-0.5 bg-google-bg border border-google-border rounded-md text-google-blue">
                    {img.mode === 'edit' ? 'Refinement' : 'New Creation'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Calendar size={12} />
                    <span>{new Date(img.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="text-google-dark text-sm line-clamp-2 leading-snug group-hover:text-google-blue transition-colors h-10">
                  {img.prompt}
                </p>
              </div>

              <div className="pt-4 border-t border-google-border space-y-4">
                {img.savedProducts && img.savedProducts.length > 0 && (
                  <button
                    onClick={() => setViewingProducts(img)}
                    className="w-full py-2.5 bg-google-blue/10 border border-google-blue/20 rounded-xl flex items-center justify-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-google-blue hover:bg-google-blue hover:text-google-bg transition-all"
                  >
                    <ShoppingBag size={14} />
                    <span>View {img.savedProducts.length} Sourced Pieces</span>
                  </button>
                )}

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onEdit(img.url)}
                    className="text-[10px] text-google-gray font-bold uppercase tracking-widest flex items-center hover:text-google-blue transition-all"
                  >
                    Remodel Iteration <ArrowUpRight className="ml-1 w-3 h-3" />
                  </button>
                  <Trash2 size={14} className="text-google-gray opacity-30 cursor-not-allowed" aria-disabled />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewingProducts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade">
          <div className="bg-google-surface w-full max-w-2xl max-h-[85vh] rounded-[2rem] border border-google-border shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 border-b border-google-border flex items-center justify-between bg-google-bg/30">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-google-blue/10 flex items-center justify-center text-google-blue border border-google-blue/20">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-google-dark">Sourced Artifacts</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-google-gray">
                    {viewingProducts.projectName || 'Iteration'} • {viewingProducts.savedProducts?.length} Items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingProducts(null)}
                className="p-3 bg-google-bg rounded-full text-google-gray hover:text-google-dark hover:bg-google-border transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {viewingProducts.savedProducts?.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-google-bg border border-google-border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between group hover:border-google-blue transition-all space-y-4 md:space-y-0"
                >
                  <div className="flex items-center space-x-5 flex-1 w-full">
                    <div className="w-16 h-16 bg-google-surface rounded-xl flex items-center justify-center border border-google-border text-google-blue overflow-hidden flex-shrink-0 shadow-inner">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-google-dark truncate text-base">{item.name}</h4>
                      <div className="flex items-center space-x-3 mt-1">
                        <p className="text-lg font-black text-google-blue">${item.price.toLocaleString()}</p>
                        {item.isSynced && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-google-blue/10 text-google-blue border border-google-blue/20">
                            Source Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button
                      onClick={() => handleSourcingAction(item)}
                      className="flex-1 md:flex-none px-6 py-3 bg-google-blue text-google-bg rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center shadow-lg hover:brightness-110 transition-all hover:scale-105"
                    >
                      <ShoppingCart size={16} className="mr-2" /> Buy Now
                    </button>
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-google-surface text-google-gray border border-google-border rounded-xl hover:text-google-blue hover:bg-google-bg transition-all"
                      title="View Details"
                    >
                      <ExternalLink size={18} />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-google-border bg-google-bg/30 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left w-full sm:w-auto">
                <p className="text-[10px] font-bold text-google-gray uppercase tracking-widest mb-1">Curation Manifest Total</p>
                <p className="text-3xl font-black text-google-dark">
                  ${viewingProducts.savedProducts?.reduce((acc, curr) => acc + curr.price, 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(viewingProducts.savedProducts, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `sourcing-manifest-${viewingProducts.id}.json`;
                  link.click();
                }}
                className="w-full sm:w-auto px-8 py-4 bg-google-dark text-google-bg rounded-2xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all"
              >
                Download Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
