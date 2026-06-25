import { getPool } from './database.js';
import { MarketError } from './market.js';
import type { AuthenticatedUser } from './types.js';

const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface ProfileRow {
  id: string;
  firebase_uid: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  status: string;
  solana_wallet_address: string | null;
  prize_contact_notes: string;
  prize_wallet_updated_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
}

function publicProfile(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    solanaWalletAddress: row.solana_wallet_address,
    prizeContactNotes: row.prize_contact_notes,
    prizeWalletUpdatedAt: row.prize_wallet_updated_at
      ? row.prize_wallet_updated_at.toISOString()
      : null,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null
  };
}

async function ensureUser(user: AuthenticatedUser) {
  const result = await getPool().query<ProfileRow>(
    `
      INSERT INTO users (
        firebase_uid, email, display_name, avatar_url, last_login_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = NOW()
      RETURNING *
    `,
    [user.uid, user.email, user.displayName, user.avatarUrl]
  );
  return result.rows[0]!;
}

export async function getUserProfile(user: AuthenticatedUser) {
  return publicProfile(await ensureUser(user));
}

export async function updateUserPrizeProfile(
  user: AuthenticatedUser,
  input: { solanaWalletAddress: string | null; prizeContactNotes: string }
) {
  const wallet = input.solanaWalletAddress?.trim() || null;
  if (wallet && !solanaAddressPattern.test(wallet)) {
    throw new MarketError(
      'La wallet Solana no parece valida.',
      'INVALID_SOLANA_WALLET'
    );
  }
  const existing = await ensureUser(user);
  const result = await getPool().query<ProfileRow>(
    `
      UPDATE users
      SET solana_wallet_address = $2,
        prize_contact_notes = $3,
        prize_wallet_updated_at = CASE
          WHEN COALESCE(solana_wallet_address, '') <> COALESCE($2, '')
            THEN NOW()
          ELSE prize_wallet_updated_at
        END
      WHERE id = $1
      RETURNING *
    `,
    [existing.id, wallet, input.prizeContactNotes.trim().slice(0, 300)]
  );
  return publicProfile(result.rows[0]!);
}

export async function listPrizeProfiles(seasonId?: string) {
  const result = await getPool().query<{
    user_id: string;
    display_name: string;
    email: string | null;
    solana_wallet_address: string | null;
    prize_contact_notes: string;
    prize_wallet_updated_at: Date | null;
    season_id: string | null;
    season_name: string | null;
    rank: number | null;
    final_value: string | null;
    return_percent: string | null;
    trade_count: number | null;
  }>(
    `
      WITH selected_season AS (
        SELECT id
        FROM seasons
        WHERE ($1::uuid IS NULL OR id = $1::uuid)
        ORDER BY
          CASE status
            WHEN 'closed' THEN 0
            WHEN 'frozen' THEN 1
            WHEN 'active' THEN 2
            ELSE 3
          END,
          starts_at DESC
        LIMIT 1
      )
      SELECT
        app_user.id AS user_id,
        app_user.display_name,
        app_user.email,
        app_user.solana_wallet_address,
        app_user.prize_contact_notes,
        app_user.prize_wallet_updated_at,
        season.id AS season_id,
        season.name AS season_name,
        ranking.rank,
        ranking.final_value,
        ranking.return_percent,
        ranking.trade_count
      FROM users app_user
      LEFT JOIN selected_season ON TRUE
      LEFT JOIN seasons season ON season.id = selected_season.id
      LEFT JOIN rankings ranking
        ON ranking.user_id = app_user.id
        AND ranking.season_id = selected_season.id
      WHERE app_user.solana_wallet_address IS NOT NULL
      ORDER BY
        ranking.rank NULLS LAST,
        app_user.prize_wallet_updated_at DESC NULLS LAST
      LIMIT 250
    `,
    [seasonId ?? null]
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    solanaWalletAddress: row.solana_wallet_address,
    prizeContactNotes: row.prize_contact_notes,
    prizeWalletUpdatedAt: row.prize_wallet_updated_at
      ? row.prize_wallet_updated_at.toISOString()
      : null,
    seasonId: row.season_id,
    seasonName: row.season_name,
    rank: row.rank === null ? null : Number(row.rank),
    finalValue: row.final_value === null ? null : Number(row.final_value),
    returnPercent:
      row.return_percent === null ? null : Number(row.return_percent),
    tradeCount: row.trade_count === null ? null : Number(row.trade_count)
  }));
}
