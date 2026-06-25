import { useEffect, useMemo, useState } from 'react';
import { Radio, UsersRound } from 'lucide-react';
import { api } from './api';

const storageKey = 'fame-plays:presence-session';
const heartbeatMs = 45_000;

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `web:${crypto.randomUUID()}`;
  }
  return `web:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

function readSessionId() {
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = createSessionId();
    sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return createSessionId();
  }
}

export function OnlineCounter() {
  const sessionId = useMemo(readSessionId, []);
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncPresence() {
      try {
        const presence = await api.presenceHeartbeat(
          sessionId,
          `${window.location.pathname}${window.location.search}` || '/'
        );
        if (!cancelled) setOnlineUsers(presence.onlineUsers);
      } catch {
        try {
          const presence = await api.presence();
          if (!cancelled) setOnlineUsers(presence.onlineUsers);
        } catch {
          if (!cancelled) setOnlineUsers(null);
        }
      }
    }

    syncPresence();
    const timer = window.setInterval(syncPresence, heartbeatMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  return (
    <span className="online-counter" title="Usuarios activos en los ultimos 2 minutos">
      <UsersRound size={15} />
      <small>En linea</small>
      <strong>{onlineUsers === null ? '--' : onlineUsers.toLocaleString('es-CO')}</strong>
      <Radio size={13} />
    </span>
  );
}
