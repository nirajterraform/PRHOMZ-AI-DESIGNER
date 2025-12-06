import React from 'react';
import { GeneratedImage } from '../types';
import { Download } from 'lucide-react';

interface GalleryProps {
  images: GeneratedImage[];
}

export const Gallery: React.FC<GalleryProps> = ({ images }) => {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-brand-400">
        <p className="font-serif text-xl mb-2">Gallery Empty</p>
        <p className="text-sm">Generate designs to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-serif font-bold text-white">Your Collection</h2>
        <p className="text-brand-300">A history of your architectural visualizations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.slice().reverse().map((img) => (
          <div key={img.id} className="group relative bg-brand-900 rounded-xl overflow-hidden border border-brand-800 hover:border-brand-600 transition-all">
            <div className="aspect-[16/9] w-full overflow-hidden bg-brand-950">
              <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-brand-800 text-brand-300`}>
                  {img.mode}
                </span>
                <span className="text-xs text-brand-500">
                  {new Date(img.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-brand-200 line-clamp-2" title={img.prompt}>
                {img.prompt}
              </p>
            </div>

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <a 
                href={img.url} 
                download={`prhomz-${img.id}.png`}
                className="pointer-events-auto p-3 bg-white text-brand-900 rounded-full hover:bg-brand-100 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300"
                title="Download"
              >
                <Download size={20} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};