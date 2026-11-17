import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Camera,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CodeExportView } from './components/CodeExportView';
import { DataScienceCharts } from './components/DataScienceCharts';
import { OverallTeamPerformance } from './components/OverallTeamPerformance';
import { PlayerAvatar } from './components/PlayerAvatar';
import { PlayerModal } from './components/PlayerModal';
import { PlayerTransferModal } from './components/PlayerTransferModal';
import type {
  ComputedPlayerMetrics,
  LeaguePayload,
  Player,
  PlayerCategory,
  TeamCode,
} from './types/ipl';
import { computeLeagueAnalytics, computeTeamPowerMetrics } from './utils/analytics';
import { downloadPlayerCsv } from './utils/csvExport';

type ActiveSection = 'overview' | 'players' | 'datascience' | 'export';
type SortOption = 'impact' | 'runs' | 'strikeRate' | 'wickets' | 'economy';

export default function App() {
  const [league, setLeague] = useState<LeaguePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [selectedTeam, setSelectedTeam] = useState<TeamCode | 'ALL'>('MI');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PlayerCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('impact');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals & inline editing
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [transferPlayer, setTransferPlayer] = useState<Player | null>(null);
  const [editingCaptain, setEditingCaptain] = useState(false);
  const [captainDraft, setCaptainDraft] = useState('');

  // Autonomous AI Sync, Photo API & Data Science Insights
  const [syncingAi, setSyncingAi] = useState(false);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [insightsText, setInsightsText] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const fetchLeagueData = useCallback(async () => {
    try {
      setError(null);
      const resp = await fetch('/api/data');
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to load IPL analytics data.');
      setLeague(json as LeaguePayload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeagueData();
  }, [fetchLeagueData]);

  const handleAiSync = useCallback(
    async (scope: TeamCode | 'ALL' = selectedTeam) => {
      if (syncingAi) return;
      setSyncingAi(true);
      setError(null);
      try {
        const resp = await fetch('/api/ai/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamCode: scope }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'AI auto-sync failed.');
        setLeague(json.data as LeaguePayload);
        setAiMessage(
          `AI synchronized ${json.updatedCount} player records (${scope === 'ALL' ? 'League-wide' : scope}).`
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSyncingAi(false);
      }
    },
    [selectedTeam, syncingAi]
  );

  const handleSyncPhotos = useCallback(async () => {
    if (syncingPhotos) return;
    setSyncingPhotos(true);
    setError(null);
    try {
      const resp = await fetch('/api/ai/fetch-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode: selectedTeam }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Photo API sync failed.');
      setLeague(json.data as LeaguePayload);
      setAiMessage(
        `Photo API updated portraits for ${json.updatedCount} players (${selectedTeam === 'ALL' ? 'All Teams' : selectedTeam}).`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncingPhotos(false);
    }
  }, [selectedTeam, syncingPhotos]);

  // Optional autonomous background polling when user enables Auto-Sync
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const timer = setInterval(() => {
      handleAiSync(selectedTeam);
    }, 60000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled, handleAiSync, selectedTeam]);

  const allMetrics = useMemo(() => {
    if (!league) return [];
    return computeLeagueAnalytics(league.players);
  }, [league]);

  const teamPower = useMemo(() => {
    if (!league) return [];
    return computeTeamPowerMetrics(league.teams, allMetrics);
  }, [league, allMetrics]);

  const teamMap = useMemo(() => {
    const map = new Map<TeamCode, LeaguePayload['teams'][number]>();
    league?.teams.forEach((t) => map.set(t.code, t));
    return map;
  }, [league]);

  const activeTeamInfo = selectedTeam === 'ALL' ? null : teamMap.get(selectedTeam) || null;
  const activeTeamPower =
    selectedTeam === 'ALL'
      ? null
      : teamPower.find((tp) => tp.team.code === selectedTeam) || null;

  const filteredMetrics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allMetrics.filter((m) => {
      if (selectedTeam !== 'ALL' && m.player.team !== selectedTeam) return false;
      if (categoryFilter !== 'ALL' && m.player.category !== categoryFilter) return false;
      if (
        q &&
        !m.player.name.toLowerCase().includes(q) &&
        !m.player.team.toLowerCase().includes(q) &&
        !m.archetype.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'impact') return b.impactScore - a.impactScore;
      if (sortBy === 'runs') return b.player.batting.runs - a.player.batting.runs;
      if (sortBy === 'strikeRate') return b.player.batting.strikeRate - a.player.batting.strikeRate;
      if (sortBy === 'wickets') return b.player.bowling.wickets - a.player.bowling.wickets;
      if (sortBy === 'economy') {
        const ea = a.player.bowling.economy || 99;
        const eb = b.player.bowling.economy || 99;
        return ea - eb;
      }
      return 0;
    });

    return list;
  }, [allMetrics, selectedTeam, categoryFilter, searchQuery, sortBy]);

  const leagueSummaryKPIs = useMemo(() => {
    const scope =
      selectedTeam === 'ALL'
        ? allMetrics
        : allMetrics.filter((m) => m.player.team === selectedTeam);
    const batters = scope.filter((m) => m.player.batting.ballsFaced > 0);
    const bowlers = scope.filter((m) => m.player.bowling.overs > 0);

    const avgSR =
      batters.length > 0
        ? batters.reduce((s, m) => s + m.player.batting.strikeRate, 0) / batters.length
        : 0;
    const avgEcon =
      bowlers.length > 0
        ? bowlers.reduce((s, m) => s + m.player.bowling.economy, 0) / bowlers.length
        : 0;
    const avgImpact =
      scope.length > 0
        ? scope.reduce((s, m) => s + m.impactScore, 0) / scope.length
        : 0;
    const totalRuns = scope.reduce((s, m) => s + m.player.batting.runs, 0);
    const totalWickets = scope.reduce((s, m) => s + m.player.bowling.wickets, 0);

    return {
      playerCount: scope.length,
      avgSR: avgSR.toFixed(1),
      avgEcon: avgEcon.toFixed(2),
      avgImpact: avgImpact.toFixed(1),
      totalRuns: totalRuns.toLocaleString(),
      totalWickets: totalWickets.toLocaleString(),
    };
  }, [allMetrics, selectedTeam]);

  const handleSavePlayer = async (
    payload: Omit<Player, 'id' | 'lastUpdated'> & { id?: string }
  ) => {
    if (payload.id) {
      const resp = await fetch(`/api/players/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to update player.');
      setLeague(json.data as LeaguePayload);
    } else {
      const resp = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to add player.');
      setLeague(json.data as LeaguePayload);
    }
  };

  const handleTransferPlayer = async (payload: {
    id: string;
    team: TeamCode;
    category: PlayerCategory;
    isCaptain: boolean;
    replacementCaptainForOldTeam?: string;
  }) => {
    const resp = await fetch(`/api/players/${payload.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || 'Failed to transfer/update player.');
    setLeague(json.data as LeaguePayload);
  };

  const handleDeletePlayer = async (player: Player) => {
    try {
      const resp = await fetch(`/api/players/${player.id}`, { method: 'DELETE' });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to remove player.');
      setLeague(json.data as LeaguePayload);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveCaptain = async () => {
    if (!activeTeamInfo || !captainDraft.trim()) {
      setEditingCaptain(false);
      return;
    }
    try {
      const resp = await fetch(`/api/teams/${activeTeamInfo.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captain: captainDraft.trim() }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to update captain.');
      setLeague(json.data as LeaguePayload);
      setEditingCaptain(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    setError(null);
    try {
      const summaryRows = filteredMetrics
        .slice(0, 8)
        .map(
          (m) =>
            `${m.player.name} (${m.player.team}, ${m.player.category}): Impact=${m.impactScore}, WAR=${m.war}, BatRuns=${m.player.batting.runs}, SR=${m.player.batting.strikeRate}, BatDot%=${m.dotBallPctBat}%, Wkts=${m.player.bowling.wickets}, Econ=${m.player.bowling.economy}, BowlDot%=${m.dotBallPctBowl}%, Archetype=${m.archetype}`
        )
        .join('\n');

      const resp = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextLabel:
            selectedTeam === 'ALL'
              ? 'All 10 IPL Franchises'
              : `${activeTeamInfo?.name} (Captain: ${activeTeamInfo?.captain})`,
          metricsSummary: summaryRows,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to generate insights.');
      setInsightsText(json.insights);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingInsights(false);
    }
  };

  const openAddPlayerModal = () => {
    setEditingPlayer(null);
    setPlayerModalOpen(true);
  };

  const openEditPlayerModal = (player: Player) => {
    setEditingPlayer(player);
    setPlayerModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('overview');
            }}
            className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            IPL QuantLab
          </a>

          {/* Zone 2: 4 Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {(
              [
                ['overview', 'Overview'],
                ['players', 'Squads & Players'],
                ['datascience', 'Data Science Lab'],
                ['export', 'VS & Python Code'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeSection === key
                    ? 'text-slate-900 border-blue-600 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={openAddPlayerModal}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Player
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Strip */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(
          [
            ['overview', 'Overview'],
            ['players', 'Squads'],
            ['datascience', 'Data Science'],
            ['export', 'VS & Python'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === key ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Ordered Franchise Selector Strip on Top: MI -> CSK -> RCB -> GT -> DC -> RR -> LSG -> SRH -> PBKS -> KKR */}
        {league && activeSection !== 'export' && (
          <section aria-label="IPL Franchise Selector" className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTeam('ALL');
                  setEditingCaptain(false);
                }}
                className={`px-3.5 py-2.5 rounded-lg border text-left transition-colors shrink-0 cursor-pointer ${
                  selectedTeam === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-display font-bold whitespace-nowrap">ALL TEAMS</div>
                <div
                  className={`text-[11px] whitespace-nowrap mt-0.5 ${
                    selectedTeam === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  10 Franchises
                </div>
              </button>

              {league.teams.map((team) => {
                const isSelected = selectedTeam === team.code;
                return (
                  <button
                    key={team.code}
                    type="button"
                    onClick={() => {
                      setSelectedTeam(team.code);
                      setEditingCaptain(false);
                    }}
                    className={`px-3.5 py-2 rounded-lg border text-left transition-colors shrink-0 cursor-pointer min-w-[122px] ${
                      isSelected
                        ? 'bg-white border-slate-900 ring-1 ring-slate-900'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-display font-bold text-slate-900 whitespace-nowrap">
                        {team.code}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[130px] mt-0.5">
                      C: {team.captain}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Franchise / League Header Bar + Autonomous AI Sync Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1">
                {activeTeamInfo ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className="w-3 h-6 rounded-xs shrink-0"
                        style={{ backgroundColor: activeTeamInfo.primaryColor }}
                      />
                      <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                        {activeTeamInfo.name}
                      </h1>
                      <span className="text-xs text-slate-500 font-medium">
                        {activeTeamInfo.homeGround} · {activeTeamInfo.titles} IPL Titles
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
                      <span>Captain:</span>
                      {editingCaptain ? (
                        <span className="inline-flex items-center gap-1.5">
                          <input
                            type="text"
                            value={captainDraft}
                            onChange={(e) => setCaptainDraft(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded-md text-slate-900"
                            aria-label="Edit captain name"
                          />
                          <button
                            type="button"
                            onClick={handleSaveCaptain}
                            className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                            aria-label="Save captain name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          {activeTeamInfo.captain}
                          <button
                            type="button"
                            onClick={() => {
                              setCaptainDraft(activeTeamInfo.captain);
                              setEditingCaptain(true);
                            }}
                            title="Edit Captain Name"
                            aria-label="Edit Captain Name"
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {activeTeamPower && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono tabular-nums">
                            Bat Power {activeTeamPower.battingPower}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono tabular-nums">
                            Bowl Power {activeTeamPower.bowlingPower}
                          </span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
                      IPL League-Wide Data Science Overview
                    </h1>
                    <p className="text-xs text-slate-500">
                      MI · CSK · RCB · GT · DC · RR · LSG · SRH · PBKS · KKR — Normalized Z-score modeling &amp; live AI updates
                    </p>
                  </>
                )}
              </div>

              {/* Autonomous AI Controls */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                  />
                  <span className="whitespace-nowrap">Auto-Sync API (60s)</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleAiSync(selectedTeam)}
                  disabled={syncingAi}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {syncingAi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {syncingAi ? 'Syncing via AI...' : 'AI Auto-Sync Data'}
                </button>

                <button
                  type="button"
                  onClick={handleSyncPhotos}
                  disabled={syncingPhotos}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {syncingPhotos ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-slate-700" />
                  )}
                  {syncingPhotos ? 'Fetching Photos...' : 'Sync Photos API'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateInsights}
                  disabled={loadingInsights}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {loadingInsights ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  AI Scout Brief
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Error & AI Sync Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-700 font-semibold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {(aiMessage || league?.aiSyncNotes) && activeSection !== 'export' && (
          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {aiMessage || league?.aiSyncNotes}
              </span>
              {league?.lastAiSync && (
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  Last AI Sync: {new Date(league.lastAiSync).toLocaleString()}
                </span>
              )}
            </div>
            {league?.groundingSources && league.groundingSources.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                <span>Verified Sources:</span>
                {league.groundingSources.map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <span className="truncate max-w-[180px]">{src.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {insightsText && activeSection !== 'export' && (
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-slate-900">
                Quantitative Scouting Brief ({selectedTeam === 'ALL' ? 'League' : selectedTeam})
              </h3>
              <button
                type="button"
                onClick={() => setInsightsText(null)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
              {insightsText}
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse p-5"
              />
            ))}
          </div>
        )}

        {/* Active View Content */}
        {!loading && league && (
          <>
            {activeSection === 'export' ? (
              <CodeExportView />
            ) : activeSection === 'datascience' ? (
              <DataScienceCharts
                metrics={allMetrics}
                teamPower={teamPower}
                teams={league.teams}
                onSelectPlayer={(m) => openEditPlayerModal(m.player)}
              />
            ) : (
              <div className="space-y-6">
                {/* Overall Team Performance Section */}
                <OverallTeamPerformance
                  selectedTeam={selectedTeam}
                  teamPower={teamPower}
                  onSelectTeam={(code) => {
                    setSelectedTeam(code);
                    setEditingCaptain(false);
                  }}
                />

                {/* 6-Metric KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Tracked Players', value: String(leagueSummaryKPIs.playerCount) },
                    { label: 'Mean Impact Index', value: leagueSummaryKPIs.avgImpact },
                    { label: 'Mean Strike Rate', value: leagueSummaryKPIs.avgSR },
                    { label: 'Mean Economy', value: leagueSummaryKPIs.avgEcon },
                    { label: 'Aggregate Runs', value: leagueSummaryKPIs.totalRuns },
                    { label: 'Aggregate Wickets', value: leagueSummaryKPIs.totalWickets },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-3.5"
                    >
                      <div className="text-[11px] font-medium text-slate-500">{kpi.label}</div>
                      <div className="text-xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                        {kpi.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filter & Search Toolbar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Category Filter Segmented Buttons */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(['ALL', 'Batsman', 'Bowler', 'All-Rounder'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                            categoryFilter === cat
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {cat === 'ALL' ? 'All Roles' : cat === 'Batsman' ? 'Batsman' : cat}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search player or archetype..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      aria-label="Sort players by metric"
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="impact">Sort: Impact Index</option>
                      <option value="runs">Sort: Total Runs</option>
                      <option value="strikeRate">Sort: Strike Rate</option>
                      <option value="wickets">Sort: Wickets</option>
                      <option value="economy">Sort: Economy (Low→High)</option>
                    </select>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        aria-label="Card view"
                        className={`p-1.5 rounded-md cursor-pointer ${
                          viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        aria-label="Table view"
                        className={`p-1.5 rounded-md cursor-pointer ${
                          viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {filteredMetrics.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                    <p className="text-sm font-medium text-slate-900">
                      No players match the current filter.
                    </p>
                    <p className="text-xs text-slate-500">
                      Add a new player to this franchise or clear your role and search filters.
                    </p>
                    <button
                      type="button"
                      onClick={openAddPlayerModal}
                      className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      Add First Player
                    </button>
                  </div>
                ) : viewMode === 'cards' ? (
                  /* Analytical Player Cards Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredMetrics.map((m) => (
                      <PlayerAnalyticsCard
                        key={m.player.id}
                        metrics={m}
                        team={teamMap.get(m.player.team)}
                        onUpdate={() => setTransferPlayer(m.player)}
                        onEdit={() => openEditPlayerModal(m.player)}
                        onDownloadCsv={() => downloadPlayerCsv(m, teamMap.get(m.player.team))}
                        onDelete={() => handleDeletePlayer(m.player)}
                      />
                    ))}
                  </div>
                ) : (
                  /* High-Density Tabular Data Grid */
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-medium text-slate-500">
                            <th className="py-3 px-4">Player</th>
                            <th className="py-3 px-3">Team</th>
                            <th className="py-3 px-3">Category</th>
                            <th className="py-3 px-3 text-right">Runs</th>
                            <th className="py-3 px-3 text-right">Balls</th>
                            <th className="py-3 px-3 text-right">SR</th>
                            <th className="py-3 px-3 text-right">Bat Dot%</th>
                            <th className="py-3 px-3 text-right">Wkts</th>
                            <th className="py-3 px-3 text-right">Econ</th>
                            <th className="py-3 px-3 text-right">Bowl Dot%</th>
                            <th className="py-3 px-3 text-right">Impact</th>
                            <th className="py-3 px-3 text-right">WAR</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredMetrics.map((m) => {
                            const t = teamMap.get(m.player.team);
                            return (
                              <tr key={m.player.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <PlayerAvatar
                                      player={m.player}
                                      teamColor={t?.primaryColor || '#0f172a'}
                                      secondaryColor={t?.secondaryColor}
                                      size="sm"
                                      onEditPhoto={() => openEditPlayerModal(m.player)}
                                    />
                                    <div>
                                      <div className="font-semibold text-slate-900">
                                        {m.player.name}
                                        {m.player.isCaptain && (
                                          <span className="ml-1.5 text-[11px] text-blue-600 font-medium">
                                            (C)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500">{m.archetype}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-display font-bold text-slate-800">
                                  {m.player.team}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">{m.player.category}</td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                                  {m.player.batting.runs}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {m.player.batting.ballsFaced}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                                  {m.player.batting.strikeRate.toFixed(1)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {m.player.batting.ballsFaced > 0 ? `${m.dotBallPctBat}%` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                                  {m.player.bowling.wickets}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                                  {m.player.bowling.overs > 0 ? m.player.bowling.economy.toFixed(2) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {m.player.bowling.overs > 0 ? `${m.dotBallPctBowl}%` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-blue-700">
                                  {m.impactScore}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                                  {m.war >= 0 ? `+${m.war}` : m.war}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => downloadPlayerCsv(m, t)}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                      title={`Download ${m.player.name} CSV`}
                                      aria-label={`Download ${m.player.name} CSV`}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTransferPlayer(m.player)}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                      title={`Update team / captain for ${m.player.name}`}
                                      aria-label={`Update team or captain for ${m.player.name}`}
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditPlayerModal(m.player)}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                      aria-label={`Edit ${m.player.name}`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlayer(m.player)}
                                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                      aria-label={`Delete ${m.player.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Overview Mode also embeds the Data Science Lab right below so everything is immediately discoverable */}
                {activeSection === 'overview' && (
                  <section className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-display font-bold text-slate-900">
                          Data Science &amp; Statistical Modeling
                        </h2>
                        <p className="text-xs text-slate-500">
                          Live OLS regression, league Z-score normalization, and franchise power matrix
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('datascience')}
                        className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                      >
                        Expand Full Lab
                      </button>
                    </div>
                    <DataScienceCharts
                      metrics={allMetrics}
                      teamPower={teamPower}
                      teams={league.teams}
                      onSelectPlayer={(m) => openEditPlayerModal(m.player)}
                    />
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>IPL QuantLab · Cricket Data Science Analytics</span>
          <span>
            Franchise Sequence: MI · CSK · RCB · GT · DC · RR · LSG · SRH · PBKS · KKR
          </span>
        </div>
      </footer>

      {league && (
        <>
          <PlayerModal
            isOpen={playerModalOpen}
            onClose={() => setPlayerModalOpen(false)}
            onSave={handleSavePlayer}
            teams={league.teams}
            initialPlayer={editingPlayer}
            defaultTeam={selectedTeam === 'ALL' ? 'MI' : selectedTeam}
          />
          <PlayerTransferModal
            isOpen={Boolean(transferPlayer)}
            player={transferPlayer}
            allPlayers={league.players}
            teams={league.teams}
            onClose={() => setTransferPlayer(null)}
            onConfirmTransfer={handleTransferPlayer}
            onOpenFullEdit={(p) => openEditPlayerModal(p)}
          />
        </>
      )}
    </div>
  );
}

interface PlayerAnalyticsCardProps {
  metrics: ComputedPlayerMetrics;
  team?: LeaguePayload['teams'][number];
  onUpdate: () => void;
  onEdit: () => void;
  onDownloadCsv: () => void;
  onDelete: () => void;
}

const PlayerAnalyticsCard: React.FC<PlayerAnalyticsCardProps> = ({
  metrics,
  team,
  onUpdate,
  onEdit,
  onDownloadCsv,
  onDelete,
}) => {
  const { player } = metrics;
  const showBat = player.category === 'Batsman' || player.category === 'All-Rounder';
  const showBowl = player.category === 'Bowler' || player.category === 'All-Rounder';

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <PlayerAvatar
            player={player}
            teamColor={team?.primaryColor || '#0f172a'}
            secondaryColor={team?.secondaryColor}
            size="lg"
            onEditPhoto={onEdit}
          />
          <div className="min-w-0">
            <h3 className="text-base font-display font-bold text-slate-900 truncate">
              {player.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-800">{player.team}</span>
              <span aria-hidden="true">·</span>
              <span>{player.category}</span>
              {player.isCaptain && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-blue-600">Captain</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {metrics.archetype} · {player.nationality}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[11px] text-slate-500">Impact</div>
          <div className="text-xl font-mono tabular-nums font-bold text-slate-900 leading-tight">
            {metrics.impactScore}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-blue-700">
            WAR {metrics.war >= 0 ? `+${metrics.war}` : metrics.war}
          </div>
        </div>
      </div>

      {/* Category-Specific Quantitative Metrics (No Nested Box Cards — Clean Hairline Dividers) */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        {showBat && (
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
              <span>Batting Performance</span>
              <span className="font-mono tabular-nums text-slate-700">
                Bat Index {metrics.battingImpact} · Z-SR {metrics.zStrikeRate >= 0 ? `+${metrics.zStrikeRate}` : metrics.zStrikeRate}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-slate-400">Runs</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.batting.runs}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Balls</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.batting.ballsFaced}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Strike Rate</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.batting.strikeRate.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Dot Balls</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.batting.dotBallsFaced}{' '}
                  <span className="text-[10px] text-slate-500">({metrics.dotBallPctBat}%)</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Average</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.batting.average.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">4s / 6s</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.batting.fours}/{player.batting.sixes}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Boundary %</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {metrics.boundaryPctBat}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">High Score</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.batting.highScore}
                </div>
              </div>
            </div>
          </div>
        )}

        {showBowl && (
          <div className={showBat ? 'pt-3 border-t border-slate-100' : ''}>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
              <span>Bowling Performance</span>
              <span className="font-mono tabular-nums text-slate-700">
                Bowl Index {metrics.bowlingImpact} · Z-Econ {metrics.zEconomy >= 0 ? `+${metrics.zEconomy}` : metrics.zEconomy}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-slate-400">Wickets</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.bowling.wickets}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Overs</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.bowling.overs}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Economy</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.bowling.economy.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Dot Balls</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {player.bowling.dotBallsBowled}{' '}
                  <span className="text-[10px] text-slate-500">({metrics.dotBallPctBowl}%)</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Bowl Avg</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.bowling.bowlingAverage.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Bowl SR</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.bowling.bowlingStrikeRate.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Runs Conc.</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.bowling.runsConceded}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Best</div>
                <div className="font-mono tabular-nums text-slate-800">
                  {player.bowling.bestFigures}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Last 5 Matches Recent Form Sparkline (Recharts) */}
      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-medium text-slate-500">Last 5 Matches Form</span>
          <span className="font-mono tabular-nums text-slate-700">
            {(player.recentForm || []).map((f) => f.label).join(' · ')}
          </span>
        </div>
        <div className="h-14 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={player.recentForm || []}
              margin={{ top: 4, right: 4, left: 4, bottom: 2 }}
            >
              <defs>
                <linearGradient id={`spark-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={team?.primaryColor || '#2563eb'}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor={team?.primaryColor || '#2563eb'}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                }}
                formatter={(
                  _val: unknown,
                  _name: unknown,
                  item: { payload?: { match?: string; label?: string } }
                ) => [item?.payload?.label ?? '', item?.payload?.match ?? 'Match']}
                labelFormatter={() => ''}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={team?.primaryColor || '#2563eb'}
                strokeWidth={2}
                fill={`url(#spark-${player.id})`}
                dot={{ r: 2.5, fill: team?.primaryColor || '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[11px] font-mono tabular-nums text-slate-500">
          Consistency {metrics.consistencyIndex}%
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={onUpdate}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-slate-800 bg-slate-50 hover:bg-slate-100 cursor-pointer whitespace-nowrap font-medium"
          >
            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
            Update
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-3 h-3" />
            Photo / Stats
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${player.name}`}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
