import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, MessageCircle, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  ts: number;
  name: string;
  text: string;
}

interface ChatPanelProps {
  baseUrl: string;
  channelRoom?: string | null;
  channelName?: string | null;
}

const MAX_MESSAGE_LENGTH = 160;

const hasLink = (text: string) => /https?:\/\/|www\.|t\.me|discord\.gg|\.com|\.net|\.org/i.test(text);

const makeGuestName = () => `Invitado${Math.floor(100 + Math.random() * 900)}`;

const ChatPanel: React.FC<ChatPanelProps> = ({ baseUrl, channelRoom, channelName }) => {
  const [mode, setMode] = useState<'general' | 'channel'>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [guestName] = useState(() => {
    const stored = localStorage.getItem('golea_chat_name');
    if (stored) return stored;
    const next = makeGuestName();
    localStorage.setItem('golea_chat_name', next);
    return next;
  });
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeRoom = mode === 'channel' && channelRoom ? channelRoom : 'global';
  const activeTitle = mode === 'channel' && channelName ? channelName : 'Chat general';

  const wsUrl = useMemo(() => {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.searchParams.set('room', activeRoom);
    url.searchParams.set('name', guestName);
    return url.toString();
  }, [activeRoom, baseUrl, guestName]);

  useEffect(() => {
    if (mode === 'channel' && !channelRoom) setMode('general');
  }, [channelRoom, mode]);

  useEffect(() => {
    setError(null);
    setIsConnected(false);
    setMessages([]);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setError('No se pudo conectar el chat.');
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages || []);
        }
        if (data.type === 'message') {
          setMessages((current) => [...current, data.message].slice(-200));
        }
        if (data.type === 'error') {
          setError(data.error || 'No se pudo enviar el mensaje.');
        }
      } catch {
        setError('Respuesta invalida del chat.');
      }
    };

    return () => socket.close();
  }, [wsUrl]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim().replace(/\s+/g, ' ');
    setError(null);

    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError('Maximo 160 caracteres.');
      return;
    }
    if (hasLink(text)) {
      setError('No se permiten enlaces.');
      return;
    }
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError('Chat desconectado. Intenta de nuevo.');
      return;
    }

    socketRef.current.send(JSON.stringify({ type: 'message', text }));
    setInput('');
  };

  const reportMessage = (messageId: string) => {
    socketRef.current?.send(JSON.stringify({ type: 'report', messageId }));
    setError('Mensaje reportado.');
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-[420px] max-h-[620px]">
      <div className="p-3 border-b border-slate-700 bg-slate-900/40">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              Chat en vivo
            </h3>
            <p className="text-[10px] text-slate-500 truncate">{activeTitle}</p>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-600'}`} />
        </div>

        <div className="grid grid-cols-2 gap-1 mt-3 bg-slate-950 p-1 rounded-lg">
          <button
            onClick={() => setMode('general')}
            className={`py-1.5 rounded-md text-[11px] font-bold transition-colors ${mode === 'general' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            General
          </button>
          <button
            onClick={() => setMode('channel')}
            disabled={!channelRoom}
            className={`py-1.5 rounded-md text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'channel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Canal
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-950/40">
        {messages.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-slate-500 gap-2">
            <MessageCircle className="w-8 h-8 text-slate-700" />
            <p className="text-sm font-medium">Se el primero en comentar.</p>
            <p className="text-[11px] max-w-[220px]">Sin enlaces, mensajes cortos y respeto para mantener el chat activo.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="group bg-slate-800/80 border border-slate-700/70 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-black text-blue-300 truncate">{message.name}</span>
                <button
                  onClick={() => reportMessage(message.id)}
                  className="opacity-60 md:opacity-0 md:group-hover:opacity-70 hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                  title="Reportar"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-slate-200 break-words leading-snug">{message.text}</p>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-700 bg-slate-900">
        {error && <p className="text-[11px] text-yellow-300 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage();
            }}
            placeholder={`Escribe como ${guestName}`}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-2 transition-colors"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600">
          <span>Sin links ni imagenes</span>
          <span>{input.length}/{MAX_MESSAGE_LENGTH}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
