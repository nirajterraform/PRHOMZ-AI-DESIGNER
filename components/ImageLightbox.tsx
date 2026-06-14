import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ url, alt, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 p-3 bg-google-surface/80 backdrop-blur-md rounded-full text-google-dark hover:bg-google-surface transition-all shadow-xl border border-google-border z-10"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt || "Design preview"}
        className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
