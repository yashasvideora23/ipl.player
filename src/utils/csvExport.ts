import type { ComputedPlayerMetrics, TeamInfo } from '../types/ipl';

function csvEscape(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadPlayerCsv(
  metrics: ComputedPlayerMetrics,
  team?: TeamInfo
): void {
  const { player } = metrics;
  const recentFormSummary = (player.recentForm || [])
    .map((f) => `${f.match}:${f.label}(${f.score})`)
    .join(' | ');

  const headers = [
    'Player ID',
    'Player Name',
    'Team Code',
    'Team Name',
    'Team Captain',
    'Category',
    'Is Player Captain',
    'Nationality',
    'Jersey Number',
    'Archetype',
    'Composite Impact Score',
    'Batting Impact Index',
    'Bowling Impact Index',
    'Estimated WAR',
    'Consistency Index (%)',
    'Bat Matches',
    'Bat Innings',
    'Total Runs',
    'Balls Faced',
    'Dot Balls Faced',
    'Bat Dot Ball (%)',
    'Batting Strike Rate',
    'Batting Average',
    'Fours (4s)',
    'Sixes (6s)',
    'Boundary (%)',
    'Fifties (50s)',
    'Hundreds (100s)',
    'High Score',
    'Z-Score Strike Rate',
    'Z-Score Batting Avg',
    'Bowl Matches',
    'Bowl Innings',
    'Overs Bowled',
    'Runs Conceded',
    'Wickets',
    'Dot Balls Bowled',
    'Bowl Dot Ball (%)',
    'Economy Rate',
    'Bowling Average',
    'Bowling Strike Rate',
    'Maidens',
    '4W+ Hauls',
    'Best Figures',
    'Z-Score Economy',
    'Z-Score Bowling SR',
    'Last 5 Matches Form',
    'Last Updated',
  ];

  const values = [
    player.id,
    player.name,
    player.team,
    team?.name ?? player.team,
    team?.captain ?? '',
    player.category,
    player.isCaptain ? 'Yes' : 'No',
    player.nationality,
    player.jerseyNumber,
    metrics.archetype,
    metrics.impactScore,
    metrics.battingImpact,
    metrics.bowlingImpact,
    metrics.war,
    metrics.consistencyIndex,
    player.batting.matches,
    player.batting.innings,
    player.batting.runs,
    player.batting.ballsFaced,
    player.batting.dotBallsFaced,
    metrics.dotBallPctBat,
    player.batting.strikeRate,
    player.batting.average,
    player.batting.fours,
    player.batting.sixes,
    metrics.boundaryPctBat,
    player.batting.fifties,
    player.batting.hundreds,
    player.batting.highScore,
    metrics.zStrikeRate,
    metrics.zBattingAvg,
    player.bowling.matches,
    player.bowling.innings,
    player.bowling.overs,
    player.bowling.runsConceded,
    player.bowling.wickets,
    player.bowling.dotBallsBowled,
    metrics.dotBallPctBowl,
    player.bowling.economy,
    player.bowling.bowlingAverage,
    player.bowling.bowlingStrikeRate,
    player.bowling.maidens,
    player.bowling.fourWickets,
    player.bowling.bestFigures,
    metrics.zEconomy,
    metrics.zBowlingSR,
    recentFormSummary,
    player.lastUpdated,
  ];

  const csvContent = `${headers.map(csvEscape).join(',')}\n${values
    .map(csvEscape)
    .join(',')}\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = player.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.href = url;
  link.download = `${slug || 'player'}-${player.team.toLowerCase()}-ipl-stats.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
