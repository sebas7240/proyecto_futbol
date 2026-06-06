import { DurableObject } from "cloudflare:workers";

interface Env {
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
  PRESENCE_SHARD: DurableObjectNamespace<PresenceShard>;
}

interface ChatMessage {
  id: string;
  ts: number;
  name: string;
  text: string;
}

interface SocketAttachment {
  name: string;
  ip: string;
}

interface PresenceCounts {
  total: number;
  channels: Record<string, number>;
}

const ALLOWED_ORIGINS = new Set([
  "https://goleafutbol.com",
  "https://www.goleafutbol.com",
  "https://golea.pages.dev",
]);

const PRESENCE_SHARDS = 16;
const PRESENCE_TTL_MS = 70_000;
const MAX_PRESENCE_CHANNELS = 80;
const MAX_MESSAGE_LENGTH = 160;
const MAX_MESSAGES = 200;
const RATE_LIMIT_MS = 7000;
const BLOCKED_WORDS = [
  "puta",
  "puto",
  "mierda",
  "malparido",
  "gonorrea",
  "hijueputa",
  "marica",
  "pendejo",
  "idiota",
  "imbecil",
  "imbécil",
  "spam",
];

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function isAllowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  if (!origin) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && (
      ALLOWED_ORIGINS.has(origin) ||
      hostname === "golea.pages.dev" ||
      hostname.endsWith(".golea.pages.dev")
    );
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedRequestOrigin(request) && origin ? origin : "https://goleafutbol.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function cleanRoom(value: string | null): string {
  const room = (value || "global").toLowerCase().replace(/[^a-z0-9:_-]/g, "-").slice(0, 96);
  return room || "global";
}

function cleanPresenceId(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9:_-]/g, "-").slice(0, 96);
}

function cleanPresenceChannel(value: unknown): string | null {
  const channel = String(value || "").toLowerCase().replace(/[^a-z0-9:_-]/g, "-").slice(0, 96);
  return channel || null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function presenceShardName(sessionId: string): string {
  return `presence-${hashString(sessionId) % PRESENCE_SHARDS}`;
}

function cleanName(value: string | null): string {
  const name = (value || "").replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().slice(0, 18);
  return name || `Invitado${Math.floor(100 + Math.random() * 900)}`;
}

function normalizeText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function hasLink(text: string): boolean {
  return /https?:\/\/|www\.|t\.me|discord\.gg|\.com|\.net|\.org/i.test(text);
}

function hasBlockedWord(text: string): boolean {
  const normalized = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}

function errorResponse(request: Request, message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(request) },
  });
}

export class PresenceShard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS presence_sessions (
          session_id TEXT PRIMARY KEY,
          channel_id TEXT,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_presence_updated_at ON presence_sessions(updated_at);
        CREATE INDEX IF NOT EXISTS idx_presence_channel_id ON presence_sessions(channel_id);
      `);
    });
  }

  heartbeat(sessionId: string, channelId: string | null): { ok: true; expiresInMs: number } {
    const now = Date.now();
    this.cleanup(now);
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO presence_sessions (session_id, channel_id, updated_at) VALUES (?, ?, ?)",
      sessionId,
      channelId,
      now
    );
    return { ok: true, expiresInMs: PRESENCE_TTL_MS };
  }

  getCounts(channelIds: string[]): PresenceCounts {
    const now = Date.now();
    this.cleanup(now);

    const totalRow = this.ctx.storage.sql.exec<{ count: number } & Record<string, SqlStorageValue>>(
      "SELECT COUNT(*) AS count FROM presence_sessions WHERE updated_at >= ?",
      now - PRESENCE_TTL_MS
    ).toArray()[0];

    const counts: Record<string, number> = {};
    const uniqueChannelIds = Array.from(new Set(channelIds)).slice(0, MAX_PRESENCE_CHANNELS);

    if (uniqueChannelIds.length > 0) {
      const placeholders = uniqueChannelIds.map(() => "?").join(",");
      const rows = this.ctx.storage.sql.exec<{ channel_id: string; count: number } & Record<string, SqlStorageValue>>(
        `SELECT channel_id, COUNT(*) AS count
         FROM presence_sessions
         WHERE updated_at >= ? AND channel_id IN (${placeholders})
         GROUP BY channel_id`,
        now - PRESENCE_TTL_MS,
        ...uniqueChannelIds
      ).toArray();

      rows.forEach((row) => {
        if (row.channel_id) counts[row.channel_id] = Number(row.count) || 0;
      });
    }

    return { total: Number(totalRow?.count) || 0, channels: counts };
  }

  private cleanup(now: number): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM presence_sessions WHERE updated_at < ?",
      now - PRESENCE_TTL_MS
    );
  }
}

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          ts INTEGER NOT NULL,
          name TEXT NOT NULL,
          text TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rate_limits (
          ip TEXT PRIMARY KEY,
          last_ts INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          ts INTEGER NOT NULL,
          ip TEXT NOT NULL
        );
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });

    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (url.pathname === "/messages" && request.method === "GET") {
      return Response.json({ messages: this.getMessages() }, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/messages" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const body = await request.json().catch(() => null) as { name?: string; text?: string } | null;
      const result = this.createMessage(request, cleanName(body?.name || null), normalizeText(body?.text), ip);
      if (result instanceof Response) return result;
      this.broadcast({ type: "message", message: result });
      return Response.json({ message: result }, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/report" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const body = await request.json().catch(() => null) as { messageId?: string } | null;
      const messageId = String(body?.messageId || "").slice(0, 80);
      if (!messageId) return errorResponse(request, "Mensaje invalido");
      this.ctx.storage.sql.exec(
        "INSERT INTO reports (id, message_id, ts, ip) VALUES (?, ?, ?, ?)",
        crypto.randomUUID(),
        messageId,
        Date.now(),
        ip
      );
      return Response.json({ ok: true }, { headers: corsHeaders(request) });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  }

  private handleWebSocket(request: Request): Response {
    if (!isAllowedRequestOrigin(request)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return errorResponse(request, "Se esperaba WebSocket", 426);
    }

    const url = new URL(request.url);
    const name = cleanName(url.searchParams.get("name"));
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.serializeAttachment({ name, ip } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "history", messages: this.getMessages() }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | undefined;
    const name = cleanName(attachment?.name || null);
    const ip = attachment?.ip || "unknown";
    const parsed = this.parseSocketMessage(message);

    if (!parsed) {
      this.sendError(ws, "Mensaje invalido");
      return;
    }

    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      return;
    }

    if (parsed.type === "report") {
      const messageId = String(parsed.messageId || "").slice(0, 80);
      if (!messageId) {
        this.sendError(ws, "Reporte invalido");
        return;
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO reports (id, message_id, ts, ip) VALUES (?, ?, ?, ?)",
        crypto.randomUUID(),
        messageId,
        Date.now(),
        ip
      );
      ws.send(JSON.stringify({ type: "reported", messageId }));
      return;
    }

    if (parsed.type !== "message") return;

    const result = this.createMessage(new Request("https://chat.local"), name, normalizeText(parsed.text), ip);
    if (result instanceof Response) {
      const body = await result.json().catch(() => ({ error: "No se pudo enviar" })) as { error?: string };
      this.sendError(ws, body.error || "No se pudo enviar");
      return;
    }

    this.broadcast({ type: "message", message: result });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close();
  }

  private parseSocketMessage(message: ArrayBuffer | string): Record<string, unknown> | null {
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private createMessage(request: Request, name: string, text: string, ip: string): ChatMessage | Response {
    if (!text) return errorResponse(request, "Escribe un mensaje");
    if (text.length > MAX_MESSAGE_LENGTH) return errorResponse(request, "Maximo 160 caracteres");
    if (hasLink(text)) return errorResponse(request, "No se permiten enlaces");
    if (hasBlockedWord(text)) return errorResponse(request, "Mensaje bloqueado por moderacion");

    const now = Date.now();
    const previous = this.ctx.storage.sql.exec<{ last_ts: number } & Record<string, SqlStorageValue>>(
      "SELECT last_ts FROM rate_limits WHERE ip = ?",
      ip
    ).toArray()[0];

    if (previous && now - previous.last_ts < RATE_LIMIT_MS) {
      const remaining = Math.ceil((RATE_LIMIT_MS - (now - previous.last_ts)) / 1000);
      return errorResponse(request, `Espera ${remaining}s antes de enviar otro mensaje`, 429);
    }

    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO rate_limits (ip, last_ts) VALUES (?, ?)",
      ip,
      now
    );

    const item: ChatMessage = {
      id: crypto.randomUUID(),
      ts: now,
      name,
      text,
    };

    this.ctx.storage.sql.exec(
      "INSERT INTO messages (id, ts, name, text) VALUES (?, ?, ?, ?)",
      item.id,
      item.ts,
      item.name,
      item.text
    );
    this.ctx.storage.sql.exec(`
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages ORDER BY ts DESC LIMIT ${MAX_MESSAGES}
      )
    `);

    return item;
  }

  private getMessages(): ChatMessage[] {
    const rows = this.ctx.storage.sql.exec(
      "SELECT id, ts, name, text FROM messages ORDER BY ts DESC LIMIT ?",
      MAX_MESSAGES
    ).toArray() as unknown as ChatMessage[];

    return rows.reverse();
  }

  private broadcast(payload: unknown): void {
    const encoded = JSON.stringify(payload);
    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(encoded);
      } catch {
        ws.close();
      }
    });
  }

  private sendError(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({ type: "error", error: message }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "golea-chat" }, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/presence" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { sessionId?: string; channelId?: string | null } | null;
      const sessionId = cleanPresenceId(body?.sessionId);
      if (!sessionId) return errorResponse(request, "Sesion invalida");

      const channelId = cleanPresenceChannel(body?.channelId || null);
      const stub = env.PRESENCE_SHARD.getByName(presenceShardName(sessionId));
      const result = await stub.heartbeat(sessionId, channelId);
      return Response.json(result, {
        headers: { ...corsHeaders(request), "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/presence/counts" && request.method === "GET") {
      const channelIds = (url.searchParams.get("channels") || "")
        .split(",")
        .map(cleanPresenceChannel)
        .filter((channelId): channelId is string => Boolean(channelId))
        .slice(0, MAX_PRESENCE_CHANNELS);

      const results = await Promise.all(
        Array.from({ length: PRESENCE_SHARDS }, (_, index) =>
          env.PRESENCE_SHARD.getByName(`presence-${index}`).getCounts(channelIds)
        )
      );

      const merged: PresenceCounts = {
        total: 0,
        channels: Object.fromEntries(channelIds.map((channelId) => [channelId, 0])),
      };

      results.forEach((result) => {
        merged.total += result.total;
        Object.entries(result.channels).forEach(([channelId, count]) => {
          merged.channels[channelId] = (merged.channels[channelId] || 0) + count;
        });
      });

      return Response.json({
        ...merged,
        ttlSeconds: Math.round(PRESENCE_TTL_MS / 1000),
        updatedAt: Date.now(),
      }, {
        headers: { ...corsHeaders(request), "Cache-Control": "no-store" },
      });
    }

    if (!["/ws", "/messages", "/report"].includes(url.pathname)) {
      return new Response("Not found", { status: 404, headers: corsHeaders(request) });
    }

    const room = cleanRoom(url.searchParams.get("room"));
    const stub = env.CHAT_ROOM.getByName(room);
    return stub.fetch(request);
  },
};
