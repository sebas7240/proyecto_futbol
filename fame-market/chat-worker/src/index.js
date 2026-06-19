const DEFAULT_HISTORY_LIMIT = 120;
const DEFAULT_MESSAGE_LIMIT = 160;
const DEFAULT_RATE_LIMIT_SECONDS = 8;
const DEFAULT_VOICE_MAX_BYTES = 500_000;
const MIN_VOICE_MS = 900;
const MAX_VOICE_MS = 10_500;
const AUTO_HIDE_REPORTS = 3;

const blockedWords = [
  'whatsapp',
  'telegram',
  'http://',
  'https://',
  'www.',
  '.com',
  '.net',
  '.org'
];

const allowedAudioTypes = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav'
];

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(init.request),
      ...init.headers
    }
  });
}

function corsHeaders(request) {
  const origin = request?.headers.get('origin') ?? '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-chat-admin-secret',
    vary: 'Origin'
  };
}

function cleanRoom(input) {
  return String(input || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'general';
}

function cleanPathRoom(input) {
  try {
    return cleanRoom(decodeURIComponent(String(input || '')));
  } catch {
    return cleanRoom(input);
  }
}

function cleanName(input) {
  const fallback = `Invitado${Math.floor(100 + Math.random() * 900)}`;
  return String(input || fallback)
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24) || fallback;
}

function cleanBody(input, limit) {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function hasBlockedContent(body) {
  const normalized = body.toLowerCase();
  return blockedWords.some((word) => normalized.includes(word));
}

function messageId() {
  return crypto.randomUUID();
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(number, max));
}

function parseAudioDataUrl(input, maxBytes) {
  const value = String(input || '');
  const match = value.match(/^data:([^;,]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const data = match[2];
  if (!allowedAudioTypes.includes(mimeType)) return null;
  const estimatedBytes = Math.ceil((data.length * 3) / 4);
  if (estimatedBytes > maxBytes) return null;
  return { dataUrl: `data:${mimeType};base64,${data}`, mimeType, estimatedBytes };
}

function rowToMessage(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.message_type || 'text',
    body: row.body || '',
    audioDataUrl: row.audio_data || '',
    audioMimeType: row.audio_mime_type || '',
    durationMs: Number(row.duration_ms || 0),
    reportCount: Number(row.report_count || 0),
    createdAt: new Date(row.created_at).toISOString()
  };
}

function isAdminRequest(request, env) {
  const secret = String(env.CHAT_ADMIN_SECRET || '');
  return Boolean(secret) && request.headers.get('x-chat-admin-secret') === secret;
}

export class ChatRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.ctx.blockConcurrencyWhile(async () => {
      this.migrate();
    });
  }

  migrate() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        message_type TEXT NOT NULL DEFAULT 'text',
        audio_data TEXT NOT NULL DEFAULT '',
        audio_mime_type TEXT NOT NULL DEFAULT '',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'visible',
        report_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_created_idx
        ON messages (created_at DESC);
      CREATE INDEX IF NOT EXISTS messages_status_created_idx
        ON messages (status, created_at DESC);
      CREATE TABLE IF NOT EXISTS rate_limits (
        user_key TEXT PRIMARY KEY,
        last_message_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        expires_at INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS moderation_user_idx
        ON moderation_actions (user_id, active, expires_at);
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS reports_message_idx
        ON reports (message_id);
    `);

    for (const definition of [
      "message_type TEXT NOT NULL DEFAULT 'text'",
      "audio_data TEXT NOT NULL DEFAULT ''",
      "audio_mime_type TEXT NOT NULL DEFAULT ''",
      'duration_ms INTEGER NOT NULL DEFAULT 0',
      "status TEXT NOT NULL DEFAULT 'visible'",
      'report_count INTEGER NOT NULL DEFAULT 0'
    ]) {
      try {
        this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN ${definition}`);
      } catch {
        // Existing Durable Object rooms may already have the column.
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const adminMatch = url.pathname.match(/^\/admin\/rooms\/([^/]+)\/moderation$/);
    if (adminMatch) {
      return this.handleAdminRequest(request, cleanPathRoom(adminMatch[1]));
    }

    if (request.headers.get('upgrade') !== 'websocket') {
      return json({ error: 'WebSocket required' }, { status: 426, request });
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    const roomId = cleanPathRoom(roomMatch?.[1] || 'general');
    const userId = cleanRoom(url.searchParams.get('userId') || crypto.randomUUID());
    const name = cleanName(url.searchParams.get('name'));
    const restriction = this.currentRestriction(userId, Date.now());
    if (restriction?.action === 'ban') {
      return json(
        { error: 'Tu acceso a esta sala esta bloqueado temporalmente.' },
        { status: 403, request }
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({
      roomId,
      userId,
      name,
      joinedAt: Date.now()
    });
    this.ctx.acceptWebSocket(server);
    server.send(
      JSON.stringify({
        type: 'ready',
        userId,
        name,
        history: this.historyRows(),
        presence: this.presence()
      })
    );
    this.broadcastPresence();
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: corsHeaders(request)
    });
  }

  handleAdminRequest(request, roomId) {
    if (request.method === 'GET') {
      return json(this.moderationSnapshot(roomId), { request });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405, request });
    }
    return request.json().then((body) => {
      const result = this.applyModeration(roomId, body || {});
      return json(result, { request });
    });
  }

  historyRows(limit = this.historyLimit()) {
    return this.ctx.storage.sql
      .exec(
        `
          SELECT id, user_id, name, body, message_type, audio_data,
                 audio_mime_type, duration_ms, report_count, created_at
          FROM messages
          WHERE status = 'visible'
          ORDER BY created_at DESC
          LIMIT ?
        `,
        limit
      )
      .toArray()
      .reverse()
      .map(rowToMessage);
  }

  moderationSnapshot(roomId) {
    return {
      roomId,
      recentMessages: this.ctx.storage.sql
        .exec(
          `
            SELECT id, user_id, name, body, message_type, audio_mime_type,
                   duration_ms, status, report_count, created_at
            FROM messages
            ORDER BY created_at DESC
            LIMIT 60
          `
        )
        .toArray()
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          type: row.message_type || 'text',
          body: row.body || '',
          audioMimeType: row.audio_mime_type || '',
          durationMs: Number(row.duration_ms || 0),
          status: row.status || 'visible',
          reportCount: Number(row.report_count || 0),
          createdAt: new Date(row.created_at).toISOString()
        })),
      actions: this.ctx.storage.sql
        .exec(
          `
            SELECT id, user_id, name, action, reason, expires_at, active, created_at
            FROM moderation_actions
            ORDER BY created_at DESC
            LIMIT 40
          `
        )
        .toArray()
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          action: row.action,
          reason: row.reason,
          active: Boolean(row.active),
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString()
        })),
      reports: this.ctx.storage.sql
        .exec(
          `
            SELECT id, message_id, user_id, reason, created_at
            FROM reports
            ORDER BY created_at DESC
            LIMIT 40
          `
        )
        .toArray()
        .map((row) => ({
          id: row.id,
          messageId: row.message_id,
          userId: row.user_id,
          reason: row.reason,
          createdAt: new Date(row.created_at).toISOString()
        })),
      generatedAt: new Date().toISOString()
    };
  }

  presence() {
    return this.ctx.getWebSockets().map((ws) => {
      const attachment = ws.deserializeAttachment() || {};
      return {
        userId: attachment.userId || 'anonymous',
        name: attachment.name || 'Invitado'
      };
    });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Mensaje invalido.' }));
      return;
    }

    if (payload.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', now: new Date().toISOString() }));
      return;
    }

    if (payload.type === 'chat') {
      this.handleChat(ws, payload);
      return;
    }

    if (payload.type === 'voice-note') {
      this.handleVoiceNote(ws, payload);
      return;
    }

    if (payload.type === 'report') {
      this.handleReport(ws, payload);
      return;
    }

    if (payload.type === 'voice-signal') {
      this.handleVoiceSignal(ws, payload);
    }
  }

  webSocketClose() {
    this.broadcastPresence();
  }

  webSocketError() {
    this.broadcastPresence();
  }

  handleChat(ws, payload) {
    const attachment = ws.deserializeAttachment() || {};
    const now = Date.now();
    const limit = this.messageLimit();
    const body = cleanBody(payload.body, limit);
    if (!this.canSend(ws, now)) return;
    if (!body) {
      ws.send(JSON.stringify({ type: 'error', message: 'Escribe un mensaje.' }));
      return;
    }
    if (hasBlockedContent(body)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'El chat no permite links ni invitaciones externas.'
        })
      );
      return;
    }

    this.createMessage({
      userId: attachment.userId || 'anonymous',
      name: attachment.name || 'Invitado',
      type: 'text',
      body,
      audioDataUrl: '',
      audioMimeType: '',
      durationMs: 0,
      now
    });
  }

  handleVoiceNote(ws, payload) {
    const attachment = ws.deserializeAttachment() || {};
    const now = Date.now();
    if (!this.canSend(ws, now)) return;
    const durationMs = clampNumber(payload.durationMs, 0, 0, 60_000);
    if (durationMs < MIN_VOICE_MS || durationMs > MAX_VOICE_MS) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'La nota de voz debe durar entre 1 y 10 segundos.'
        })
      );
      return;
    }
    const audio = parseAudioDataUrl(payload.audioDataUrl, this.voiceMaxBytes());
    if (!audio) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Audio invalido o demasiado pesado.'
        })
      );
      return;
    }

    this.createMessage({
      userId: attachment.userId || 'anonymous',
      name: attachment.name || 'Invitado',
      type: 'voice',
      body: 'Nota de voz',
      audioDataUrl: audio.dataUrl,
      audioMimeType: audio.mimeType,
      durationMs,
      now
    });
  }

  canSend(ws, now) {
    const attachment = ws.deserializeAttachment() || {};
    const key = attachment.userId || 'anonymous';
    const restriction = this.currentRestriction(key, now);
    if (restriction) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message:
            restriction.action === 'ban'
              ? 'Tu acceso a esta sala esta bloqueado.'
              : 'Estas silenciado temporalmente en esta sala.'
        })
      );
      if (restriction.action === 'ban') ws.close(1008, 'banned');
      return false;
    }

    const current = this.ctx.storage.sql
      .exec('SELECT last_message_at FROM rate_limits WHERE user_key = ?', key)
      .toArray()[0];
    const cooldown = this.rateLimitSeconds() * 1000;
    if (current && now - Number(current.last_message_at) < cooldown) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `Espera ${this.rateLimitSeconds()} segundos entre mensajes.`
        })
      );
      return false;
    }
    return true;
  }

  createMessage({
    userId,
    name,
    type,
    body,
    audioDataUrl,
    audioMimeType,
    durationMs,
    now
  }) {
    const id = messageId();
    this.ctx.storage.sql.exec(
      `
        INSERT INTO messages (
          id, user_id, name, body, message_type, audio_data,
          audio_mime_type, duration_ms, status, report_count, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'visible', 0, ?)
      `,
      id,
      userId,
      name,
      body,
      type,
      audioDataUrl,
      audioMimeType,
      durationMs,
      now
    );
    this.ctx.storage.sql.exec(
      `
        INSERT INTO rate_limits (user_key, last_message_at)
        VALUES (?, ?)
        ON CONFLICT(user_key)
        DO UPDATE SET last_message_at = excluded.last_message_at
      `,
      userId,
      now
    );
    this.pruneMessages();
    this.broadcast({
      type: 'message',
      message: {
        id,
        userId,
        name,
        type,
        body,
        audioDataUrl,
        audioMimeType,
        durationMs,
        reportCount: 0,
        createdAt: new Date(now).toISOString()
      }
    });
  }

  handleReport(ws, payload) {
    const attachment = ws.deserializeAttachment() || {};
    const now = Date.now();
    const messageIdValue = String(payload.messageId || '').slice(0, 80);
    if (!messageIdValue) return;
    const existing = this.ctx.storage.sql
      .exec(
        `
          SELECT id FROM reports
          WHERE message_id = ? AND user_id = ?
          LIMIT 1
        `,
        messageIdValue,
        attachment.userId || 'anonymous'
      )
      .toArray()[0];
    if (existing) {
      ws.send(JSON.stringify({ type: 'error', message: 'Ya reportaste este mensaje.' }));
      return;
    }
    this.ctx.storage.sql.exec(
      `
        INSERT INTO reports (id, message_id, user_id, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      messageId(),
      messageIdValue,
      attachment.userId || 'anonymous',
      cleanBody(payload.reason || 'Reporte de usuario', 160),
      now
    );
    this.ctx.storage.sql.exec(
      `
        UPDATE messages
        SET report_count = report_count + 1
        WHERE id = ?
      `,
      messageIdValue
    );
    const row = this.ctx.storage.sql
      .exec('SELECT report_count FROM messages WHERE id = ?', messageIdValue)
      .toArray()[0];
    if (row && Number(row.report_count) >= AUTO_HIDE_REPORTS) {
      this.ctx.storage.sql.exec(
        "UPDATE messages SET status = 'hidden' WHERE id = ?",
        messageIdValue
      );
      this.broadcast({ type: 'message-hidden', messageId: messageIdValue });
    }
    ws.send(JSON.stringify({ type: 'notice', message: 'Reporte recibido.' }));
  }

  currentRestriction(userId, now) {
    return this.ctx.storage.sql
      .exec(
        `
          SELECT action, expires_at
          FROM moderation_actions
          WHERE user_id = ?
            AND active = 1
            AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY created_at DESC
          LIMIT 1
        `,
        userId,
        now
      )
      .toArray()[0];
  }

  applyModeration(roomId, body) {
    const now = Date.now();
    const action = String(body.action || '');
    const reason = cleanBody(body.reason || 'Moderacion manual', 240);
    const userId = cleanRoom(body.userId || '');
    const name = cleanName(body.userName || body.name || userId || 'Usuario');

    if (action === 'hide-message') {
      const targetMessageId = String(body.messageId || '').slice(0, 80);
      this.ctx.storage.sql.exec(
        "UPDATE messages SET status = 'hidden' WHERE id = ?",
        targetMessageId
      );
      this.broadcast({ type: 'message-hidden', messageId: targetMessageId });
      return this.moderationSnapshot(roomId);
    }

    if (action === 'mute-user' || action === 'ban-user') {
      if (!userId) throw new Error('userId required');
      const minutes = clampNumber(body.durationMinutes, 15, 1, 10_080);
      const expiresAt = now + minutes * 60_000;
      this.ctx.storage.sql.exec(
        `
          INSERT INTO moderation_actions (
            id, user_id, name, action, reason, expires_at, active, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `,
        messageId(),
        userId,
        name,
        action === 'ban-user' ? 'ban' : 'mute',
        reason,
        expiresAt,
        now
      );
      if (action === 'ban-user') {
        for (const socket of this.ctx.getWebSockets()) {
          const attachment = socket.deserializeAttachment() || {};
          if (attachment.userId === userId) socket.close(1008, 'banned');
        }
      }
      return this.moderationSnapshot(roomId);
    }

    if (action === 'clear-user') {
      if (!userId) throw new Error('userId required');
      this.ctx.storage.sql.exec(
        'UPDATE moderation_actions SET active = 0 WHERE user_id = ?',
        userId
      );
      return this.moderationSnapshot(roomId);
    }

    throw new Error('Unsupported moderation action');
  }

  handleVoiceSignal(ws, payload) {
    if (String(this.env.VOICE_SIGNALING_ENABLED || 'false') !== 'true') {
      ws.send(
        JSON.stringify({
          type: 'voice-unavailable',
          message: 'Audio chat esta preparado, pero no activado.'
        })
      );
      return;
    }
    const attachment = ws.deserializeAttachment() || {};
    const safeSignal = {
      type: 'voice-signal',
      from: {
        userId: attachment.userId || 'anonymous',
        name: attachment.name || 'Invitado'
      },
      signalType: String(payload.signalType || '').slice(0, 40),
      data: payload.data ?? null
    };
    this.broadcast(safeSignal, ws);
  }

  broadcast(payload, except) {
    const encoded = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      try {
        socket.send(encoded);
      } catch {
        socket.close(1011, 'send failed');
      }
    }
  }

  broadcastPresence() {
    this.broadcast({
      type: 'presence',
      presence: this.presence()
    });
  }

  pruneMessages() {
    this.ctx.storage.sql.exec(
      `
        DELETE FROM messages
        WHERE id NOT IN (
          SELECT id FROM messages
          ORDER BY created_at DESC
          LIMIT ?
        )
      `,
      this.historyLimit()
    );
  }

  historyLimit() {
    return Math.max(
      20,
      Math.min(Number(this.env.CHAT_HISTORY_LIMIT || DEFAULT_HISTORY_LIMIT), 200)
    );
  }

  messageLimit() {
    return Math.max(
      60,
      Math.min(Number(this.env.CHAT_MESSAGE_MAX_LENGTH || DEFAULT_MESSAGE_LIMIT), 240)
    );
  }

  rateLimitSeconds() {
    return Math.max(
      3,
      Math.min(Number(this.env.CHAT_RATE_LIMIT_SECONDS || DEFAULT_RATE_LIMIT_SECONDS), 30)
    );
  }

  voiceMaxBytes() {
    return Math.max(
      80_000,
      Math.min(Number(this.env.CHAT_VOICE_MAX_BYTES || DEFAULT_VOICE_MAX_BYTES), 500_000)
    );
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'fame-plays-chat' }, { request });
    }

    const adminMatch = url.pathname.match(/^\/admin\/rooms\/([^/]+)\/moderation$/);
    if (adminMatch) {
      if (!isAdminRequest(request, env)) {
        return json({ error: 'Forbidden' }, { status: 403, request });
      }
      const roomId = cleanPathRoom(adminMatch[1]);
      return env.CHAT_ROOM.getByName(roomId).fetch(request);
    }

    const match = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    if (!match) {
      return json({ error: 'Not found' }, { status: 404, request });
    }
    const roomId = cleanPathRoom(match[1]);
    return env.CHAT_ROOM.getByName(roomId).fetch(request);
  }
};
