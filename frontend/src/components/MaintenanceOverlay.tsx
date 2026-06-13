import React from 'react';
import { MessageCircle, ShieldAlert, Timer } from 'lucide-react';

interface MaintenanceOverlayProps {
  headline: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
}

const MaintenanceOverlay: React.FC<MaintenanceOverlayProps> = ({ headline, description, buttonText, buttonUrl }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-blue-600 rounded-2xl flex items-center justify-center border-2 border-blue-500 shadow-xl shadow-blue-500/20">
            <img src="/assets/logo.png" alt="Golea Logo" className="h-full w-full object-contain p-2" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white italic tracking-tighter">GOLEA <span className="text-blue-500 font-bold not-italic text-sm ml-1 uppercase tracking-widest">Premium</span></h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <ShieldAlert className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest text-balance">Pausa Técnica Preventiva</span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-slate-200 font-bold leading-relaxed">
            <span className="text-blue-400">{headline}</span>
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700/50 space-y-4">
          <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-widest">
            <Timer className="w-4 h-4 text-blue-400" />
            ¿Cuándo volvemos?
          </div>
          <p className="text-slate-400 text-[11px]">
            Estaremos informando la fecha de reapertura exclusivamente a través de nuestra comunidad oficial.
          </p>
          <a 
            href={buttonUrl}
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-[#229ED9] hover:bg-[#1d8dbf] text-white py-3 px-6 rounded-xl font-black transition-all hover:scale-105 shadow-lg shadow-blue-500/20 group"
          >
            <MessageCircle className="w-5 h-5" />
            {buttonText}
          </a>
        </div>

        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
          Gracias por su lealtad y comprensión.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;
