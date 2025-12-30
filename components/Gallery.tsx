
import React from 'react';
import { GeneratedImage } from '../types';
import { Download, Calendar, ArrowUpRight, Maximize2 } from 'lucide-react';

interface GalleryProps {
  images: GeneratedImage[];
}

export const Gallery: React.FC<GalleryProps> = ({ images }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-brand-700 animate-fade-in">
        <div className="w-20 h-20 rounded-full border border-brand-800 flex items-center justify-center mb-6 opacity-40">
           <Maximize2 size={30} />
        </div>
        <h3 className="font-serif text-3xl italic mb-3">Portfolio Empty</h3>
        <p className="text-xs font-bold uppercase tracking-[0.3em]">Initialize a render to build your history</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 animate-fade-in">
       <div className="space-y-3">
        <h2 className="text-5xl font-serif font-bold text-white tracking-tight">Your <span className="italic text-brand-400">Archive</span></h2>
        <div className="flex items-center space-x-3 text-brand-500">
          <div className="h-px w-10 bg-brand-500"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em]">{images.length} Captured Visualizations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {images.slice().reverse().map((img) => (
          <div key={img.id} className="group glass-card rounded-[2rem] overflow-hidden border border-white/5 hover:border-brand-500/40 transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="aspect-[4/3] w-full overflow-hidden bg-brand-950 relative">
              <img 
                src={img.url} 
                alt={img.prompt} 
                className="w-full h-full object-cover transition-transform duration-1000 cubic-bezier(0.16, 1, 0.3, 1) group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center space-x-4">
                 <a 
                    href={img.url} 
                    download={`prhomz-${img.id}.png`}
                    className="p-4 bg-white text-brand-950 rounded-full hover:bg-brand-100 transition-all transform translate-y-4 group-hover:translate-y-0 duration-500 hover:scale-110 shadow-2xl"
                  >
                    <Download size={20} />
                  </a>
                  <button className="p-4 bg-brand-500 text-white rounded-full hover:bg-brand-400 transition-all transform translate-y-6 group-hover:translate-y-0 duration-700 hover:scale-110 shadow-2xl">
                    <Maximize2 size={20} />
                  </button>
              </div>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  <span className="px-2 py-0.5 border border-brand-800 rounded">{img.mode}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-brand-600 text-[10px] font-bold uppercase tracking-widest">
                  <Calendar size={10} />
                  <span>{new Date(img.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-brand-100 font-serif text-xl line-clamp-2 leading-snug group-hover:text-white transition-colors">
                  {img.prompt}
                </p>
                <button className="text-[10px] text-brand-500 font-bold uppercase tracking-widest flex items-center group/btn hover:text-brand-300 transition-colors">
                   View Prompt Details <ArrowUpRight className="ml-1 w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
