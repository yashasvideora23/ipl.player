import type {
  ComputedPlayerMetrics,
  Player,
  TeamInfo,
  TeamPowerMetrics,
} from '../types/ipl';

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 1;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

export function zScore(value: number, m: number, sd: number): number {
  if (!sd || sd === 0) return 0;
  return (value - m) / sd;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function oversToBalls(overs: number): number {
  const whole = Math.floor(overs);
  const part = Math.round((overs - whole) * 10);
  return whole * 6 + Math.min(part, 5);
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  pearsonR: number;
}

export function computeLinearRegression(
  points: Array<{ x: number; y: number }>
): RegressionResult {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, rSquared: 0, pearsonR: 0 };
  }
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    return { slope: 0, intercept: my, rSquared: 0, pearsonR: 0 };
  }

  const slope = num / denX;
  const intercept = my - slope * mx;
  const pearsonR = num / Math.sqrt(denX * denY);
  const rSquared = pearsonR * pearsonR;

  return { slope, intercept, rSquared, pearsonR };
}

function assignArchetype(
  p: Player,
  dotBallPctBat: number,
  boundaryPctBat: number,
  dotBallPctBowl: number
): string {
  if (p.category === 'Batsman') {
    if (p.batting.strikeRate >= 150 && boundaryPctBat >= 20) return 'Explosive Power Hitter';
    if (p.batting.average >= 36 && dotBallPctBat <= 36) return 'Elite Anchor Engine';
    if (p.batting.strikeRate >= 138) return 'Tempo Accelerator';
    return 'Classical Accumulator';
  }
  if (p.category === 'Bowler') {
    if (p.bowling.economy <= 7.6 && dotBallPctBowl >= 38) return 'Control & Dot Restrictor';
    if (p.bowling.bowlingStrikeRate > 0 && p.bowling.bowlingStrikeRate <= 19) return 'Wicket-Taking Enforcer';
    if (p.bowling.economy <= 8.2) return 'Middle-Overs Tactician';
    return 'Death-Overs Specialist';
  }
  // All-Rounder
  const strongBat = p.batting.strikeRate >= 142 && p.batting.runs >= 1000;
  const strongBowl = p.bowling.wickets >= 50 && p.bowling.economy <= 8.5;
  if (strongBat && strongBowl) return 'Two-Way Matchwinner';
  if (p.batting.strikeRate >= 155) return 'Finisher All-Rounder';
  if (p.bowling.economy <= 7.8) return 'Bowling-First All-Rounder';
  return 'Utility Balance Option';
}

export function computeLeagueAnalytics(players: Player[]): ComputedPlayerMetrics[] {
  const battersPool = players.filter(
    (p) => p.category === 'Batsman' || (p.category === 'All-Rounder' && p.batting.ballsFaced > 0)
  );
  const bowlersPool = players.filter(
    (p) => p.category === 'Bowler' || (p.category === 'All-Rounder' && p.bowling.overs > 0)
  );

  const batSRs = battersPool.map((p) => p.batting.strikeRate);
  const batAvgs = battersPool.map((p) => p.batting.average);
  const batDotPcts = battersPool.map((p) =>
    p.batting.ballsFaced > 0 ? (p.batting.dotBallsFaced / p.batting.ballsFaced) * 100 : 35
  );

  const bowlEcons = bowlersPool.map((p) => p.bowling.economy).filter((e) => e > 0);
  const bowlSRs = bowlersPool.map((p) => p.bowling.bowlingStrikeRate).filter((s) => s > 0);
  const bowlDotPcts = bowlersPool.map((p) => {
    const balls = oversToBalls(p.bowling.overs);
    return balls > 0 ? (p.bowling.dotBallsBowled / balls) * 100 : 35;
  });

  const mBatSR = mean(batSRs);
  const sdBatSR = stdDev(batSRs);
  const mBatAvg = mean(batAvgs);
  const sdBatAvg = stdDev(batAvgs);
  const mBatDot = mean(batDotPcts);
  const sdBatDot = stdDev(batDotPcts);

  const mBowlEcon = mean(bowlEcons);
  const sdBowlEcon = stdDev(bowlEcons);
  const mBowlSR = mean(bowlSRs);
  const sdBowlSR = stdDev(bowlSRs);
  const mBowlDot = mean(bowlDotPcts);
  const sdBowlDot = stdDev(bowlDotPcts);

  return players.map((p) => {
    const ballsFaced = p.batting.ballsFaced || 0;
    const dotBallPctBat = ballsFaced > 0 ? (p.batting.dotBallsFaced / ballsFaced) * 100 : 0;
    const boundaryCount = p.batting.fours + p.batting.sixes;
    const boundaryPctBat = ballsFaced > 0 ? (boundaryCount / ballsFaced) * 100 : 0;

    const bowlBalls = oversToBalls(p.bowling.overs || 0);
    const dotBallPctBowl = bowlBalls > 0 ? (p.bowling.dotBallsBowled / bowlBalls) * 100 : 0;

    const zSR = ballsFaced > 0 ? zScore(p.batting.strikeRate, mBatSR, sdBatSR) : 0;
    const zAvg = ballsFaced > 0 ? zScore(p.batting.average, mBatAvg, sdBatAvg) : 0;
    const zDotBat = ballsFaced > 0 ? -zScore(dotBallPctBat, mBatDot, sdBatDot) : 0;

    const zEcon = p.bowling.economy > 0 ? -zScore(p.bowling.economy, mBowlEcon, sdBowlEcon) : 0;
    const zBSR =
      p.bowling.bowlingStrikeRate > 0
        ? -zScore(p.bowling.bowlingStrikeRate, mBowlSR, sdBowlSR)
        : 0;
    const zDotBowl = bowlBalls > 0 ? zScore(dotBallPctBowl, mBowlDot, sdBowlDot) : 0;

    // Batting sub-score 0-100
    const rawBatZ = 0.42 * zSR + 0.33 * zAvg + 0.25 * zDotBat;
    const battingImpact =
      ballsFaced > 0 ? clamp(Math.round((55 + rawBatZ * 16) * 10) / 10, 15, 99) : 0;

    // Bowling sub-score 0-100
    const rawBowlZ = 0.42 * zEcon + 0.35 * zBSR + 0.23 * zDotBowl;
    const bowlingImpact =
      bowlBalls > 0 ? clamp(Math.round((55 + rawBowlZ * 16) * 10) / 10, 15, 99) : 0;

    let impactScore = 0;
    if (p.category === 'Batsman') {
      impactScore = battingImpact;
    } else if (p.category === 'Bowler') {
      impactScore = bowlingImpact;
    } else {
      // All-rounder composite with balance synergy bonus
      const base = 0.5 * battingImpact + 0.5 * bowlingImpact;
      const balanceBonus =
        battingImpact > 0 && bowlingImpact > 0
          ? (1 - Math.abs(battingImpact - bowlingImpact) / 100) * 8
          : 0;
      impactScore = clamp(Math.round((base + balanceBonus) * 10) / 10, 20, 99.5);
    }

    // Estimated Wins Above Replacement (WAR) per 14-match IPL season
    const war = Math.round(((impactScore - 42) / 14) * 100) / 100;

    // Consistency index from volume + boundary/dot balance
    const matchesPlayed = Math.max(p.batting.matches, p.bowling.matches, 1);
    const volumeFactor = clamp(Math.log10(matchesPlayed + 1) / 2.4, 0.25, 1);
    const consistencyIndex = clamp(
      Math.round((impactScore * 0.72 + volumeFactor * 28) * 10) / 10,
      10,
      98
    );

    const archetype = assignArchetype(p, dotBallPctBat, boundaryPctBat, dotBallPctBowl);

    return {
      player: p,
      impactScore,
      battingImpact,
      bowlingImpact,
      war,
      dotBallPctBat: Math.round(dotBallPctBat * 10) / 10,
      boundaryPctBat: Math.round(boundaryPctBat * 10) / 10,
      dotBallPctBowl: Math.round(dotBallPctBowl * 10) / 10,
      zStrikeRate: Math.round(zSR * 100) / 100,
      zBattingAvg: Math.round(zAvg * 100) / 100,
      zEconomy: Math.round(zEcon * 100) / 100,
      zBowlingSR: Math.round(zBSR * 100) / 100,
      archetype,
      consistencyIndex,
    };
  });
}

export function computeTeamPowerMetrics(
  teams: TeamInfo[],
  playerMetrics: ComputedPlayerMetrics[]
): TeamPowerMetrics[] {
  const raw = teams.map((team) => {
    const roster = playerMetrics.filter((m) => m.player.team === team.code);
    const batters = roster.filter((m) => m.battingImpact > 0);
    const bowlers = roster.filter((m) => m.bowlingImpact > 0);
    const allRounders = roster.filter((m) => m.player.category === 'All-Rounder');

    const avgImpact = roster.length > 0 ? mean(roster.map((m) => m.impactScore)) : 0;
    const battingPower = batters.length > 0 ? mean(batters.map((m) => m.battingImpact)) : 0;
    const bowlingPower = bowlers.length > 0 ? mean(bowlers.map((m) => m.bowlingImpact)) : 0;
    const allRounderDepth =
      allRounders.length > 0 ? mean(allRounders.map((m) => m.impactScore)) : 0;
    const totalWar =
      Math.round(roster.reduce((s, m) => s + m.war, 0) * 100) / 100;

    const overallScore =
      roster.length > 0
        ? Math.round(
            (0.38 * battingPower +
              0.38 * bowlingPower +
              0.24 * (allRounderDepth > 0 ? allRounderDepth : avgImpact)) *
              10
          ) / 10
        : 0;

    const avgStrikeRate =
      batters.length > 0 ? mean(batters.map((m) => m.player.batting.strikeRate)) : 0;
    const avgEconomy =
      bowlers.length > 0 ? mean(bowlers.map((m) => m.player.bowling.economy)) : 0;

    const dotControls: number[] = [];
    for (const m of roster) {
      if (m.dotBallPctBat > 0) dotControls.push(100 - m.dotBallPctBat);
      if (m.dotBallPctBowl > 0) dotControls.push(m.dotBallPctBowl);
    }
    const avgDotBallControl = dotControls.length > 0 ? mean(dotControls) : 0;

    return {
      team,
      playerCount: roster.length,
      battersCount: roster.filter((m) => m.player.category === 'Batsman').length,
      bowlersCount: roster.filter((m) => m.player.category === 'Bowler').length,
      allRoundersCount: allRounders.length,
      avgImpact: Math.round(avgImpact * 10) / 10,
      overallScore,
      leagueRank: 1,
      totalWar,
      battingPower: Math.round(battingPower * 10) / 10,
      bowlingPower: Math.round(bowlingPower * 10) / 10,
      allRounderDepth: Math.round(allRounderDepth * 10) / 10,
      avgStrikeRate: Math.round(avgStrikeRate * 10) / 10,
      avgEconomy: Math.round(avgEconomy * 100) / 100,
      avgDotBallControl: Math.round(avgDotBallControl * 10) / 10,
      totalRuns: roster.reduce((s, m) => s + m.player.batting.runs, 0),
      totalWickets: roster.reduce((s, m) => s + m.player.bowling.wickets, 0),
    };
  });

  const sortedCodes = [...raw]
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((item) => item.team.code);

  return raw.map((item) => ({
    ...item,
    leagueRank: sortedCodes.indexOf(item.team.code) + 1,
  }));
}
