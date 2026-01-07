
import React from 'react';
import { GeneratedImage } from '../types';
import { Download, Calendar, ArrowUpRight, Maximize2, Trash2 } from 'lucide-react';

interface GalleryProps { images: GeneratedImage[]; }

export const Gallery: React.FC<GalleryProps> = ({ images }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-google-gray animate-fade">
        <div className="w-20 h-20 rounded-full border border-google-border flex items-center justify-center mb-6 opacity-60 bg-google-surface">
           <Maximize2 size={24} className="text-google-blue" />
        </div>
        <h3 className="text-2xl font-medium text-google-dark mb-2">No iterations found</h3>
        <p className="text-sm font-medium uppercase tracking-widest text-google-gray">Generate a remodel to begin your archive</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-fade">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-google-dark">Spatial Archive</h2>
        <p className="text-sm font-medium text-google-gray uppercase tracking-widest">{images.length} Captured designs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {images.slice().reverse().map((img) => (
          <div key={img.id} className="group bg-google-surface rounded-2xl overflow-hidden border border-google-border hover:border-google-blue transition-all duration-300 shadow-md hover:shadow-xl">
            <div className="aspect-[4/3] w-full overflow-hidden bg-google-bg relative">
              <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90" />
              <div className="absolute inset-0 bg-google-bg/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                 <a href={img.url} download={`prhomz-${img.id}.png`} className="p-3 bg-google-dark text-google-bg rounded-full hover:bg-white transition-all shadow-lg"><Download size={20} /></a>
                 <button className="p-3 bg-google-dark text-google-bg rounded-full hover:bg-white transition-all shadow-lg"><Maximize2 size={20} /></button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-google-gray">
                <span className="px-2 py-0.5 bg-google-bg border border-google-border rounded-md text-google-blue">{img.mode}</span>
                <div className="flex items-center space-x-1"><Calendar size={12} /><span>{new Date(img.timestamp).toLocaleDateString()}</span></div>
              </div>
              
              <div className="space-y-3">
                <p className="text-google-dark text-sm line-clamp-2 leading-snug group-hover:text-google-blue transition-colors">{img.prompt}</p>
                <div className="flex items-center justify-between pt-4 border-t border-google-border">
                   <button className="text-[10px] text-google-gray font-bold uppercase tracking-widest flex items-center hover:text-google-blue transition-all">Details <ArrowUpRight className="ml-1 w-3 h-3" /></button>
                   <button className="text-google-gray hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
