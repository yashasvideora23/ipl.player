import React from 'react';
import type { TeamCode, TeamPowerMetrics } from '../types/ipl';

interface OverallTeamPerformanceProps {
  selectedTeam: TeamCode | 'ALL';
  teamPower: TeamPowerMetrics[];
  onSelectTeam: (code: TeamCode) => void;
}

export const OverallTeamPerformance: React.FC<OverallTeamPerformanceProps> = ({
  selectedTeam,
  teamPower,
  onSelectTeam,
}) => {
  if (teamPower.length === 0) return null;

  if (selectedTeam === 'ALL') {
    const sorted = [...teamPower].sort((a, b) => b.overallScore - a.overallScore);
    return (
      <section
        aria-label="Overall IPL Team Performance Comparison"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900">
              Overall Team Performance Leaderboard (All 10 Franchises)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Composite squad strength combining Batting Power (38%), Bowling Power (38%), and All-Rounder Depth (24%)
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Click any team to inspect squad
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {sorted.map((tp) => (
            <button
              key={tp.team.code}
              type="button"
              onClick={() => onSelectTeam(tp.team.code)}
              className="text-left p-3.5 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer bg-slate-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-4 rounded-xs shrink-0"
                    style={{ backgroundColor: tp.team.primaryColor }}
                  />
                  <span className="text-xs font-display font-bold text-slate-900">
                    #{tp.leagueRank} {tp.team.code}
                  </span>
                </div>
                <span className="text-sm font-mono tabular-nums font-bold text-blue-700">
                  {tp.overallScore}
                </span>
              </div>

              <div className="text-[11px] text-slate-500 truncate mt-1">
                C: {tp.team.captain} · {tp.playerCount} players
              </div>

              <div className="mt-2.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, tp.overallScore)}%`,
                    backgroundColor: tp.team.primaryColor,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-600">
                <span>Bat {tp.battingPower}</span>
                <span>Bowl {tp.bowlingPower}</span>
                <span>WAR {tp.totalWar >= 0 ? `+${tp.totalWar}` : tp.totalWar}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const active = teamPower.find((tp) => tp.team.code === selectedTeam);
  if (!active) return null;

  const totalSquad = Math.max(active.playerCount, 1);
  const batPct = Math.round((active.battersCount / totalSquad) * 100);
  const bowlPct = Math.round((active.bowlersCount / totalSquad) * 100);
  const arPct = Math.max(0, 100 - batPct - bowlPct);

  return (
    <section
      aria-label="Selected Team Overall Performance"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-display font-bold text-slate-900">
            Overall Team Performance — {active.team.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Captain: <span className="font-semibold text-slate-800">{active.team.captain}</span> · League Rank #{active.leagueRank} of {teamPower.length} · Squad Size {active.playerCount}
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div>
            <div className="text-[11px] text-slate-500">Overall Rating</div>
            <div className="text-2xl font-mono tabular-nums font-bold text-slate-900">
              {active.overallScore}
              <span className="text-xs font-normal text-slate-400"> / 100</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="text-[11px] text-slate-500">Franchise WAR</div>
            <div className="text-2xl font-mono tabular-nums font-bold text-blue-700">
              {active.totalWar >= 0 ? `+${active.totalWar}` : active.totalWar}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Unit Performance Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Batting Unit</span>
            <span className="font-mono tabular-nums font-bold text-blue-700">
              {active.battingPower} / 100
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${Math.min(100, active.battingPower)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
            <span>{active.totalRuns.toLocaleString()} Runs</span>
            <span>Mean SR {active.avgStrikeRate}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Bowling Unit</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {active.bowlingPower} / 100
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full"
              style={{ width: `${Math.min(100, active.bowlingPower)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
            <span>{active.totalWickets} Wickets</span>
            <span>Mean Econ {active.avgEconomy}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">All-Rounder &amp; Control</span>
            <span className="font-mono tabular-nums font-bold text-amber-700">
              {active.allRounderDepth} / 100
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${Math.min(100, active.allRounderDepth)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
            <span>{active.allRoundersCount} All-Rounders</span>
            <span>Dot Control {active.avgDotBallControl}%</span>
          </div>
        </div>
      </div>

      {/* Squad Composition Distribution Bar */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-600">
          <span>
            Batters: <strong className="font-mono tabular-nums text-slate-900">{active.battersCount}</strong>
          </span>
          <span>
            Bowlers: <strong className="font-mono tabular-nums text-slate-900">{active.bowlersCount}</strong>
          </span>
          <span>
            All-Rounders: <strong className="font-mono tabular-nums text-slate-900">{active.allRoundersCount}</strong>
          </span>
        </div>
        <div className="flex items-center h-2 w-full sm:w-64 rounded-full overflow-hidden bg-slate-100">
          <div className="h-full bg-blue-600" style={{ width: `${batPct}%` }} title={`Batters ${batPct}%`} />
          <div className="h-full bg-slate-800" style={{ width: `${bowlPct}%` }} title={`Bowlers ${bowlPct}%`} />
          <div className="h-full bg-amber-500" style={{ width: `${arPct}%` }} title={`All-Rounders ${arPct}%`} />
        </div>
      </div>
    </section>
  );
};
