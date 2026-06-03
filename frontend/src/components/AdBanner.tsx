import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AdBannerProps {
  slotId?: string;
  format: 'horizontal' | 'vertical' | 'overlay';
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ format, className = "" }) => {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const SMART_LINK = "https://formssternlystately.com/ds7rafqk8?key=147d22bbab5806fd51aabf69daa4a76f";

  useEffect(() => {
    if (format === 'horizontal' && isVisible && containerRef.current) {
      // Usamos un pequeño delay para asegurar que el móvil haya renderizado el div
      const timer = setTimeout(() => {
        if (!containerRef.current) return;
        
        containerRef.current.innerHTML = '';
        
        const adDiv = document.createElement('div');
        adDiv.id = "container-309760bc253aa931b97b78c5f29642b7";
        containerRef.current.appendChild(adDiv);

        const script = document.createElement('script');
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        script.src = "https://pl29623793.effectivecpmnetwork.com/309760bc253aa931b97b78c5f29642b7/invoke.js";
        containerRef.current.appendChild(script);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [format, isVisible]);

  if (!isVisible) return null;

  const styles = {
    horizontal: "w-full min-h-[160px] bg-slate-800/20 border border-slate-700/30 rounded-xl flex flex-col items-center justify-center p-2 mb-4",
    vertical: "w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-center overflow-hidden",
    overlay: "absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-md bg-slate-900 border border-blue-500/50 rounded-lg p-3 shadow-[0_0_30px_rgba(30,64,175,0.5)] backdrop-blur-xl"
  };

  const handleAdClick = () => {
    window.open(SMART_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`${styles[format]} ${className} relative`}>
      {format === 'overlay' && (
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute -top-3 -right-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg hover:bg-red-700 z-50 transition-transform active:scale-90"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="text-center w-full">
        {format === 'overlay' ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 animate-pulse">
              <span className="font-extrabold text-white text-xl italic">!</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white uppercase tracking-tight">¿Quién ganará el Mundial?</p>
              <p className="text-[10px] text-blue-300 font-medium">Bonos exclusivos de bienvenida hoy</p>
              <button 
                onClick={handleAdClick}
                className="mt-1.5 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-[11px] font-black rounded-md text-white transition-all shadow-lg shadow-blue-900/40 uppercase cursor-pointer"
              >
                APOSTAR AHORA
              </button>
            </div>
          </div>
        ) : format === 'horizontal' ? (
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-[1px] w-8 bg-slate-700"></div>
                <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-bold">Publicidad Recomendada</span>
                <div className="h-[1px] w-8 bg-slate-700"></div>
            </div>
            <div ref={containerRef} className="w-full flex justify-center items-center min-h-[120px]">
              {/* Adsterra script will mount here */}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest mb-1 font-bold">Publicidad</span>
            <div className="text-slate-500 text-xs italic">Espacio Publicitario</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
