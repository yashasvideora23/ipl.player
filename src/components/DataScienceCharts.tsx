import React, { useMemo, useState } from 'react';
import type { ComputedPlayerMetrics, TeamInfo, TeamPowerMetrics } from '../types/ipl';
import { computeLinearRegression } from '../utils/analytics';
import { PlayerAvatar } from './PlayerAvatar';

type ScatterLens =
  | 'runs_vs_balls'
  | 'sr_vs_dot'
  | 'econ_vs_bsr'
  | 'allrounder_dual';

interface DataScienceChartsProps {
  metrics: ComputedPlayerMetrics[];
  teamPower: TeamPowerMetrics[];
  teams: TeamInfo[];
  onSelectPlayer: (m: ComputedPlayerMetrics) => void;
}

export const DataScienceCharts: React.FC<DataScienceChartsProps> = ({
  metrics,
  teamPower,
  teams,
  onSelectPlayer,
}) => {
  const [lens, setLens] = useState<ScatterLens>('sr_vs_dot');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>(metrics[0]?.player.id || '');
  const [compareB, setCompareB] = useState<string>(metrics[1]?.player.id || '');

  const teamColorMap = useMemo(() => {
    const map = new Map<string, TeamInfo>();
    teams.forEach((t) => map.set(t.code, t));
    return map;
  }, [teams]);

  const scatterData = useMemo(() => {
    let filtered = metrics;
    let xLabel = '';
    let yLabel = '';

    if (lens === 'runs_vs_balls') {
      filtered = metrics.filter((m) => m.player.batting.ballsFaced > 0);
      xLabel = 'Balls Faced';
      yLabel = 'Total Runs Scored';
    } else if (lens === 'sr_vs_dot') {
      filtered = metrics.filter((m) => m.player.batting.ballsFaced > 0);
      xLabel = 'Dot Ball % (Faced)';
      yLabel = 'Batting Strike Rate';
    } else if (lens === 'econ_vs_bsr') {
      filtered = metrics.filter(
        (m) => m.player.bowling.overs > 0 && m.player.bowling.bowlingStrikeRate > 0
      );
      xLabel = 'Bowling Economy';
      yLabel = 'Bowling Strike Rate';
    } else {
      filtered = metrics.filter((m) => m.player.category === 'All-Rounder');
      xLabel = 'Batting Impact Index';
      yLabel = 'Bowling Impact Index';
    }

    const points = filtered.map((m) => {
      let x = 0;
      let y = 0;
      if (lens === 'runs_vs_balls') {
        x = m.player.batting.ballsFaced;
        y = m.player.batting.runs;
      } else if (lens === 'sr_vs_dot') {
        x = m.dotBallPctBat;
        y = m.player.batting.strikeRate;
      } else if (lens === 'econ_vs_bsr') {
        x = m.player.bowling.economy;
        y = m.player.bowling.bowlingStrikeRate;
      } else {
        x = m.battingImpact;
        y = m.bowlingImpact;
      }
      return { m, x, y };
    });

    const regression = computeLinearRegression(points.map((p) => ({ x: p.x, y: p.y })));
    return { points, regression, xLabel, yLabel };
  }, [metrics, lens]);

  const width = 680;
  const height = 340;
  const pad = { top: 24, right: 28, bottom: 44, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (scatterData.points.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }
    const xs = scatterData.points.map((p) => p.x);
    const ys = scatterData.points.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xPad = (xMax - xMin || 10) * 0.12;
    const yPad = (yMax - yMin || 10) * 0.12;
    return {
      minX: Math.max(0, xMin - xPad),
      maxX: xMax + xPad,
      minY: Math.max(0, yMin - yPad),
      maxY: yMax + yPad,
    };
  }, [scatterData.points]);

  const scaleX = (x: number) =>
    pad.left + ((x - minX) / (maxX - minX || 1)) * plotW;
  const scaleY = (y: number) =>
    pad.top + plotH - ((y - minY) / (maxY - minY || 1)) * plotH;

  const hoveredPoint = scatterData.points.find((p) => p.m.player.id === hoveredId) || null;

  const playerA = metrics.find((m) => m.player.id === compareA) || metrics[0];
  const playerB = metrics.find((m) => m.player.id === compareB) || metrics[1] || metrics[0];

  const regLineY1 = scatterData.regression.slope * minX + scatterData.regression.intercept;
  const regLineY2 = scatterData.regression.slope * maxX + scatterData.regression.intercept;

  return (
    <div className="space-y-8">
      {/* Row 1: OLS Regression Scatter & Head-to-Head Model Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: OLS Regression Scatter */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-display font-bold text-slate-900">
                OLS Linear Regression &amp; Efficiency Frontier
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ordinary least squares fit across active IPL cohort · Hover any node to inspect residuals
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-700 shrink-0">
              <span>R² = {scatterData.regression.rSquared.toFixed(3)}</span>
              <span className="text-slate-300">|</span>
              <span>r = {scatterData.regression.pearsonR.toFixed(3)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg mb-4">
            {(
              [
                ['sr_vs_dot', 'Strike Rate vs Dot %'],
                ['runs_vs_balls', 'Runs vs Balls Faced'],
                ['econ_vs_bsr', 'Economy vs Bowling SR'],
                ['allrounder_dual', 'All-Rounder Dual Balance'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLens(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  lens === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-h-[300px]">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const yVal = minY + t * (maxY - minY);
                const yPos = scaleY(yVal);
                const xVal = minX + t * (maxX - minX);
                const xPos = scaleX(xVal);
                return (
                  <g key={t}>
                    <line
                      x1={pad.left}
                      y1={yPos}
                      x2={width - pad.right}
                      y2={yPos}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={pad.left - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {yVal >= 100 ? Math.round(yVal) : yVal.toFixed(1)}
                    </text>
                    <line
                      x1={xPos}
                      y1={pad.top}
                      x2={xPos}
                      y2={height - pad.bottom}
                      stroke="#f1f5f9"
                    />
                    <text
                      x={xPos}
                      y={height - pad.bottom + 16}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {xVal >= 100 ? Math.round(xVal) : xVal.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line
                x1={pad.left}
                y1={height - pad.bottom}
                x2={width - pad.right}
                y2={height - pad.bottom}
                stroke="#94a3b8"
              />
              <line
                x1={pad.left}
                y1={pad.top}
                x2={pad.left}
                y2={height - pad.bottom}
                stroke="#94a3b8"
              />

              {/* Axis Labels */}
              <text
                x={pad.left + plotW / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {scatterData.xLabel}
              </text>
              <text
                x={14}
                y={pad.top + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${pad.top + plotH / 2})`}
                className="fill-slate-600 text-[11px] font-medium"
              >
                {scatterData.yLabel}
              </text>

              {/* OLS Regression Line */}
              {scatterData.points.length >= 2 && (
                <line
                  x1={scaleX(minX)}
                  y1={Math.max(pad.top, Math.min(height - pad.bottom, scaleY(regLineY1)))}
                  x2={scaleX(maxX)}
                  y2={Math.max(pad.top, Math.min(height - pad.bottom, scaleY(regLineY2)))}
                  stroke="#2563eb"
                  strokeWidth={1.75}
                  strokeDasharray="6 4"
                  opacity={0.75}
                />
              )}

              {/* Data Nodes */}
              {scatterData.points.map(({ m, x, y }) => {
                const cx = scaleX(x);
                const cy = scaleY(y);
                const color = teamColorMap.get(m.player.team)?.primaryColor || '#0f172a';
                const isHovered = hoveredId === m.player.id;
                const radius = isHovered ? 8 : Math.max(4.5, Math.min(7.5, m.impactScore / 14));
                return (
                  <g
                    key={m.player.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredId(m.player.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectPlayer(m)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={color}
                      fillOpacity={isHovered ? 1 : 0.82}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                    {isHovered && (
                      <text
                        x={cx}
                        y={cy - 12}
                        textAnchor="middle"
                        className="fill-slate-900 text-[11px] font-semibold"
                      >
                        {m.player.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover Inspector Strip */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs min-h-[36px]">
              {hoveredPoint ? (
                <div className="flex flex-wrap items-center gap-3 text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {hoveredPoint.m.player.name} ({hoveredPoint.m.player.team})
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{hoveredPoint.m.archetype}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums">
                    {scatterData.xLabel}: {hoveredPoint.x.toFixed(1)}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums">
                    {scatterData.yLabel}: {hoveredPoint.y.toFixed(1)}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums font-semibold text-blue-700">
                    Impact {hoveredPoint.m.impactScore}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400">
                  Hover or click any scatter point to inspect player regression metrics and edit profile.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Head-to-Head Z-Score Comparison */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-display font-bold text-slate-900">
              Head-to-Head Statistical Profile
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Normalized league Z-scores &amp; multi-dimensional performance delta
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <select
              value={playerA?.player.id || ''}
              onChange={(e) => setCompareA(e.target.value)}
              aria-label="Select first player to compare"
              className="w-full px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              {metrics.map((m) => (
                <option key={m.player.id} value={m.player.id}>
                  {m.player.team} · {m.player.name}
                </option>
              ))}
            </select>
            <select
              value={playerB?.player.id || ''}
              onChange={(e) => setCompareB(e.target.value)}
              aria-label="Select second player to compare"
              className="w-full px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
            >
              {metrics.map((m) => (
                <option key={m.player.id} value={m.player.id}>
                  {m.player.team} · {m.player.name}
                </option>
              ))}
            </select>
          </div>

          {playerA && playerB && (
            <>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                {[playerA, playerB].map((pm, idx) => {
                  const t = teamColorMap.get(pm.player.team);
                  return (
                    <div key={`${pm.player.id}-${idx}`} className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        player={pm.player}
                        teamColor={t?.primaryColor || '#0f172a'}
                        secondaryColor={t?.secondaryColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {pm.player.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {pm.player.team} · {pm.player.category}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3.5 mt-4 flex-1">
                {[
                  { label: 'Composite Impact (0-100)', a: playerA.impactScore, b: playerB.impactScore, max: 100 },
                  { label: 'Batting Impact Index', a: playerA.battingImpact, b: playerB.battingImpact, max: 100 },
                  { label: 'Bowling Impact Index', a: playerA.bowlingImpact, b: playerB.bowlingImpact, max: 100 },
                  { label: 'Consistency Index', a: playerA.consistencyIndex, b: playerB.consistencyIndex, max: 100 },
                  {
                    label: 'Boundary % (Bat)',
                    a: playerA.boundaryPctBat,
                    b: playerB.boundaryPctBat,
                    max: 40,
                  },
                  {
                    label: 'Dot Control (100 - Bat Dot%)',
                    a: playerA.player.batting.ballsFaced > 0 ? 100 - playerA.dotBallPctBat : playerA.dotBallPctBowl,
                    b: playerB.player.batting.ballsFaced > 0 ? 100 - playerB.dotBallPctBat : playerB.dotBallPctBowl,
                    max: 100,
                  },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-mono tabular-nums font-semibold text-blue-700">
                        {row.a.toFixed(1)}
                      </span>
                      <span className="text-slate-600">{row.label}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {row.b.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 h-2">
                      <div className="bg-slate-100 rounded-l-sm flex justify-end overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-200"
                          style={{ width: `${Math.min(100, (row.a / row.max) * 100)}%` }}
                        />
                      </div>
                      <div className="bg-slate-100 rounded-r-sm flex justify-start overflow-hidden">
                        <div
                          className="bg-slate-800 h-full transition-all duration-200"
                          style={{ width: `${Math.min(100, (row.b / row.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                <span>
                  WAR: <strong className="text-blue-700">{playerA.war >= 0 ? `+${playerA.war}` : playerA.war}</strong>
                </span>
                <span>Estimated Wins Above Replacement</span>
                <span>
                  WAR: <strong className="text-slate-900">{playerB.war >= 0 ? `+${playerB.war}` : playerB.war}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: 10-Franchise Power Balance Matrix (MI -> KKR exact order) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-display font-bold text-slate-900">
              Franchise Power Index Matrix (MI → KKR)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mean Z-score derived Batting Power, Bowling Power, and All-Rounder Depth per IPL squad
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
              Batting Power
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 inline-block" />
              Bowling Power
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              All-Rounder Depth
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                <th className="py-2.5 pr-4">Franchise</th>
                <th className="py-2.5 px-3">Captain</th>
                <th className="py-2.5 px-3 text-right">Squad</th>
                <th className="py-2.5 px-3 text-right">Avg SR</th>
                <th className="py-2.5 px-3 text-right">Avg Econ</th>
                <th className="py-2.5 px-3 text-right">Dot Control</th>
                <th className="py-2.5 pl-4 w-64">Power Decomposition (Bat / Bowl / AR)</th>
                <th className="py-2.5 pl-3 text-right">Team Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {teamPower.map((tp) => (
                <tr key={tp.team.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2 h-5 rounded-xs shrink-0"
                        style={{ backgroundColor: tp.team.primaryColor }}
                      />
                      <div>
                        <span className="font-display font-bold text-slate-900">
                          {tp.team.code}
                        </span>
                        <span className="text-slate-500 ml-2 hidden sm:inline">
                          {tp.team.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                    {tp.team.captain}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {tp.playerCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                    {tp.avgStrikeRate.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                    {tp.avgEconomy.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                    {tp.avgDotBallControl.toFixed(1)}%
                  </td>
                  <td className="py-3 pl-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${tp.battingPower}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[10px] text-slate-500 w-7 text-right">
                          {tp.battingPower.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-800"
                            style={{ width: `${tp.bowlingPower}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[10px] text-slate-500 w-7 text-right">
                          {tp.bowlingPower.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${tp.allRounderDepth}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums text-[10px] text-slate-500 w-7 text-right">
                          {tp.allRounderDepth.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pl-3 text-right font-mono tabular-nums font-bold text-slate-900">
                    {tp.avgImpact.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
