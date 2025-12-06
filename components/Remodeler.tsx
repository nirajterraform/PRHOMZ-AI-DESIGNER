import React, { useState, useRef } from 'react';
import { Upload, Paintbrush, Download, ArrowRight } from 'lucide-react';
import { remodelImage } from '../services/geminiService';
import { GeneratedImage } from '../types';
import { Button } from './Button';

interface RemodelerProps {
  onImageGenerated: (image: GeneratedImage) => void;
}

export const Remodeler: React.FC<RemodelerProps> = ({ onImageGenerated }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
        setResultImage(null); // Clear previous result
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemodel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl || !instruction.trim()) return;

    setIsProcessing(true);
    try {
      const outputBase64 = await remodelImage(previewUrl, instruction);
      setResultImage(outputBase64);

      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: outputBase64,
        prompt: `Edited: ${instruction}`,
        mode: 'edit',
        timestamp: Date.now()
      };
      onImageGenerated(newImage);
    } catch (error) {
      alert("Failed to remodel image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-serif font-bold text-white">Room Remodeler</h2>
        <p className="text-brand-300">Upload a photo and give instructions to transform it.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Input Section */}
        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all
              ${previewUrl 
                ? 'border-brand-700 bg-brand-950' 
                : 'border-brand-600 bg-brand-900/30 hover:bg-brand-900/50 hover:border-brand-500'}
            `}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Original" className="w-full h-full object-contain rounded-xl p-2" />
            ) : (
              <div className="text-center p-6 space-y-2 text-brand-400">
                <Upload className="w-10 h-10 mx-auto mb-2" />
                <p className="font-medium">Click to upload photo</p>
                <p className="text-xs text-brand-500">JPG, PNG up to 5MB</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden" 
            />
          </div>

          <form onSubmit={handleRemodel} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="E.g., Change the wall color to sage green"
                className="w-full bg-brand-900 border border-brand-700 rounded-lg py-3 px-4 pr-12 text-white placeholder-brand-600 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <Paintbrush className="absolute right-4 top-3.5 w-5 h-5 text-brand-500" />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              isLoading={isProcessing}
              disabled={!previewUrl || !instruction.trim()}
            >
              Transform Space
            </Button>
          </form>
        </div>

        {/* Result Section */}
        <div className="space-y-4">
          <div className="h-64 lg:h-[400px] bg-brand-950 rounded-2xl border border-brand-800 flex items-center justify-center relative overflow-hidden group">
            {resultImage ? (
              <>
                 <img src={resultImage} alt="Remodeled" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a 
                      href={resultImage} 
                      download={`prhomz-remodel-${Date.now()}.png`}
                      className="inline-flex items-center px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-400 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Image
                    </a>
                  </div>
              </>
            ) : (
              <div className="text-brand-700 text-center p-8">
                {isProcessing ? (
                  <div className="space-y-4 animate-pulse">
                     <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                     <p>Redesigning your space...</p>
                  </div>
                ) : (
                  <>
                    <ArrowRight className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>The transformed result will appear here</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};