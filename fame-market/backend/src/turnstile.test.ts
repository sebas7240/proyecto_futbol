import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketError } from './market.js';
import {
  verifyTurnstileAccess,
  verifyTurnstileToken
} from './turnstile.js';

describe('Turnstile verification', () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SESSION_SECRET;
    delete process.env.TURNSTILE_SESSION_TTL_SECONDS;
    delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    vi.unstubAllGlobals();
  });

  it('skips verification when it is not configured', async () => {
    await expect(
      verifyTurnstileToken(undefined, '127.0.0.1', 'trade_quote')
    ).resolves.toEqual({ skipped: true });
  });

  it('accepts a valid token for the expected hostname and action', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fameplays.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'fameplays.com',
            action: 'trade_quote',
            challenge_ts: '2026-06-14T00:00:00Z'
          }),
          { status: 200 }
        )
      )
    );

    const result = await verifyTurnstileToken(
      'valid-token',
      '203.0.113.10',
      'trade_quote'
    );
    expect(result.skipped).toBe(false);
    expect(result.hostname).toBe('fameplays.com');
  });

  it('rejects missing and mismatched tokens', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    await expect(
      verifyTurnstileToken(undefined, '127.0.0.1', 'trade_quote')
    ).rejects.toMatchObject<Partial<MarketError>>({
      code: 'TURNSTILE_REQUIRED',
      status: 403
    });

    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fameplays.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'otro.example',
            action: 'trade_quote'
          }),
          { status: 200 }
        )
      )
    );
    await expect(
      verifyTurnstileToken('token', '127.0.0.1', 'trade_quote')
    ).rejects.toMatchObject<Partial<MarketError>>({
      code: 'TURNSTILE_REJECTED',
      status: 403
    });

    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fameplays.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'fameplays.com'
          }),
          { status: 200 }
        )
      )
    );
    await expect(
      verifyTurnstileToken('token-without-action', '127.0.0.1', 'trade_quote')
    ).rejects.toMatchObject<Partial<MarketError>>({
      code: 'TURNSTILE_REJECTED',
      status: 403
    });
  });

  it('issues a user-bound pass and reuses it without another challenge', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fameplays.com';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'fameplays.com',
          action: 'trade_quote'
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await verifyTurnstileAccess(
      'valid-token',
      undefined,
      'user-one',
      '203.0.113.10',
      'trade_quote'
    );
    expect(first.pass).toBeTruthy();
    expect(first.expiresAt).toBeTruthy();

    const reused = await verifyTurnstileAccess(
      undefined,
      first.pass ?? undefined,
      'user-one',
      '203.0.113.10',
      'trade_quote'
    );
    expect(reused.pass).toBe(first.pass);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not accept a pass for a different user', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fameplays.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'fameplays.com',
            action: 'trade_quote'
          }),
          { status: 200 }
        )
      )
    );
    const first = await verifyTurnstileAccess(
      'valid-token',
      undefined,
      'user-one',
      '203.0.113.10',
      'trade_quote'
    );

    await expect(
      verifyTurnstileAccess(
        undefined,
        first.pass ?? undefined,
        'user-two',
        '203.0.113.10',
        'trade_quote'
      )
    ).rejects.toMatchObject<Partial<MarketError>>({
      code: 'TURNSTILE_REQUIRED',
      status: 403
    });
  });
});

