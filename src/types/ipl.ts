export type PlayerCategory = 'Batsman' | 'Bowler' | 'All-Rounder';

export type TeamCode =
  | 'MI'
  | 'CSK'
  | 'RCB'
  | 'GT'
  | 'DC'
  | 'RR'
  | 'LSG'
  | 'SRH'
  | 'PBKS'
  | 'KKR';

export interface BattingStats {
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  dotBallsFaced: number;
  strikeRate: number;
  average: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highScore: number;
}

export interface BowlingStats {
  matches: number;
  innings: number;
  overs: number;
  runsConceded: number;
  wickets: number;
  dotBallsBowled: number;
  economy: number;
  bowlingAverage: number;
  bowlingStrikeRate: number;
  maidens: number;
  fourWickets: number;
  bestFigures: string;
}

export interface RecentMatchForm {
  match: string;
  runs?: number;
  wickets?: number;
  score: number; // Quantitative performance score (runs for batters, wickets*25 for bowlers, composite for all-rounders)
  label: string;
}

export interface Player {
  id: string;
  name: string;
  team: TeamCode;
  category: PlayerCategory;
  isCaptain?: boolean;
  nationality: string;
  jerseyNumber: number;
  photoUrl?: string;
  avatarPreset?: 'crimson' | 'navy' | 'orange' | 'yellow' | 'purple' | 'pink' | 'initial';
  batting: BattingStats;
  bowling: BowlingStats;
  recentForm: RecentMatchForm[];
  lastUpdated: string;
  aiSynced?: boolean;
}

export interface TeamInfo {
  code: TeamCode;
  name: string;
  shortCity: string;
  captain: string;
  homeGround: string;
  titles: number;
  primaryColor: string;
  secondaryColor: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface LeaguePayload {
  teams: TeamInfo[];
  players: Player[];
  lastAiSync: string | null;
  aiSyncNotes: string | null;
  groundingSources: GroundingSource[];
}

export interface ComputedPlayerMetrics {
  player: Player;
  impactScore: number;
  battingImpact: number;
  bowlingImpact: number;
  war: number; // Wins Above Replacement estimate
  dotBallPctBat: number;
  boundaryPctBat: number;
  dotBallPctBowl: number;
  zStrikeRate: number;
  zBattingAvg: number;
  zEconomy: number;
  zBowlingSR: number;
  archetype: string;
  consistencyIndex: number;
}

export interface TeamPowerMetrics {
  team: TeamInfo;
  playerCount: number;
  battersCount: number;
  bowlersCount: number;
  allRoundersCount: number;
  avgImpact: number;
  overallScore: number;
  leagueRank: number;
  totalWar: number;
  battingPower: number;
  bowlingPower: number;
  allRounderDepth: number;
  avgStrikeRate: number;
  avgEconomy: number;
  avgDotBallControl: number;
  totalRuns: number;
  totalWickets: number;
}
