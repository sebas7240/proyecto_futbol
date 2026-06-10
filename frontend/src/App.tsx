import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Tv, Loader2, AlertCircle, Search, Globe, ChevronRight, MessageCircle, Calendar, Clock, PlayCircle, PauseCircle, Maximize2, Star, History, RefreshCw, Radio, Users, Wallet, Copy, ExternalLink, Check } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import AdBanner from './components/AdBanner';
import ChatPanel from './components/ChatPanel';
import AdsterraGlobalAds from './components/AdsterraGlobalAds';
import MaintenanceOverlay from './components/MaintenanceOverlay';

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
  channelName?: string;
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
const APP_BUILD_MARKER = 'tv-player-autofocus-expanded-2026-06-07';
const PRESENCE_HEARTBEAT_MS = 25000;
const PRESENCE_COUNTS_MS = 20000;
const CHANNELS_CACHE_KEY = 'golea_channels_cache_v1';
const AGENDA_CACHE_KEY = 'golea_agenda_cache_v1';
const ACTIVE_CATEGORY_KEY = 'golea_active_category';
const FIRST_CHANNEL_UNLOCK_KEY = 'golea_first_channel_unlocked';
const CHANNELS_CACHE_TTL_MS = 10 * 60 * 1000;
const AGENDA_CACHE_TTL_MS = 5 * 60 * 1000;
// Build version: 2026-06-10-maintenance-active-test
const FIRST_CHANNEL_AD_GRACE_MS = 90000;
const GLOBAL_AD_DELAY_MS = 12000;
const SOLANA_DONATION_ADDRESS = 'ar65x4bnv19SqAkr6p3Ts6Wx9G3jGp4Pxrj5q4dYndK';
const SOLANA_EXPLORER_URL = `https://solscan.io/account/${SOLANA_DONATION_ADDRESS}`;

interface LocalCachePayload<T> {
  data: T;
  savedAt: number;
}

function readLocalCache<T>(key: string): LocalCachePayload<T> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCachedArray<T>(key: string): T[] {
  return readLocalCache<T[]>(key)?.data || [];
}

function isCacheFresh<T>(cache: LocalCachePayload<T> | null, ttlMs: number): cache is LocalCachePayload<T> {
  return !!cache && Date.now() - cache.savedAt < ttlMs;
}

function writeLocalCache<T>(key: string, data: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Cache is an optimization; storage quota/privacy failures should not block playback.
  }
}

function readStoredString(key: string, fallback: string): string {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readSessionString(key: string, fallback: string): string {
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

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

const TV_FOCUS_SELECTOR = [
  '[data-tv-focus="true"]'
].join(',');

function isTextInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || (element as HTMLElement).isContentEditable;
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TV_FOCUS_SELECTOR)).filter(element => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
}

function getRegionElements(region: string, elements = getFocusableElements()): HTMLElement[] {
  return elements.filter(element => element.dataset.tvRegion === region);
}

function getFallbackElement(elements: HTMLElement[]): HTMLElement | null {
  return elements.find(element => element.dataset.tvPrimary === 'true')
    || elements.find(element => element.dataset.tvCard === 'true')
    || elements.find(element => element.dataset.tvRegion === 'category' && element.dataset.tvActive === 'true')
    || elements.find(element => element.dataset.tvRegion === 'category')
    || elements[0]
    || null;
}

function focusElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  return true;
}

function moveInRegion(
  elements: HTMLElement[],
  current: HTMLElement,
  direction: 1 | -1,
  wrap = false
): HTMLElement | null {
  if (elements.length === 0) return null;
  const currentIndex = elements.indexOf(current);
  if (currentIndex < 0) return elements[0];
  const nextIndex = currentIndex + direction;

  if (nextIndex < 0) return wrap ? elements[elements.length - 1] : null;
  if (nextIndex >= elements.length) return wrap ? elements[0] : null;
  return elements[nextIndex];
}

function getNextFocusableElement(
  current: HTMLElement | null,
  key: string,
  elements: HTMLElement[]
): HTMLElement | null {
  if (elements.length === 0) return null;
  if (!current || !elements.includes(current)) return getFallbackElement(elements);

  const region = current.dataset.tvRegion || '';
  const expandedPlayer = elements.find(element => element.dataset.tvPlayerExpanded === 'true') || null;
  const categories = getRegionElements('category', elements);
  const activeCategory = categories.find(element => element.dataset.tvActive === 'true') || categories[0] || null;
  const channels = getRegionElements('channel', elements);
  const primaryChannel = channels.find(element => element.dataset.tvPrimary === 'true') || channels[0] || null;
  const player = getRegionElements('player', elements)[0] || null;
  const playerControls = getRegionElements('player-control', elements);
  const tabs = getRegionElements('tab', elements);
  const activeTab = tabs.find(element => element.dataset.tvActive === 'true') || tabs[0] || null;
  const agendaEvents = getRegionElements('agenda-event', elements);

  if (expandedPlayer) {
    if (region === 'player') {
      if (key === 'ArrowDown' || key === 'ArrowLeft') return playerControls[0] || current;
      if (key === 'ArrowUp' || key === 'ArrowRight') return playerControls[playerControls.length - 1] || current;
    }

    if (region === 'player-control') {
      if (key === 'ArrowLeft') return moveInRegion(playerControls, current, -1, true);
      if (key === 'ArrowRight') return moveInRegion(playerControls, current, 1, true);
      if (key === 'ArrowUp') return expandedPlayer;
      if (key === 'ArrowDown') return expandedPlayer;
    }

    return expandedPlayer;
  }

  if (region === 'category') {
    if (key === 'ArrowLeft') return moveInRegion(categories, current, -1, true);
    if (key === 'ArrowRight') return moveInRegion(categories, current, 1, true);
    if (key === 'ArrowDown') return primaryChannel || activeTab || null;
    if (key === 'ArrowUp') return player || null;
  }

  if (region === 'channel') {
    if (key === 'ArrowUp') return moveInRegion(channels, current, -1) || activeCategory;
    if (key === 'ArrowDown') return moveInRegion(channels, current, 1);
    if (key === 'ArrowLeft') return player || activeCategory;
    if (key === 'ArrowRight') return activeTab;
  }

  if (region === 'player') {
    if (key === 'ArrowRight') return primaryChannel || activeCategory;
    if (key === 'ArrowDown') return playerControls[0] || primaryChannel;
    if (key === 'ArrowUp') return activeCategory || primaryChannel;
    if (key === 'ArrowLeft') return playerControls[playerControls.length - 1] || null;
  }

  if (region === 'player-control') {
    if (key === 'ArrowLeft') return moveInRegion(playerControls, current, -1, true);
    if (key === 'ArrowRight') return moveInRegion(playerControls, current, 1, true);
    if (key === 'ArrowUp') return player || activeCategory;
    if (key === 'ArrowDown') return primaryChannel || activeTab;
  }

  if (region === 'tab') {
    if (key === 'ArrowLeft') return moveInRegion(tabs, current, -1, true);
    if (key === 'ArrowRight') return moveInRegion(tabs, current, 1, true);
    if (key === 'ArrowUp') return player || activeCategory;
    if (key === 'ArrowDown') return primaryChannel || agendaEvents[0] || current;
  }

  if (region === 'agenda-event') {
    if (key === 'ArrowUp') return moveInRegion(agendaEvents, current, -1) || activeTab;
    if (key === 'ArrowDown') return moveInRegion(agendaEvents, current, 1);
    if (key === 'ArrowLeft') return player || activeCategory;
    if (key === 'ArrowRight') return activeTab;
  }

  return getFallbackElement(elements);
}

declare global {
  interface Window {
    __goleaTvNavigate?: (key: string) => boolean;
  }
}

function App() {
  const playerFrameRef = useRef<HTMLDivElement>(null);
  const [channels, setChannels] = useState<Channel[]>(() => readCachedArray<Channel>(CHANNELS_CACHE_KEY));
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(() => readStoredString(ACTIVE_CATEGORY_KEY, 'Todos'));
  const [activeTab, setActiveTab] = useState<'channels' | 'agenda' | 'chat'>('channels');
  const [searchTerm, setSearchTerm] = useState('');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => readCachedArray<Channel>(CHANNELS_CACHE_KEY).length === 0);
  const [loadingStream, setLoadingStream] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Sincronizando señal en vivo...');
  const [error, setError] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaEvent[]>(() => readCachedArray<AgendaEvent>(AGENDA_CACHE_KEY));
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [presenceSessionId] = useState(getOrCreatePresenceSessionId);
  const [presenceCounts, setPresenceCounts] = useState<PresenceCounts>({ total: 0, channels: {} });
  const [donationCopied, setDonationCopied] = useState(false);
  const [adsUnlocked, setAdsUnlocked] = useState(() => readSessionString(FIRST_CHANNEL_UNLOCK_KEY, 'false') === 'true');
  const [playerPaused, setPlayerPaused] = useState(false);
  const [playerExpanded, setPlayerExpanded] = useState(false);
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
  const [showControls, setShowControls] = useState(true);

  // Dynamic SEO and Structured Data
  useEffect(() => {
    let title = 'Golea - Fútbol en Vivo, Partidos de Hoy y Deporte Premium';
    let description = 'Mira fútbol en vivo gratis. Transmisiones premium de partidos de hoy, Copa Libertadores, Champions League y más. La mejor alternativa a Pelota Libre.';

    if (selectedChannel) {
      title = `Ver ${selectedChannel.name} en Vivo Online - Golea`;
      description = `Disfruta de la transmisión en vivo de ${selectedChannel.name} en Golea. Calidad HD y sin cortes para todos los partidos de hoy.`;
    } else if (activeTab === 'agenda') {
      title = 'Agenda de Fútbol de Hoy - Partidos en Vivo - Golea';
      description = 'Consulta la agenda completa de partidos de fútbol para hoy. Horarios, canales y transmisiones en vivo de todas las ligas.';
    }

    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    // Update Open Graph tags too
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    if (ogDesc) ogDesc.setAttribute('content', description);

    // Structured Data (JSON-LD) for Sports Events
    const existingScript = document.getElementById('golea-structured-data');
    if (existingScript) existingScript.remove();

    if (agenda.length > 0) {
      const script = document.createElement('script');
      script.id = 'golea-structured-data';
      script.type = 'application/ld+json';
      
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": agenda.slice(0, 10).map((event, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "SportsEvent",
            "name": event.title,
            "startDate": `${event.date}T${event.time.includes('pm') && !event.time.startsWith('12') ? (parseInt(event.time) + 12) : event.time.replace(/(am|pm)/, '').padStart(5, '0')}:00`,
            "description": `Partido de ${event.category} en vivo`,
            "location": {
              "@type": "Place",
              "name": "Estadio Virtual"
            },
            "organizer": {
              "@type": "Organization",
              "name": "Golea"
            }
          }
        }))
      };

      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [selectedChannel, activeTab, agenda]);

  useEffect(() => {
    if (!streamUrl) return;

    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    const handleActivity = () => resetTimer();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearTimeout(timeout);
    };
  }, [streamUrl]);

  const loadingMessages = useMemo(() => [
    'Sincronizando señal en vivo...',
    'Lanzando instancia de servidor...',
    'Capturando fragmentos de video...',
    'Sincronizando audio y video...',
    'Preparando buffer de alta calidad...',
    'La carga puede tardar hasta 30 segundos, espera un poco...'
  ], []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playerExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [playerExpanded]);

  useEffect(() => {
    const navigateWithRemote = (key: string) => {
      const isSelectKey = key === 'Enter' || key === 'NumpadEnter' || key === ' ' || key === 'MediaPlayPause';
      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
      if (!isArrowKey && !isSelectKey) return false;
      if (isTextInputElement(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
      const elements = getFocusableElements();
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (isSelectKey) {
        if (activeElement && elements.includes(activeElement)) {
          activeElement.click();
          return true;
        }
        const fallback = getFallbackElement(elements);
        return focusElement(fallback);
      }

      const nextElement = getNextFocusableElement(activeElement, key, elements);
      if (!nextElement) return false;

      return focusElement(nextElement);
    };

    window.__goleaTvNavigate = navigateWithRemote;

    const handleRemoteNavigation = (event: KeyboardEvent) => {
      // Si el foco está en un input o textarea, no interferir con la navegación por TV
      if (isTextInputElement(document.activeElement)) {
        return;
      }

      const handled = navigateWithRemote(event.key);
      if (handled) event.preventDefault();
    };

    document.addEventListener('keydown', handleRemoteNavigation, true);
    return () => {
      document.removeEventListener('keydown', handleRemoteNavigation, true);
      delete window.__goleaTvNavigate;
    };
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
  }, [loadingStream, loadingMessages]);

  useEffect(() => {
    if (!streamUrl) return;

    const timer = window.setTimeout(() => {
      focusElement(playerFrameRef.current);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [streamUrl]);

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

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_CATEGORY_KEY, activeCategory);
    } catch {
      // Local preferences should never interrupt the main experience.
    }
  }, [activeCategory]);

  const unlockAdsAfterFirstChannel = () => {
    if (adsUnlocked) return;

    try {
      sessionStorage.setItem(FIRST_CHANNEL_UNLOCK_KEY, 'true');
    } catch {
      // Ad timing is a retention preference; storage failures should not block playback.
    }

    window.setTimeout(() => {
      setAdsUnlocked(true);
    }, FIRST_CHANNEL_AD_GRACE_MS);
  };

  const hasFirstChannelUnlockedAds = () => {
    return readSessionString(FIRST_CHANNEL_UNLOCK_KEY, 'false') === 'true';
  };

  const getPlayerVideo = () => {
    return playerFrameRef.current?.querySelector<HTMLVideoElement>('[data-golea-player-video="true"]') || null;
  };

  const togglePlayerPlayback = async () => {
    const video = getPlayerVideo();
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setPlayerPaused(false);
        return;
      }

      video.pause();
      setPlayerPaused(true);
    } catch (err) {
      console.debug('Playback toggle failed:', err);
    }
  };

  const handlePlayerFullscreen = () => {
    setPlayerExpanded(previous => !previous);
  };

  const fetchChannels = async (silent = false, force = false) => {
    const cached = readLocalCache<Channel[]>(CHANNELS_CACHE_KEY);

    if (!force && isCacheFresh(cached, CHANNELS_CACHE_TTL_MS)) {
      setChannels(cached.data);
      setError(null);
      if (!silent) setLoading(false);
      return;
    }

    if (cached?.data.length) {
      setChannels(cached.data);
      setError(null);
      if (!silent) setLoading(false);
    }

    try {
      if (!silent && !cached?.data.length) setLoading(true);
      const response = await axios.get(`${API_URL}/channels`);
      const nextChannels = Array.isArray(response.data) ? response.data : [];
      setChannels(nextChannels);
      writeLocalCache(CHANNELS_CACHE_KEY, nextChannels);
      setError(null);
    } catch (err) {
      if (!cached?.data.length) {
        setError('Error al cargar los canales. Asegúrate de que el backend esté ejecutándose.');
      }
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAgenda = async (silent = false, force = false) => {
    const cached = readLocalCache<AgendaEvent[]>(AGENDA_CACHE_KEY);

    if (!force && isCacheFresh(cached, AGENDA_CACHE_TTL_MS)) {
      setAgenda(cached.data);
      if (!silent) setLoadingAgenda(false);
      return;
    }

    if (cached?.data.length) {
      setAgenda(cached.data);
      if (!silent) setLoadingAgenda(false);
    }

    try {
      if (!silent && !cached?.data.length) setLoadingAgenda(true);
      const response = await axios.get(`${API_URL}/agenda`);
      const nextAgenda = Array.isArray(response.data) ? response.data : [];
      setAgenda(nextAgenda);
      writeLocalCache(AGENDA_CACHE_KEY, nextAgenda);
    } catch (err) {
      console.error('Error fetching agenda:', err);
    } finally {
      if (!silent) setLoadingAgenda(false);
    }
  };

  const categories = useMemo(() => {
    const cats = ['Todos', 'Premium', 'Premium 2', ...Array.from(new Set(channels.filter(c => !['Premium', 'Premium 2'].includes(c.category)).map(c => c.category)))];
    return cats;
  }, [channels]);

  useEffect(() => {
    if (channels.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory('Todos');
    }
  }, [activeCategory, categories, channels.length]);

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
      const canShowAdsForThisSelection = adsUnlocked || hasFirstChannelUnlockedAds();
      if (canShowAdsForThisSelection && !adsUnlocked) {
        setAdsUnlocked(true);
      }

      setPlayerPaused(false);
      setPlayerExpanded(false);
      setSelectedChannel(channel);
      setLoadingStream(true);
      setStreamUrl(null);
      setRecentChannelIds(previous => [channel.id, ...previous.filter(id => id !== channel.id)].slice(0, 8));
      const response = await axios.get(`${API_URL}/stream-url?id=${encodeURIComponent(channel.id)}`);
      if (response.data.proxyUrl) {
        setStreamUrl(response.data.proxyUrl);
        if (!canShowAdsForThisSelection) unlockAdsAfterFirstChannel();
        return;
      }
      const rawUrl = response.data.url;
      const protectedUrl = btoa(rawUrl);
      const proxiedUrl = `${API_URL}/proxy?p=${encodeURIComponent(protectedUrl)}`;
      setStreamUrl(proxiedUrl);
      if (!canShowAdsForThisSelection) unlockAdsAfterFirstChannel();
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el stream de este canal.');
    } finally {
      setLoadingStream(false);
    }
  };

  const handleCopyDonationAddress = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SOLANA_DONATION_ADDRESS);
      } else {
        const input = document.createElement('input');
        input.value = SOLANA_DONATION_ADDRESS;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setDonationCopied(true);
      window.setTimeout(() => setDonationCopied(false), 2000);
    } catch {
      setDonationCopied(false);
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
    if (!event.title) return false;

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const channelId = normalize(channel.id);
    const channelName = normalize(channel.name);
    const eventChannelId = normalize(event.channelId || '');
    const eventChannelName = normalize(event.channelName || '');
    const eventLink = normalize(event.link || '');
    const eventTitle = normalize(event.title || '');

    // Direct ID or URL match
    if (eventChannelId && (channelId.includes(eventChannelId) || eventChannelId.includes(channelId))) return true;
    if (eventLink && (channelId.includes(eventLink) || eventLink.includes(channelId))) return true;

    // Direct channelName match from agenda metadata
    if (eventChannelName && (channelName.includes(eventChannelName) || eventChannelName.includes(channelName))) return true;

    // Match by channel name mentioned in event title
    if (eventTitle.includes(channelName) || channelName.includes(eventTitle)) return true;

    // Special handling for generic "Eventos" channels
    if (channelName === 'eventos' || channelId.includes('evento')) {
      if (eventChannelName.includes('eventos')) return true;
      if (eventLink && channelId.includes(eventLink)) return true;
    }

    return false;
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

  const currentMatchInfo = useMemo(() => {
    if (!selectedChannel) return null;
    
    // Find the active event for this channel
    // We look in all agenda events, not just active ones, but we prioritize active ones
    const event = uniqueAgenda.find(item => channelMatchesEvent(selectedChannel, item) && getEventStatus(item).active)
               || uniqueAgenda.find(item => channelMatchesEvent(selectedChannel, item));
               
    if (!event) return null;

    // Try to parse team names from title: "Team A vs Team B" or "Team A - Team B"
    let local = 'Local';
    let visitor = 'Visita';
    const title = event.title;
    
    const separators = [' vs ', ' VS ', ' - ', ' v ', ' v. '];
    let found = false;
    for (const sep of separators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          local = parts[0].trim().split(' ').slice(-2).join(' ');
          visitor = parts[1].trim().split(' ').slice(0, 2).join(' ');
          found = true;
          break;
        }
      }
    }

    // Fallback if no separator found
    if (!found && title.length > 3) {
      local = title.slice(0, 15);
      visitor = 'Visita';
    }

    return {
      matchId: `${event.date}-${event.time}-${hashString(event.title)}`,
      localTeam: local,
      visitorTeam: visitor,
      title: event.title
    };
  }, [selectedChannel, uniqueAgenda]);

  const selectedChannelRoom = selectedChannel
    ? `channel-${selectedChannel.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}`
    : null;
  const getChannelViewerCount = (channel: Channel) => {
    return presenceCounts.channels[getPresenceChannelKey(channel.id)] || 0;
  };
  const selectedChannelViewers = selectedChannel ? getChannelViewerCount(selectedChannel) : 0;

  if (process.env.REACT_APP_MAINTENANCE_MODE === 'true') {
    return <MaintenanceOverlay />;
  }

  const renderChannelCard = (channel: Channel) => {
    const channelStatus = getChannelStatus(channel);
    const isFavorite = favoriteChannelIds.includes(channel.id);
    const isSelected = selectedChannel?.id === channel.id;
    const isPremium = channel.category === 'Premium';
    const isPremium2 = channel.category === 'Premium 2';
    const channelViewers = getChannelViewerCount(channel);

    return (
      <div 
        key={channel.id}
        role="button"
        tabIndex={0}
        data-tv-focus="true"
        data-tv-region="channel"
        data-tv-card="true"
        data-tv-primary={isSelected ? 'true' : undefined}
        onClick={() => handleSelectChannel(channel)}
        className={`tv-focusable flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
          isSelected 
          ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' 
          : isPremium 
            ? 'bg-slate-800 border-transparent hover:bg-blue-900/20 hover:border-blue-700/50'
            : isPremium2
              ? 'bg-slate-800 border-transparent hover:bg-emerald-900/20 hover:border-emerald-700/50'
              : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isPremium ? 'bg-blue-600/20' : isPremium2 ? 'bg-emerald-600/20' : 'bg-slate-900'}`}>
          <Tv className={`w-5 h-5 ${isSelected ? 'text-blue-500' : isPremium ? 'text-blue-400' : isPremium2 ? 'text-emerald-400' : 'text-slate-600'}`} />
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
            {isPremium2 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] bg-emerald-600 text-white font-black uppercase">
                PREMIUM 2
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
      <AdsterraGlobalAds enabled={adsUnlocked} delayMs={GLOBAL_AD_DELAY_MS} />

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
              onClick={() => { fetchChannels(false, true); fetchAgenda(false, true); }}
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
              data-tv-focus="true"
              data-tv-region="category"
              data-tv-active={activeCategory === cat ? 'true' : undefined}
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
            {loadingStream && adsUnlocked && <AdBanner format="overlay" />}
            {streamUrl ? (
              <div
                ref={playerFrameRef}
                role="button"
                tabIndex={0}
                data-tv-focus="true"
                data-tv-player="true"
                data-tv-player-expanded={playerExpanded ? 'true' : undefined}
                data-tv-region="player"
                onClick={togglePlayerPlayback}
                className={`tv-focusable bg-black ${
                  playerExpanded
                    ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none'
                    : 'relative h-full w-full rounded-2xl'
                }`}
                aria-label={playerPaused ? 'Reproducir' : 'Pausar'}
                title={playerPaused ? 'Reproducir' : 'Pausar'}
              >
                <VideoPlayer src={streamUrl} />
                <div className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl bg-black/70 border border-white/10 px-2 py-2 backdrop-blur transition-opacity duration-500 ${
                  showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                } ${
                  playerExpanded ? 'bottom-6' : 'bottom-3'
                }`}>
                  <button
                    type="button"
                    data-tv-focus="true"
                    data-tv-region="player-control"
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePlayerPlayback();
                    }}
                    className="tv-focusable flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-600"
                  >
                    {playerPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                    {playerPaused ? 'Reproducir' : 'Pausar'}
                  </button>
                  <button
                    type="button"
                    data-tv-focus="true"
                    data-tv-region="player-control"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePlayerFullscreen();
                    }}
                    className="tv-focusable flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-blue-600"
                  >
                    <Maximize2 className="h-4 w-4" />
                    {playerExpanded ? 'Salir' : 'Pantalla'}
                  </button>
                </div>
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
                              data-tv-focus="true"
                              data-tv-region="agenda-event"
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
                  data-tv-focus="true"
                  data-tv-region="agenda-event"
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
                      data-tv-focus="true"
                      data-tv-region="agenda-event"
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

        <div className="lg:col-span-1 flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:h-[calc(100vh-150px)] lg:min-h-[640px]">
          {/* Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button 
              data-tv-focus="true"
              data-tv-region="tab"
              data-tv-active={activeTab === 'channels' ? 'true' : undefined}
              onClick={() => setActiveTab('channels')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'channels' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              CANALES
            </button>
            <button 
              data-tv-focus="true"
              data-tv-region="tab"
              data-tv-active={activeTab === 'agenda' ? 'true' : undefined}
              onClick={() => setActiveTab('agenda')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'agenda' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              AGENDA
            </button>
            <button 
              data-tv-focus="true"
              data-tv-region="tab"
              data-tv-active={activeTab === 'chat' ? 'true' : undefined}
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
                                data-tv-focus="true"
                                data-tv-region="agenda-event"
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
                matchId={currentMatchInfo?.matchId || null}
                localTeam={currentMatchInfo?.localTeam || 'Local'}
                visitorTeam={currentMatchInfo?.visitorTeam || 'Visita'}
              />
            )}
          </div>
          </div>

          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl lg:mt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-purple-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Apoya Golea</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Si la web te sirve, puedes enviar una donacion voluntaria en Solana.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[96px_1fr] gap-3 items-center">
              <div className="bg-white rounded-xl p-2">
                <img
                  src="/assets/donacion-solana.png"
                  alt="QR Solana para donaciones"
                  className="w-full aspect-square object-contain"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Direccion Solana</p>
                  <p className="text-[11px] text-slate-200 font-mono break-all leading-relaxed">
                    {SOLANA_DONATION_ADDRESS}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyDonationAddress}
                className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-3 py-2 text-xs font-black transition-colors flex items-center justify-center gap-2"
              >
                {donationCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {donationCopied ? 'Copiada' : 'Copiar'}
              </button>
              <a
                href={SOLANA_EXPLORER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs font-black transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Solscan
              </a>
            </div>
          </section>
        </div>
      </main>

      {/* Botón Flotante de Telegram */}
      <a 
        href="https://t.me/goleafutbol" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 bg-[#229ED9] hover:bg-[#1d8dbf] text-white p-3 md:p-4 rounded-full shadow-2xl transition-all hover:scale-110 items-center justify-center group animate-bounce hover:animate-none"
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
