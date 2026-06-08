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
  "http://178.105.224.176",
  "https://api.goleafutbol.com",
  "http://localhost:3000",
  "http://localhost:3001",
]);

const PRESENCE_TTL_MS = 120_000; 
const MAX_PRESENCE_CHANNELS = 20; 
const MAX_MESSAGE_LENGTH = 160;
const MAX_MESSAGES = 50; // Reducido para ahorrar memoria
const RATE_LIMIT_MS = 7000;
const BLOCKED_WORDS = [
  "puta", "puto", "mierda", "malparido", "gonorrea", "hijueputa", "marica", "pendejo", "idiota", "imbecil", "imbécil", "spam",
];

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function isAllowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  if (!origin) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (ALLOWED_ORIGINS.has(origin)) return true;
    return protocol === "https:" && (
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
  private presence = new Map<string, { channelId: string | null; expires: number }>();
  private lastCleanup = 0;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();

    // Cleanup every 30 seconds
    if (now - this.lastCleanup > 30000) {
      for (const [id, data] of this.presence.entries()) {
        if (now > data.expires) this.presence.delete(id);
      }
      this.lastCleanup = now;
    }

    if (url.pathname === "/presence" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { sessionId?: string; channelId?: string | null } | null;
      const sessionId = cleanPresenceId(body?.sessionId);
      if (!sessionId) return new Response("Invalid session", { status: 400 });
      const channelId = cleanPresenceChannel(body?.channelId || null);
      this.presence.set(sessionId, { channelId, expires: now + PRESENCE_TTL_MS });
      return Response.json({ ok: true, expiresInMs: PRESENCE_TTL_MS });
    }

    if (url.pathname === "/presence/counts" && request.method === "GET") {
      const channelIds = (url.searchParams.get("channels") || "").split(",").map(cleanPresenceChannel).filter(id => !!id);
      
      const counts: Record<string, number> = {};
      channelIds.forEach(id => { if(id) counts[id] = 0; });
      
      let total = 0;
      for (const data of this.presence.values()) {
        total++;
        if (data.channelId && counts.hasOwnProperty(data.channelId)) {
          counts[data.channelId]++;
        }
      }

      return Response.json({ total, channels: counts });
    }

    return new Response("Not found", { status: 404 });
  }
}

export class ChatRoom extends DurableObject<Env> {
  private messages: ChatMessage[] = [];
  private rateLimits = new Map<string, number>();

  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });

    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return errorResponse(request, "Se esperaba WebSocket", 426);
      }

      const name = cleanName(url.searchParams.get("name"));
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.serializeAttachment({ name, ip } satisfies SocketAttachment);
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "history", messages: this.messages }));

      return new Response(null, { status: 101, webSocket: client, headers: corsHeaders(request) });
    }

    if (url.pathname === "/messages" && request.method === "GET") {
      return Response.json({ messages: this.messages }, { headers: corsHeaders(request) });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | undefined;
    const name = cleanName(attachment?.name || null);
    const ip = attachment?.ip || "unknown";
    
    let parsed;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      parsed = JSON.parse(text);
    } catch { return; }

    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      return;
    }

    if (parsed.type !== "message") return;

    const text = normalizeText(parsed.text);
    if (!text || text.length > MAX_MESSAGE_LENGTH || hasLink(text) || hasBlockedWord(text)) {
      ws.send(JSON.stringify({ type: "error", error: "Mensaje invalido" }));
      return;
    }

    const now = Date.now();
    const lastTs = this.rateLimits.get(ip) || 0;
    if (now - lastTs < RATE_LIMIT_MS) {
      ws.send(JSON.stringify({ type: "error", error: "Espera un momento" }));
      return;
    }
    this.rateLimits.set(ip, now);

    const item: ChatMessage = { id: crypto.randomUUID(), ts: now, name, text };
    this.messages.push(item);
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();

    const broadcast = JSON.stringify({ type: "message", message: item });
    this.ctx.getWebSockets().forEach(s => {
      try { s.send(broadcast); } catch { s.close(); }
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (!isAllowedRequestOrigin(request)) return new Response("Forbidden", { status: 403 });

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "golea-chat" }, { headers: corsHeaders(request) });
    }

    if (url.pathname.startsWith("/presence")) {
      const stub = env.PRESENCE_SHARD.getByName("global");
      const response = await stub.fetch(request);
      // Ensure CORS headers are added to the DO response
      const newHeaders = new Headers(response.headers);
      const cors = corsHeaders(request);
      Object.entries(cors).forEach(([k, v]) => newHeaders.set(k, v as string));
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      });
    }

    const room = cleanRoom(url.searchParams.get("room"));
    const stub = env.CHAT_ROOM.getByName(room);
    return stub.fetch(request);
  },
};
