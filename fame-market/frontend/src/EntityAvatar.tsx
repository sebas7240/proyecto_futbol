import { useState } from 'react';
import type { ImageUsageStatus } from './types';

function initials(name: string, symbol: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value =
    parts.length > 1
      ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`
      : parts[0]?.slice(0, 2) || symbol.slice(0, 2);
  return value.toUpperCase();
}

function tone(value: string) {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 6;
}

export function EntityAvatar({
  name,
  symbol,
  imageUrl,
  imageUsageStatus,
  imageAttribution = '',
  size = 'regular'
}: {
  name: string;
  symbol: string;
  imageUrl: string;
  imageUsageStatus?: ImageUsageStatus;
  imageAttribution?: string;
  size?: 'small' | 'regular' | 'large';
}) {
  const [failed, setFailed] = useState(false);
  const approved =
    imageUsageStatus === 'owned' ||
    imageUsageStatus === 'licensed' ||
    imageUsageStatus === 'provider_authorized';

  if (approved && imageUrl && !failed) {
    return (
      <img
        className={`entity-avatar entity-avatar--${size}`}
        src={imageUrl}
        alt=""
        title={imageAttribution || undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`entity-avatar entity-avatar--${size} entity-avatar--tone-${tone(
        symbol || name
      )}`}
      aria-label={`Identificador grafico de ${name}`}
      title="Avatar abstracto sin fotografia personal"
    >
      {initials(name, symbol)}
    </span>
  );
}
