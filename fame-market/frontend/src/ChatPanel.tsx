import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Flag,
  MessageCircle,
  Mic,
  Send,
  SmilePlus,
  Square,
  Wifi,
  WifiOff,
  Youtube
} from 'lucide-react';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  type: 'text' | 'voice';
  body: string;
  audioDataUrl?: string;
  audioMimeType?: string;
  durationMs?: number;
  reportCount?: number;
  createdAt: string;
}

interface PresenceUser {
  userId: string;
  name: string;
}

interface ChatPollOption {
  id: string;
  label: string;
  votes: number;
}

interface ChatPoll {
  id: string;
  question: string;
  options: ChatPollOption[];
  selectedOptionId?: string | null;
  totalVotes: number;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
type ComposerMode = 'text' | 'voice';
type RecorderState = 'idle' | 'recording' | 'sending';

interface ChatPanelProps {
  roomId: string;
  roomLabel: string;
  userId?: string | null;
  displayName?: string | null;
}

interface ReadyEvent {
  type: 'ready';
  userId: string;
  name: string;
  history: ChatMessage[];
  presence: PresenceUser[];
  poll?: ChatPoll | null;
}

interface MessageEventPayload {
  type: 'message';
  message: ChatMessage;
}

interface PresenceEvent {
  type: 'presence';
  presence: PresenceUser[];
}

interface HiddenEvent {
  type: 'message-hidden';
  messageId: string;
}

interface RoomResetEvent {
  type: 'room-reset';
  message: string;
}

interface NoticeEvent {
  type: 'error' | 'notice' | 'voice-unavailable';
  message: string;
}

interface PollUpdatedEvent {
  type: 'poll-updated';
  poll: ChatPoll | null;
}

type ChatEvent =
  | ReadyEvent
  | MessageEventPayload
  | PresenceEvent
  | HiddenEvent
  | RoomResetEvent
  | NoticeEvent
  | PollUpdatedEvent;

const guestNameKey = 'fame-plays:chat-guest-name';
const guestIdKey = 'fame-plays:chat-guest-id';
const soundEnabledKey = 'fame-plays:chat-sound-enabled';
const chatBaseUrl = (import.meta.env.VITE_CHAT_WS_URL ?? '').trim();
const maxMessageLength = 160;
const minVoiceMs = 1_000;
const maxVoiceMs = 10_000;
const emojiOptions = ['🔥', '😂', '👏', '🎤', '🏆', '⚽', '👀', '📈', '🚀', '💚'];

function randomId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function getStoredUserId() {
  const current = localStorage.getItem(guestIdKey);
  if (current) return current;
  const next = randomId();
  localStorage.setItem(guestIdKey, next);
  return next;
}

function getStoredName(displayName?: string | null) {
  const cleanDisplayName = displayName?.trim();
  if (cleanDisplayName) return cleanDisplayName.slice(0, 24);
  const current = localStorage.getItem(guestNameKey);
  if (current) return current;
  const next = `Invitado${Math.floor(100 + Math.random() * 900)}`;
  localStorage.setItem(guestNameKey, next);
  return next;
}

function buildRoomUrl(base: string, roomId: string, userId: string, name: string) {
  const normalized = /^https?:\/\//.test(base) || /^wss?:\/\//.test(base)
    ? base
    : `https://${base}`;
  const url = new URL(normalized);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.pathname = `/rooms/${encodeURIComponent(roomId)}/ws`;
  url.searchParams.set('userId', userId);
  url.searchParams.set('name', name);
  return url.toString();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function secondsLabel(ms = 0) {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}

function preferredMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let notificationAudioContext: AudioContext | null = null;

function playChatSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  notificationAudioContext ??= new AudioContextClass();
  const context = notificationAudioContext;
  const play = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(720, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      520,
      context.currentTime + 0.12
    );
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  };
  if (context.state === 'suspended') {
    context.resume().then(play).catch(() => undefined);
    return;
  }
  play();
}

export function ChatPanel({ roomId, roomLabel, userId, displayName }: ChatPanelProps) {
  const hasFigureRoom = roomId !== 'general';
  const [activeRoom, setActiveRoom] = useState<'figure' | 'general'>(
    hasFigureRoom ? 'figure' : 'general'
  );
  const [mode, setMode] = useState<ComposerMode>('text');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [poll, setPoll] = useState<ChatPoll | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(soundEnabledKey) === 'true'
  );
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | undefined>(undefined);
  const autoStopTimerRef = useRef<number | undefined>(undefined);
  const connectionSeqRef = useRef(0);
  const effectiveRoomId = activeRoom === 'general' || !hasFigureRoom ? 'general' : roomId;
  const effectiveRoomLabel =
    activeRoom === 'general' || !hasFigureRoom ? 'General' : roomLabel;

  const identity = useMemo(
    () => ({
      userId: userId?.trim() || getStoredUserId(),
      name: getStoredName(displayName)
    }),
    [displayName, userId]
  );

  useEffect(() => {
    setActiveRoom(hasFigureRoom ? 'figure' : 'general');
  }, [hasFigureRoom, roomId]);

  useEffect(() => {
    if (!chatBaseUrl) {
      setStatus('idle');
      setNotice('Chat listo para conectar cuando configures VITE_CHAT_WS_URL.');
      return undefined;
    }

    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let closedByEffect = false;
    let reconnectAttempt = 0;
    const connectionSeq = ++connectionSeqRef.current;

    const isCurrentConnection = () =>
      !closedByEffect && connectionSeqRef.current === connectionSeq;

    const connect = () => {
      if (!isCurrentConnection()) return;
      setStatus('connecting');
      if (reconnectAttempt === 0) setNotice('');
      const socket = new WebSocket(
        buildRoomUrl(chatBaseUrl, effectiveRoomId, identity.userId, identity.name)
      );
      socketRef.current = socket;
      let opened = false;

      socket.addEventListener('open', () => {
        if (!isCurrentConnection()) {
          socket.close(1000, 'stale connection');
          return;
        }
        opened = true;
        reconnectAttempt = 0;
        setStatus('connected');
        setNotice('');
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25_000);
      });

      socket.addEventListener('message', (event) => {
        if (!isCurrentConnection()) return;
        let payload: ChatEvent;
        try {
          payload = JSON.parse(event.data) as ChatEvent;
        } catch {
          setNotice('El chat recibio una respuesta invalida.');
          return;
        }
        if (payload.type === 'ready') {
          setMessages(payload.history);
          setPresence(payload.presence);
          setPoll(payload.poll ?? null);
          return;
        }
        if (payload.type === 'message') {
          setMessages((current) => [...current, payload.message].slice(-120));
          if (soundEnabled && payload.message.userId !== identity.userId) {
            playChatSound();
          }
          return;
        }
        if (payload.type === 'message-hidden') {
          setMessages((current) =>
            current.filter((message) => message.id !== payload.messageId)
          );
          return;
        }
        if (payload.type === 'presence') {
          setPresence(payload.presence);
          return;
        }
        if (payload.type === 'room-reset') {
          setMessages([]);
          setNotice(payload.message);
          return;
        }
        if (payload.type === 'poll-updated') {
          setPoll(payload.poll);
          return;
        }
        setNotice(payload.message);
      });

      socket.addEventListener('close', () => {
        if (pingTimer) window.clearInterval(pingTimer);
        if (!isCurrentConnection()) return;
        setStatus('disconnected');
        reconnectAttempt += 1;
        if (opened) {
          setNotice('Reconectando chat...');
        }
        const delay = Math.min(2500 + reconnectAttempt * 1000, 9000);
        retryTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener('error', () => {
        if (isCurrentConnection() && !opened) {
          setNotice('Reconectando chat...');
        }
      });
    };

    connect();

    return () => {
      closedByEffect = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      const socket = socketRef.current;
      if (!socket) return;
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener(
          'open',
          () => socket.close(1000, 'component changed'),
          { once: true }
        );
        return;
      }
      socket.close(1000, 'component changed');
    };
  }, [effectiveRoomId, identity.name, identity.userId, soundEnabled]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages.length]);

  useEffect(
    () => () => {
      clearRecordingTimers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  function clearRecordingTimers() {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = input.trim();
    if (!body || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'chat', body }));
    setInput('');
  }

  function addEmoji(emoji: string) {
    setInput((current) => `${current}${emoji}`.slice(0, maxMessageLength));
  }

  async function startRecording() {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setNotice('Este navegador no permite grabar notas de voz.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 32_000 }
          : { audioBitsPerSecond: 32_000 }
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecorderState('recording');
      setNotice('');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        clearRecordingTimers();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const durationMs = Date.now() - recordingStartedAtRef.current;
        setElapsedMs(durationMs);
        if (durationMs < minVoiceMs) {
          setRecorderState('idle');
          setNotice('La nota debe durar al menos 1 segundo.');
          return;
        }
        try {
          setRecorderState('sending');
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm'
          });
          const audioDataUrl = await blobToDataUrl(blob);
          socketRef.current?.send(
            JSON.stringify({
              type: 'voice-note',
              audioDataUrl,
              audioMimeType: blob.type,
              durationMs
            })
          );
          setNotice('Nota de voz enviada.');
        } catch {
          setNotice('No se pudo enviar la nota de voz.');
        } finally {
          setRecorderState('idle');
          setElapsedMs(0);
        }
      };

      recorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - recordingStartedAtRef.current);
      }, 250);
      autoStopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, maxVoiceMs);
    } catch {
      setRecorderState('idle');
      setNotice('No se pudo acceder al microfono.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
  }

  function reportMessage(messageId: string) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'report',
        messageId,
        reason: 'Reporte de usuario'
      })
    );
    setNotice('Reporte enviado a moderacion.');
  }

  function votePoll(optionId: string) {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !poll) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'poll-vote',
        optionId
      })
    );
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(soundEnabledKey, String(next));
    if (next) {
      playChatSound();
      setNotice('Sonido del chat activado.');
    } else {
      setNotice('Sonido del chat desactivado.');
    }
  }

  const connected = status === 'connected';
  const canStopRecording = recorderState === 'recording' && elapsedMs >= minVoiceMs;

  return (
    <section className="social-panel">
      <div className="section-heading section-heading--compact">
        <div>
          <small>Comunidad</small>
          <h3>{effectiveRoomLabel}</h3>
        </div>
        <span className={`chat-status chat-status--${status}`}>
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          {presence.length || 0}
        </span>
      </div>

      <div className="chat-room-tabs" role="tablist" aria-label="Sala de chat">
        <button
          className={activeRoom === 'general' ? 'is-active' : ''}
          onClick={() => setActiveRoom('general')}
          role="tab"
          aria-selected={activeRoom === 'general'}
          type="button"
        >
          General
        </button>
        <button
          className={activeRoom === 'figure' ? 'is-active' : ''}
          onClick={() => setActiveRoom('figure')}
          disabled={!hasFigureRoom}
          role="tab"
          aria-selected={activeRoom === 'figure'}
          type="button"
        >
          Figura
        </button>
      </div>

      <button
        className={`chat-sound-toggle ${soundEnabled ? 'is-active' : ''}`}
        onClick={toggleSound}
        type="button"
      >
        {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        {soundEnabled ? 'Sonido activo' : 'Sonido apagado'}
      </button>

      <div className="community-links" aria-label="Canales oficiales">
        <a
          href="https://www.youtube.com/@fame_plays"
          target="_blank"
          rel="noreferrer"
        >
          <Youtube size={15} /> YouTube oficial
        </a>
        <a
          href="https://t.me/fameplaysoficial"
          target="_blank"
          rel="noreferrer"
        >
          <Send size={15} /> Telegram oficial
        </a>
      </div>

      {activeRoom === 'general' && poll && (
        <section className="chat-poll">
          <strong>{poll.question}</strong>
          <div>
            {poll.options.map((option) => {
              const selected = poll.selectedOptionId === option.id;
              const percent = poll.totalVotes
                ? Math.round((option.votes / poll.totalVotes) * 100)
                : 0;
              return (
                <button
                  className={selected ? 'is-selected' : ''}
                  key={option.id}
                  onClick={() => votePoll(option.id)}
                  disabled={!connected}
                  type="button"
                >
                  <span>
                    <b>{option.label}</b>
                    <small>{percent}% · {option.votes} votos</small>
                  </span>
                  <i style={{ width: `${percent}%` }} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="chat-body" ref={listRef}>
        {messages.length ? (
          messages.map((message) => (
            <article
              className={`chat-message ${
                message.userId === identity.userId ? 'chat-message--mine' : ''
              }`}
              key={message.id}
            >
              <header>
                <strong>{message.name}</strong>
                <span>
                  <time>{formatTime(message.createdAt)}</time>
                  {message.userId !== identity.userId && (
                    <button
                      className="chat-report"
                      onClick={() => reportMessage(message.id)}
                      aria-label="Reportar mensaje o nota de voz"
                      title="Reportar mensaje o nota de voz"
                    >
                      <Flag size={12} />
                    </button>
                  )}
                </span>
              </header>
              {message.type === 'voice' && message.audioDataUrl ? (
                <div className="voice-message">
                  <Mic size={15} />
                  <audio controls preload="metadata" src={message.audioDataUrl} />
                  <small>{secondsLabel(message.durationMs)}</small>
                </div>
              ) : (
                <p>{message.body}</p>
              )}
            </article>
          ))
        ) : (
          <p className="chat-empty">
            {activeRoom === 'general'
              ? 'Chat general de Fame Plays. Sin links, sin spam y maximo 160 caracteres.'
              : 'Se el primero en comentar esta figura. Sin links, sin spam y maximo 160 caracteres.'}
          </p>
        )}
      </div>

      <div className="social-tabs" role="tablist" aria-label="Comunidad">
        <button className={mode === 'text' ? 'is-active' : ''} onClick={() => setMode('text')}>
          <MessageCircle size={16} /> Texto
        </button>
        <button className={mode === 'voice' ? 'is-active' : ''} onClick={() => setMode('voice')}>
          <Mic size={16} /> Nota
        </button>
      </div>

      {mode === 'text' ? (
        <>
          <form className="chat-form" onSubmit={sendMessage}>
            <input
              type="text"
              maxLength={maxMessageLength}
              placeholder={connected ? 'Mensaje corto...' : 'Conectando chat...'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={!connected}
            />
            <button type="submit" disabled={!connected || !input.trim()} aria-label="Enviar mensaje">
              <Send size={17} />
            </button>
          </form>
          <div className="emoji-strip" aria-label="Emojis rapidos">
            <SmilePlus size={15} />
            {emojiOptions.map((emoji) => (
              <button key={emoji} onClick={() => addEmoji(emoji)} disabled={!connected}>
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="voice-recorder">
          <div>
            <strong>
              {recorderState === 'recording'
                ? `Grabando ${secondsLabel(elapsedMs)}`
                : recorderState === 'sending'
                  ? 'Enviando nota...'
                  : 'Nota de voz'}
            </strong>
            <small>Duracion permitida: 1 a 10 segundos.</small>
            {recorderState === 'recording' && (
              <span className="voice-meter" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (elapsedMs / maxVoiceMs) * 100)}%` }} />
              </span>
            )}
          </div>
          {recorderState === 'recording' ? (
            <button onClick={stopRecording} disabled={!canStopRecording}>
              <Square size={16} /> Enviar
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={!connected || recorderState === 'sending'}
            >
              <Mic size={16} /> Grabar
            </button>
          )}
        </div>
      )}

      {notice && <p className="notice">{notice}</p>}
    </section>
  );
}
