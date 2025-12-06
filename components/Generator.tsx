import React, { useState } from 'react';
import { Sparkles, Download, RefreshCw } from 'lucide-react';
import { generateDesignImage } from '../services/geminiService';
import { AspectRatio, GeneratedImage } from '../types';
import { Button } from './Button';

interface GeneratorProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Generator: React.FC<GeneratorProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const base64Image = await generateDesignImage(prompt, aspectRatio);
      setCurrentImage(base64Image);
      
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: base64Image,
        prompt: prompt,
        mode: 'creation',
        timestamp: Date.now()
      };
      
      onImageGenerated(newImage);
    } catch (error) {
      alert("Failed to generate design. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (currentImage) {
      const link = document.createElement('a');
      link.href = currentImage;
      link.download = `prhomz-design-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold text-white">Design Creation</h2>
        <p className="text-brand-300">Visualize your dream space with AI-powered generation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <form onSubmit={handleGenerate} className="space-y-6 bg-brand-900/50 p-6 rounded-2xl border border-brand-800">
            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-200">Describe your vision</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., A minimalist living room with floor-to-ceiling windows overlooking a forest, warm lighting, beige sectional sofa..."
                className="w-full h-32 bg-brand-950 border border-brand-700 rounded-lg p-4 text-white placeholder-brand-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-200">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {(['16:9', '1:1', '9:16'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`
                      py-2 px-3 rounded-md text-sm font-medium transition-colors
                      ${aspectRatio === ratio 
                        ? 'bg-brand-700 text-white border border-brand-500' 
                        : 'bg-brand-950 text-brand-400 border border-brand-800 hover:border-brand-600'}
                    `}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-3" 
              isLoading={isGenerating}
              disabled={!prompt.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Design
            </Button>
          </form>

          {/* Inspiration Tags */}
          <div className="flex flex-wrap gap-2">
            {['Modern Rustic', 'Scandinavian', 'Industrial Loft', 'Japandi', 'Art Deco'].map(tag => (
              <button
                key={tag}
                onClick={() => setPrompt(prev => prev + (prev ? ' ' : '') + tag)}
                className="px-3 py-1 bg-brand-900/30 text-xs text-brand-400 rounded-full border border-brand-800 hover:bg-brand-800 hover:text-brand-200 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="relative group min-h-[400px] flex items-center justify-center bg-brand-950 rounded-2xl border-2 border-dashed border-brand-800 overflow-hidden">
          {currentImage ? (
            <div className="relative w-full h-full">
              <img 
                src={currentImage} 
                alt="Generated Design" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                <Button variant="secondary" onClick={downloadImage}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-brand-600 p-8">
              {isGenerating ? (
                <div className="animate-pulse space-y-4">
                  <div className="w-16 h-16 bg-brand-800 rounded-full mx-auto"></div>
                  <div className="text-sm">Creating your masterpiece...</div>
                </div>
              ) : (
                <>
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your design will appear here</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};