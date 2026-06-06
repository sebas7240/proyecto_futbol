import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Tv, Loader2, AlertCircle, Search, Globe, ChevronRight, MessageCircle, Calendar, Clock, PlayCircle, Star, History, RefreshCw, Radio, Users } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import AdBanner from './components/AdBanner';
import ChatPanel from './components/ChatPanel';

interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
}

interface AgendaEvent {
  category: string;
  link?: string;
  dateLabel?: string;
  title: string;
  time: string;
  status: string;
  language: string;
  channelId: string | null;
  date: string;
}

interface PresenceCounts {
  total: number;
  channels: Record<string, number>;
  ttlSeconds?: number;
  updatedAt?: number;
}

const API_URL = process.env.REACT_APP_API_URL || '/api';
const CHAT_URL = process.env.REACT_APP_CHAT_URL || 'https://golea-chat.sebas7240.workers.dev';
const APP_BUILD_MARKER = 'presence-counters-2026-06-06';
const PRESENCE_HEARTBEAT_MS = 25000;
const PRESENCE_COUNTS_MS = 20000;

function getOrCreatePresenceSessionId(): string {
  const key = 'golea_presence_session';
  const sessionId = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    localStorage.setItem(key, sessionId);
  } catch {
    return sessionId;
  }

  return sessionId;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getPresenceChannelKey(channelId: string): string {
  return `ch-${hashString(channelId)}`;
}

function formatViewerCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'channels' | 'agenda' | 'chat'>('channels');
  const [searchTerm, setSearchTerm] = useState('');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Sincronizando señal en vivo...');
  const [error, setError] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [presenceSessionId] = useState(getOrCreatePresenceSessionId);
  const [presenceCounts, setPresenceCounts] = useState<PresenceCounts>({ total: 0, channels: {} });
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('golea_favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [recentChannelIds, setRecentChannelIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('golea_recent') || '[]');
    } catch {
      return [];
    }
  });

  const loadingMessages = [
    'Sincronizando señal en vivo...',
    'Lanzando instancia de servidor...',
    'Capturando fragmentos de video...',
    'Sincronizando audio y video...',
    'Preparando buffer de alta calidad...',
    'La carga puede tardar hasta 30 segundos, espera un poco...'
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (loadingStream) {
      let i = 0;
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[i]);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [loadingStream]);

  useEffect(() => {
    fetchChannels();
    fetchAgenda();

    const refresh = setInterval(() => {
      fetchChannels(true);
      fetchAgenda(true);
    }, 300000);

    return () => clearInterval(refresh);
  }, []);

  const selectedPresenceChannelKey = useMemo(() => {
    return selectedChannel ? getPresenceChannelKey(selectedChannel.id) : null;
  }, [selectedChannel]);

  const presenceChannelKeys = useMemo(() => {
    return Array.from(new Set(channels.map(channel => getPresenceChannelKey(channel.id)))).slice(0, 80);
  }, [channels]);

  useEffect(() => {
    const sendPresence = async () => {
      if (document.hidden) return;

      try {
        await axios.post(`${CHAT_URL}/presence`, {
          sessionId: presenceSessionId,
          channelId: selectedPresenceChannelKey
        }, {
          timeout: 8000
        });
      } catch (err) {
        console.debug('Presence heartbeat failed:', err);
      }
    };

    sendPresence();
    const heartbeat = setInterval(sendPresence, PRESENCE_HEARTBEAT_MS);
    const handleVisibility = () => {
      if (!document.hidden) sendPresence();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [presenceSessionId, selectedPresenceChannelKey]);

  useEffect(() => {
    const fetchPresenceCounts = async () => {
      try {
        const response = await axios.get(`${CHAT_URL}/presence/counts`, {
          params: { channels: presenceChannelKeys.join(',') },
          timeout: 8000
        });
        setPresenceCounts(response.data);
      } catch (err) {
        console.debug('Presence counts failed:', err);
      }
    };

    fetchPresenceCounts();
    const refresh = setInterval(fetchPresenceCounts, PRESENCE_COUNTS_MS);
    const handleVisibility = () => {
      if (!document.hidden) fetchPresenceCounts();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [presenceChannelKeys]);

  useEffect(() => {
    localStorage.setItem('golea_favorites', JSON.stringify(favoriteChannelIds));
  }, [favoriteChannelIds]);

  useEffect(() => {
    localStorage.setItem('golea_recent', JSON.stringify(recentChannelIds));
  }, [recentChannelIds]);

  const fetchChannels = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get(`${API_URL}/channels`);
      setChannels(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los canales. Asegúrate de que el backend esté ejecutándose.');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAgenda = async (silent = false) => {
    try {
      if (!silent) setLoadingAgenda(true);
      const response = await axios.get(`${API_URL}/agenda`);
      setAgenda(response.data);
    } catch (err) {
      console.error('Error fetching agenda:', err);
    } finally {
      if (!silent) setLoadingAgenda(false);
    }
  };

  const categories = useMemo(() => {
    const cats = ['Todos', 'Premium', ...Array.from(new Set(channels.filter(c => c.category !== 'Premium').map(c => c.category)))];
    return cats;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchesCategory = activeCategory === 'Todos' || c.category === activeCategory;
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [channels, activeCategory, searchTerm]);

  const uniqueAgenda = useMemo(() => {
    const eventsByMatch = new Map<string, AgendaEvent>();

    agenda.forEach(event => {
      const key = `${event.date}|${event.time}|${event.title.trim().toLowerCase()}`;
      const existing = eventsByMatch.get(key);

      if (!existing) {
        eventsByMatch.set(key, event);
        return;
      }

      const languages = new Set(
        `${existing.language}, ${event.language}`
          .split(',')
          .map(language => language.trim())
          .filter(Boolean)
      );

      eventsByMatch.set(key, {
        ...existing,
        language: Array.from(languages).join(', '),
        channelId: existing.channelId || event.channelId
      });
    });

    return Array.from(eventsByMatch.values());
  }, [agenda]);

  const handleSelectChannel = async (channel: Channel) => {
    try {
      setSelectedChannel(channel);
      setLoadingStream(true);
      setStreamUrl(null);
      setRecentChannelIds(previous => [channel.id, ...previous.filter(id => id !== channel.id)].slice(0, 8));
      const response = await axios.get(`${API_URL}/stream-url?id=${encodeURIComponent(channel.id)}`);
      const rawUrl = response.data.url;
      const protectedUrl = btoa(rawUrl);
      const proxiedUrl = `${API_URL}/proxy?p=${encodeURIComponent(protectedUrl)}`;
      setStreamUrl(proxiedUrl);
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el stream de este canal.');
    } finally {
      setLoadingStream(false);
    }
  };

  const toggleFavorite = (channelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setFavoriteChannelIds(previous =>
      previous.includes(channelId)
        ? previous.filter(id => id !== channelId)
        : [channelId, ...previous]
    );
  };

  const handleSelectAgendaEvent = (event: AgendaEvent) => {
    if (event.channelId) {
      const targetChannel = channels.find(c => 
        c.id.toLowerCase().includes(event.channelId!.toLowerCase()) || 
        event.channelId!.toLowerCase().includes(c.id.toLowerCase())
      );
      
      if (targetChannel) {
        handleSelectChannel(targetChannel);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (event.link) {
        handleSelectChannel({
          id: event.link,
          name: event.title,
          category: event.category,
          logo: ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(`El canal "${event.channelId}" no está disponible actualmente en la lista principal.`);
      }
    } else {
      alert('Este evento no tiene un canal asignado todavía.');
    }
  };

  const getEventStatus = (event: AgendaEvent) => {
    try {
        const [year, month, day] = event.date.split('-').map(Number);
        const timeMatch = event.time.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
        if (!timeMatch) throw new Error('Invalid time');
        let hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);
        const meridiem = timeMatch[3];
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        const eventDate = new Date(year, month - 1, day, hour, minute);
        const diffMs = currentTime.getTime() - eventDate.getTime();
        const diffMin = diffMs / (1000 * 60);

        if (diffMin < -60) return { label: 'PRONTO', color: 'bg-slate-700 text-slate-400', active: true };
        if (diffMin < 0) return { label: 'EN BREVE', color: 'bg-blue-500/20 text-blue-400', active: true };
        if (diffMin <= 130) return { label: 'EN VIVO', color: 'bg-red-500/10 text-red-500 animate-pulse', active: true };
        return { label: 'FINALIZADO', color: 'bg-slate-800 text-slate-600', active: false };
    } catch (e) {
        return { label: 'PROGRAMADO', color: 'bg-slate-700 text-slate-400', active: true };
    }
  };

  const activeAgenda = uniqueAgenda.filter(event => getEventStatus(event).active);
  const featuredAgenda = activeAgenda.slice(0, 3);
  const agendaTitle = uniqueAgenda[0]?.dateLabel || 'Agenda de hoy';

  const channelMatchesEvent = (channel: Channel, event: AgendaEvent) => {
    if (!event.channelId) return false;
    const channelId = channel.id.toLowerCase();
    const eventChannel = event.channelId.toLowerCase();
    return channelId.includes(`stream=${eventChannel}`) || channelId.includes(eventChannel);
  };

  const getChannelStatus = (channel: Channel) => {
    const event = activeAgenda.find(item => channelMatchesEvent(channel, item));
    return event ? getEventStatus(event) : null;
  };

  const favoriteChannels = favoriteChannelIds
    .map(id => filteredChannels.find(channel => channel.id === id))
    .filter((channel): channel is Channel => Boolean(channel));
  const favoriteSet = new Set(favoriteChannels.map(channel => channel.id));
  const recentChannels = recentChannelIds
    .map(id => filteredChannels.find(channel => channel.id === id && !favoriteSet.has(channel.id)))
    .filter((channel): channel is Channel => Boolean(channel));
  const recentSet = new Set(recentChannels.map(channel => channel.id));
  const regularChannels = filteredChannels.filter(channel => !favoriteSet.has(channel.id) && !recentSet.has(channel.id));
  const selectedChannelRoom = selectedChannel
    ? `channel-${selectedChannel.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}`
    : null;
  const getChannelViewerCount = (channel: Channel) => {
    return presenceCounts.channels[getPresenceChannelKey(channel.id)] || 0;
  };
  const selectedChannelViewers = selectedChannel ? getChannelViewerCount(selectedChannel) : 0;

  const renderChannelCard = (channel: Channel) => {
    const channelStatus = getChannelStatus(channel);
    const isFavorite = favoriteChannelIds.includes(channel.id);
    const isSelected = selectedChannel?.id === channel.id;
    const isPremium = channel.category === 'Premium';
    const channelViewers = getChannelViewerCount(channel);

    return (
      <div 
        key={channel.id}
        onClick={() => handleSelectChannel(channel)}
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
          isSelected 
          ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' 
          : isPremium 
            ? 'bg-slate-800 border-transparent hover:bg-blue-900/20 hover:border-blue-700/50'
            : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPremium ? 'bg-blue-600/20' : 'bg-slate-900'}`}>
          <Tv className={`w-5 h-5 ${isSelected ? 'text-blue-500' : isPremium ? 'text-blue-400' : 'text-slate-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
              {channel.name}
            </p>
            {isPremium && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] bg-blue-600 text-white font-black uppercase">
                PREMIUM
              </span>
            )}
            {channelStatus && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${channelStatus.color}`}>
                {channelStatus.label}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate">
              {channel.category}
            </p>
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-green-400 font-bold">
              <Users className="w-3 h-3" />
              {channelViewers > 0 ? formatViewerCount(channelViewers) : 'En vivo'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => toggleFavorite(channel.id, event)}
          className={`shrink-0 rounded-lg p-1.5 transition-colors ${isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-600 hover:text-yellow-400 hover:bg-slate-900'}`}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-500 rotate-90' : 'text-slate-700'}`} />
      </div>
    );
  };

  const renderChannelSection = (title: string, items: Channel[], icon: React.ReactNode) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-bold">
            {items.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {items.map(renderChannelCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col" data-build={APP_BUILD_MARKER}>
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-3 md:p-4 md:sticky md:top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <div className="h-12 w-12 md:h-16 md:w-16 bg-blue-600 rounded-xl overflow-hidden flex items-center justify-center border-2 border-blue-500 shadow-xl shadow-blue-500/30">
              <img src="/assets/logo.png" alt="Golea Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black leading-none tracking-tighter text-white italic">GOLEA</h1>
              <p className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.22em] md:tracking-[0.3em] mt-1">Premium Streams</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 w-full md:ml-8">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar canal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
              />
            </div>

            <div className="shrink-0 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-green-400" />
              <span>{presenceCounts.total > 0 ? `${formatViewerCount(presenceCounts.total)} online` : 'Online'}</span>
            </div>

            <button 
              onClick={() => { fetchChannels(); fetchAgenda(); }}
              className="shrink-0 px-3 md:px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Categories Bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 p-2 overflow-x-auto custom-scrollbar sticky top-0 md:top-[97px] z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className={`bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-2xl relative ${
            streamUrl || loadingStream ? 'aspect-video' : 'min-h-[260px] md:aspect-video'
          }`}>
            {loadingStream && <AdBanner format="overlay" />}
            {streamUrl ? (
              <div className="w-full h-full">
                <VideoPlayer src={streamUrl} />
              </div>
            ) : (
              <div className="w-full h-full">
                {loadingStream ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-slate-200 font-bold animate-pulse text-lg">{loadingMessage}</p>
                      <p className="text-slate-500 text-xs italic">Cargando señal desde servidores satelitales...</p>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[260px] md:h-full flex flex-col justify-center p-4 md:p-8 bg-gradient-to-br from-slate-950 via-black to-slate-900">
                    <div className="flex items-center gap-2 text-blue-400 text-[11px] font-black uppercase tracking-widest mb-3">
                      <Radio className="w-4 h-4" />
                      {featuredAgenda.length > 0 ? 'En vivo y proximos' : 'Centro de transmision'}
                    </div>
                    <h2 className="text-xl md:text-3xl font-black text-white leading-tight max-w-2xl">
                      Elige un canal o entra desde la agenda del dia.
                    </h2>
                    <p className="text-slate-400 text-sm mt-2 max-w-xl">
                      Los eventos activos aparecen destacados para que llegues mas rapido a la transmision.
                    </p>
                    {featuredAgenda.length > 0 && (
                      <div className="hidden md:grid md:grid-cols-3 gap-3 mt-5">
                        {featuredAgenda.map(event => {
                          const status = getEventStatus(event);
                          return (
                            <button
                              key={`${event.date}-${event.time}-${event.title}`}
                              onClick={() => handleSelectAgendaEvent(event)}
                              className="text-left bg-slate-900/80 border border-slate-700 hover:border-blue-500 rounded-xl p-3 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-blue-400 text-xs font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {event.time}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="text-slate-100 text-sm font-bold leading-snug line-clamp-2">
                                {event.title}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-2 truncate">
                                {event.category} - {event.language}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {uniqueAgenda.length > 0 && (
            <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    {agendaTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Sincronizada con Pelota Libre TV.</p>
                </div>
                <button
                  onClick={() => setActiveTab('agenda')}
                  className="shrink-0 whitespace-nowrap text-xs font-bold text-blue-400 hover:text-blue-300"
                >
                  Ver todo
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {uniqueAgenda.slice(0, 3).map(event => {
                  const status = getEventStatus(event);
                  return (
                    <button
                      key={`main-${event.date}-${event.time}-${event.title}`}
                      onClick={() => handleSelectAgendaEvent(event)}
                      className="text-left bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-xl p-3 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-400 text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-100 leading-tight line-clamp-2">
                        {event.title}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2 truncate">
                        {event.category} - {event.language}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          
          <AdBanner format="horizontal" />
          
          {selectedChannel && (
            <div className="bg-slate-800/80 backdrop-blur p-5 rounded-2xl border border-slate-700 flex flex-wrap items-center gap-4 shadow-xl">
              <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                {selectedChannel.logo ? (
                  <img src={selectedChannel.logo} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  <Tv className="h-6 w-6 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-xl">{selectedChannel.name}</h2>
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20 font-bold uppercase tracking-wider">
                    {selectedChannel.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    En Vivo
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{streamUrl ? 'Streaming HD' : 'Estableciendo conexión...'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <Users className="w-3.5 h-3.5" />
                    {selectedChannelViewers > 0 ? `${formatViewerCount(selectedChannelViewers)} viendo ahora` : 'Contador activo'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4 lg:max-h-[calc(100vh-150px)]">
          {/* Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('channels')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'channels' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              CANALES
            </button>
            <button 
              onClick={() => setActiveTab('agenda')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'agenda' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              AGENDA
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              CHAT
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {activeTab === 'channels' ? (
              <>
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-slate-400">
                    <Globe className="w-4 h-4" />
                    {activeCategory}
                    </h2>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-bold">
                    {filteredChannels.length}
                    </span>
                </div>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-slate-500 text-sm">Cargando grilla...</p>
                  </div>
                ) : error ? (
                  <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-red-200 text-sm font-medium">{error}</p>
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="text-center py-20">
                    <Search className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No se encontraron canales</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {renderChannelSection('Favoritos', favoriteChannels, <Star className="w-3.5 h-3.5 text-yellow-400" />)}
                    {renderChannelSection('Recientes', recentChannels, <History className="w-3.5 h-3.5 text-blue-400" />)}
                    {renderChannelSection(activeCategory, regularChannels, <Globe className="w-3.5 h-3.5 text-slate-500" />)}
                  </div>
                )}
              </>
            ) : activeTab === 'agenda' ? (
              <div className="space-y-4">
                {loadingAgenda ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-slate-500 text-sm">Sincronizando agenda...</p>
                  </div>
                ) : uniqueAgenda.length === 0 ? (
                  <div className="text-center py-20">
                    <Calendar className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay eventos para hoy</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="px-1">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{agendaTitle}</h3>
                    </div>
                    {uniqueAgenda.map((event) => {
                      const status = getEventStatus(event);
                      return (
                        <div 
                          key={`${event.date}-${event.time}-${event.title}`}
                          className="bg-slate-800 border border-slate-700 rounded-xl p-3 hover:border-blue-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-blue-400 text-xs font-bold">
                              <Clock className="w-3 h-3" />
                              {event.time}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-200 leading-tight mb-3">
                            {event.title}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-medium">
                              {event.category} • {event.language}
                            </span>
                            {event.channelId && status.active && (
                              <button 
                                onClick={() => handleSelectAgendaEvent(event)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-md transition-colors flex items-center gap-1"
                              >
                                <PlayCircle className="w-3 h-3" />
                                VER AHORA
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <ChatPanel
                baseUrl={CHAT_URL}
                channelRoom={selectedChannelRoom}
                channelName={selectedChannel?.name || null}
              />
            )}
          </div>
        </div>
      </main>

      {/* Botón Flotante de Telegram */}
      <a 
        href="https://t.me/goleafutbol" 
        target="_blank" 
        rel="noopener noreferrer"
        className="hidden md:flex fixed bottom-6 right-6 z-50 bg-[#229ED9] hover:bg-[#1d8dbf] text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 items-center justify-center group animate-bounce hover:animate-none"
        title="Únete a nuestro Telegram"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold text-sm whitespace-nowrap">
          CANAL TELEGRAM
        </span>
      </a>

      {/* Footer Legal */}
      <footer className="bg-slate-800 border-t border-slate-700 p-6 mt-8">
        <div className="max-w-7xl mx-auto text-center space-y-3">
          <p className="text-slate-400 text-xs leading-relaxed max-w-3xl mx-auto">
            <span className="font-bold text-slate-300">Aviso Legal (DMCA):</span> Golea no aloja ningún video en sus servidores. Solo proporcionamos una interfaz para acceder a enlaces de contenido que ya está disponible públicamente en internet. No tenemos control sobre el contenido de terceros y no asumimos responsabilidad por el mismo. Si usted es el propietario de algún contenido y desea que se retire el enlace, por favor contáctenos y lo eliminaremos en menos de 24 horas.
          </p>
          <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
            © 2026 GOLEA PREMIUM STREAMS - TODOS LOS DERECHOS RESERVADOS
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
