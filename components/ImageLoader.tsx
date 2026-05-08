import React from 'react';

interface ImageLoaderProps {
  message: string;
}

const ImageLoader: React.FC<ImageLoaderProps> = ({ message }) => (
  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 text-center p-2">
    <div className="w-full h-full border-2 border-dashed border-slate-400/50 rounded-md flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/50 border-t-cyan-400 rounded-full animate-spin"></div>
      <p className="text-xs text-white mt-2 font-semibold">{message}</p>
    </div>
  </div>
);

export default ImageLoader;