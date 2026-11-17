import crimsonBowlerImg from '../assets/images/cricket_bowler_crimson_1794741091454.jpg';
import navyAllRounderImg from '../assets/images/cricket_allrounder_navy_1794741092802.jpg';
import orangeSpinnerImg from '../assets/images/cricket_spinner_orange_1794741092640.jpg';
import yellowCaptainImg from '../assets/images/cricket_captain_goldyellow_1794741491674.jpg';
import purpleKnightImg from '../assets/images/cricket_knight_purplegold_1794741493254.jpg';
import pinkRoyalImg from '../assets/images/cricket_royal_pinkblue_1794741493985.jpg';
import type { Player, TeamCode } from '../types/ipl';

export const STUDIO_PORTRAITS = {
  crimson: crimsonBowlerImg,
  navy: navyAllRounderImg,
  orange: orangeSpinnerImg,
  yellow: yellowCaptainImg,
  purple: purpleKnightImg,
  pink: pinkRoyalImg,
} as const;

export function getTeamDefaultPreset(team: TeamCode): keyof typeof STUDIO_PORTRAITS {
  switch (team) {
    case 'CSK':
      return 'yellow';
    case 'KKR':
      return 'purple';
    case 'RR':
      return 'pink';
    case 'SRH':
      return 'orange';
    case 'RCB':
    case 'PBKS':
      return 'crimson';
    case 'MI':
    case 'GT':
    case 'DC':
    case 'LSG':
    default:
      return 'navy';
  }
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function resolveFallbackStudioPortrait(player: Player): string | null {
  if (player.avatarPreset && player.avatarPreset !== 'initial') {
    return STUDIO_PORTRAITS[player.avatarPreset] || STUDIO_PORTRAITS[getTeamDefaultPreset(player.team)];
  }
  return STUDIO_PORTRAITS[getTeamDefaultPreset(player.team)];
}

export function resolvePlayerPhoto(player: Player): string | null {
  if (player.photoUrl && player.photoUrl.trim().length > 0) {
    return player.photoUrl.trim();
  }
  return resolveFallbackStudioPortrait(player);
}
