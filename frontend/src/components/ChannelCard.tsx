import React from 'react';
import { Play, Tv } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
}

interface ChannelCardProps {
  channel: Channel;
  onSelect: (channel: Channel) => void;
  isSelected: boolean;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onSelect, isSelected }) => {
  return (
    <div 
      onClick={() => onSelect(channel)}
      className={`cursor-pointer group relative bg-slate-800 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 border-2 ${
        isSelected 
        ? 'border-blue-500 shadow-2xl shadow-blue-500/30 ring-4 ring-blue-500/10' 
        : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-750 shadow-lg'
      }`}
    >
      <div className="aspect-video bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/0 to-blue-600/0 group-hover:from-blue-600/10 group-hover:to-transparent transition-all duration-500"></div>
        
        {channel.logo ? (
          <img 
            src={channel.logo} 
            alt={channel.name} 
            className="max-h-full max-w-full object-contain relative z-10 transition-transform duration-500 group-hover:scale-110" 
          />
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-2">
            <Tv className={`w-12 h-12 ${isSelected ? 'text-blue-500' : 'text-slate-600'} transition-colors group-hover:text-blue-400`} />
          </div>
        )}
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-blue-600 p-4 rounded-full shadow-xl transform scale-50 group-hover:scale-100 transition-all duration-300">
            <Play className="w-8 h-8 text-white fill-current" />
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className="absolute top-3 right-3 flex gap-2">
            <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
        </div>
      </div>
      
      <div className="p-4 bg-slate-800 border-t border-slate-700/50">
        <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">
          {channel.category}
        </p>
        <h3 className={`text-base font-bold truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-100 group-hover:text-white'}`}>
          {channel.name}
        </h3>
      </div>
    </div>
  );
};

export default ChannelCard;
