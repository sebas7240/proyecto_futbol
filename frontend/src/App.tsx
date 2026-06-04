import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Tv, Loader2, AlertCircle, Search, ChevronRight, MessageCircle, Calendar, Clock, PlayCircle } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import ChannelCard from './components/ChannelCard';
import AdBanner from './components/AdBanner';

interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
}

interface AgendaEvent {
  category: string;
  title: string;
  time: string;
  status: string;
  language: string;
  channelId: string | null;
  date: string;
}

const DEFAULT_API_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api'
    : 'https://api.goleafutbol.com/api';
const API_URL = (process.env.REACT_APP_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'channels' | 'agenda'>('channels');
  const [searchTerm, setSearchTerm] = useState('');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Sincronizando señal en vivo...');
  const [error, setError] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/channels`);
      setChannels(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los canales. Asegúrate de que el backend esté ejecutándose.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgenda = async () => {
    try {
      setLoadingAgenda(true);
      const response = await axios.get(`${API_URL}/agenda`);
      setAgenda(response.data);
    } catch (err) {
      console.error('Error fetching agenda:', err);
    } finally {
      setLoadingAgenda(false);
    }
  };

  const categories = useMemo(() => {
    const cats = ['Todos', ...Array.from(new Set(channels.map(c => c.category)))];
    return cats;
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchesCategory = activeCategory === 'Todos' || c.category === activeCategory;
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [channels, activeCategory, searchTerm]);

  const handleSelectChannel = async (channel: Channel) => {
    try {
      setSelectedChannel(channel);
      setLoadingStream(true);
      setStreamUrl(null);
      setActiveTab('channels'); 
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

  const handleSelectAgendaEvent = (event: AgendaEvent) => {
    if (event.channelId) {
      const targetChannel = channels.find(c => 
        c.id.toLowerCase().includes(event.channelId!.toLowerCase()) || 
        event.channelId!.toLowerCase().includes(c.id.toLowerCase())
      );
      
      if (targetChannel) {
        handleSelectChannel(targetChannel);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(`El canal "${event.channelId}" no está disponible actualmente en la lista principal.`);
      }
    } else {
      alert('Este evento no tiene un canal asignado todavía.');
    }
  };

  // Helper to calculate dynamic event status
  const getEventStatus = (event: AgendaEvent) => {
    try {
        const [year, month, day] = event.date.split('-').map(Number);
        const [hour, minute] = event.time.split(':').map(Number);
        
        // We assume the source is in GMT-5 (Colombia/Peru)
        // We create a date object for the event in that timezone
        // A simple way without libraries:
        const eventDate = new Date(year, month - 1, day, hour, minute);
        
        // Difference in minutes
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <div className="h-16 w-16 bg-blue-600 rounded-xl overflow-hidden flex items-center justify-center border-2 border-blue-500 shadow-xl shadow-blue-500/30">
              <img src="/assets/logo.png" alt="Golea Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-4xl font-black leading-none tracking-tighter text-white italic">GOLEA</h1>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.3em] mt-1">Premium Streams</p>
            </div>
          </div>
          
          <div className="relative flex-1 w-full max-w-md md:ml-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar canal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
            />
          </div>

          <div className="flex gap-2">
             <button 
              onClick={() => { fetchChannels(); fetchAgenda(); }}
              className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium"
            >
              Actualizar
            </button>
          </div>
        </div>
      </header>

      {/* Categories Bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 p-2 overflow-x-auto custom-scrollbar sticky top-[73px] z-10 backdrop-blur-md">
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
          <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800 shadow-2xl relative">
            {loadingStream && <AdBanner format="overlay" />}
            {streamUrl ? (
              <div className="w-full h-full">
                <VideoPlayer src={streamUrl} />
              </div>
            ) : (
              <div className="text-center p-8">
                {loadingStream ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-slate-200 font-bold animate-pulse text-lg">{loadingMessage}</p>
                      <p className="text-slate-500 text-xs italic">Cargando señal desde servidores satelitales...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-6 bg-slate-800/50 rounded-full">
                      <Tv className="w-12 h-12 text-slate-600" />
                    </div>
                    <p className="text-slate-400 max-w-xs text-center">Selecciona un canal de la lista para comenzar la transmisión</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
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
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4 max-h-[calc(100vh-150px)]">
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
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {activeTab === 'channels' ? (
              <>
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-slate-800/50 rounded-2xl aspect-video animate-pulse border border-slate-700"></div>
                    ))}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredChannels.map(channel => (
                      <ChannelCard 
                        key={channel.id}
                        channel={channel}
                        onSelect={handleSelectChannel}
                        isSelected={selectedChannel?.id === channel.id}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {loadingAgenda ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="bg-slate-800/50 rounded-xl h-32 animate-pulse border border-slate-700"></div>
                    ))}
                  </div>
                ) : agenda.length === 0 ? (
                  <div className="text-center py-20">
                    <Calendar className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No hay eventos para hoy</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="px-1">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Partidos de Hoy</h3>
                    </div>
                    {agenda.map((event, idx) => {
                      const status = getEventStatus(event);
                      return (
                        <div 
                          key={idx}
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
            )}
          </div>
        </div>
      </main>

      {/* Botón Flotante de Telegram */}
      <a 
        href="https://t.me/goleafutbol" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#229ED9] hover:bg-[#1d8dbf] text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center group animate-bounce hover:animate-none"
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
