import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import type { Player } from '../types/ipl';
import {
  getInitials,
  resolveFallbackStudioPortrait,
  resolvePlayerPhoto,
} from '../utils/portraits';

interface PlayerAvatarProps {
  player: Player;
  teamColor: string;
  secondaryColor?: string;
  size?: 'sm' | 'md' | 'lg';
  onEditPhoto?: () => void;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  teamColor,
  secondaryColor = '#0f172a',
  size = 'md',
  onEditPhoto,
}) => {
  const [primaryError, setPrimaryError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  const primarySrc = resolvePlayerPhoto(player);
  const studioFallbackSrc = resolveFallbackStudioPortrait(player);

  useEffect(() => {
    setPrimaryError(false);
    setFallbackError(false);
  }, [player.photoUrl, player.avatarPreset, player.team]);

  const activeSrc =
    !primaryError && primarySrc
      ? primarySrc
      : !fallbackError && studioFallbackSrc
        ? studioFallbackSrc
        : null;

  const dims =
    size === 'sm'
      ? 'w-10 h-10 text-xs'
      : size === 'lg'
        ? 'w-20 h-20 text-lg'
        : 'w-12 h-12 text-sm';

  return (
    <div
      className={`relative shrink-0 ${dims} rounded-lg overflow-hidden border border-slate-200 bg-slate-100`}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={`${player.name} portrait`}
          referrerPolicy="no-referrer"
          onError={() => {
            if (!primaryError && activeSrc === primarySrc) {
              setPrimaryError(true);
            } else {
              setFallbackError(true);
            }
          }}
          className="w-full h-full object-cover object-top"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center font-display font-bold text-white select-none"
          style={{
            background: `linear-gradient(135deg, ${teamColor} 0%, ${secondaryColor} 100%)`,
          }}
        >
          <span className="leading-none tracking-tight">{getInitials(player.name)}</span>
          {player.jerseyNumber > 0 && size !== 'sm' && (
            <span className="font-mono text-[10px] opacity-80 mt-0.5 tabular-nums">
              #{player.jerseyNumber}
            </span>
          )}
        </div>
      )}

      {onEditPhoto && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditPhoto();
          }}
          title={`Update photo for ${player.name}`}
          aria-label={`Update photo for ${player.name}`}
          className="absolute inset-0 bg-slate-900/60 opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 flex items-center justify-center text-white cursor-pointer"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
