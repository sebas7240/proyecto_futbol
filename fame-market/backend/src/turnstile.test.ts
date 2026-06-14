import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketError } from './market.js';
import { verifyTurnstileToken } from './turnstile.js';

describe('Turnstile verification', () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
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
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fama.goleafutbol.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'fama.goleafutbol.com',
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
    expect(result.hostname).toBe('fama.goleafutbol.com');
  });

  it('rejects missing and mismatched tokens', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    await expect(
      verifyTurnstileToken(undefined, '127.0.0.1', 'trade_quote')
    ).rejects.toMatchObject<Partial<MarketError>>({
      code: 'TURNSTILE_REQUIRED',
      status: 403
    });

    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fama.goleafutbol.com';
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

    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'fama.goleafutbol.com';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            hostname: 'fama.goleafutbol.com'
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
});
