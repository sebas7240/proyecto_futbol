import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AdBannerProps {
  slotId?: string;
  format: 'horizontal' | 'vertical' | 'overlay';
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ format, className = "" }) => {
  const [isVisible, setIsVisible] = useState(true);
  const SMART_LINK = "https://www.effectivecpmnetwork.com/dhut61az?key=d1d0673cc13bbff6e2fdb6f6885ca515";

  useEffect(() => {
    // Solo cargamos el script de Adsterra para el formato horizontal (Native Banner)
    if (format === 'horizontal' && isVisible) {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = "https://pl29623793.effectivecpmnetwork.com/309760bc253aa931b97b78c5f29642b7/invoke.js";
      
      const container = document.getElementById('ad-container-native');
      if (container) {
        container.innerHTML = '<span class="text-[10px] text-slate-600 uppercase tracking-widest mb-1 font-bold block">Publicidad Recomendada</span><div id="container-309760bc253aa931b97b78c5f29642b7"></div>';
        container.appendChild(script);
      }
    }
  }, [format, isVisible]);

  if (!isVisible) return null;

  const styles = {
    horizontal: "w-full min-h-[150px] bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center overflow-hidden",
    vertical: "w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-center overflow-hidden",
    overlay: "absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-md bg-slate-900/90 border border-blue-500/30 rounded-lg p-3 shadow-2xl backdrop-blur-md"
  };

  const handleAdClick = () => {
    window.open(SMART_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`${styles[format]} ${className} relative group`}>
      {format === 'overlay' && (
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="text-center w-full">
        {format === 'overlay' ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 animate-bounce">
              <span className="font-bold text-white text-xl">!</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white">¿Quién ganará el Mundial?</p>
              <p className="text-[10px] text-blue-400 font-medium">Apuesta en vivo y gana el doble hoy</p>
              <button 
                onClick={handleAdClick}
                className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-[10px] font-bold rounded text-white transition-colors cursor-pointer"
              >
                APOSTAR AHORA
              </button>
            </div>
          </div>
        ) : format === 'horizontal' ? (
          <div id="ad-container-native" className="w-full">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest mb-1 font-bold block">Publicidad Recomendada</span>
            <div id="container-309760bc253aa931b97b78c5f29642b7"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest mb-1 font-bold">Publicidad</span>
            <div className="text-slate-500 text-xs italic">
              Espacio Publicitario
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
