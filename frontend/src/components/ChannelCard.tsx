import React from 'react';
import { Play } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
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
      className={`cursor-pointer group relative bg-slate-800 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 border-2 ${
        isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-transparent hover:border-slate-600'
      }`}
    >
      <div className="aspect-video bg-slate-900 flex items-center justify-center p-4">
        {channel.logo ? (
          <img src={channel.logo} alt={channel.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-4xl font-bold text-slate-700">{channel.name[0]}</div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-12 h-12 text-white fill-current" />
        </div>
      </div>
      <div className="p-3 bg-slate-800">
        <h3 className="text-sm font-medium text-slate-200 truncate">{channel.name}</h3>
      </div>
    </div>
  );
};

export default ChannelCard;
