import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2, Shield, X } from 'lucide-react';
import type { Player, PlayerCategory, TeamCode, TeamInfo } from '../types/ipl';

interface PlayerTransferModalProps {
  isOpen: boolean;
  player: Player | null;
  allPlayers: Player[];
  teams: TeamInfo[];
  onClose: () => void;
  onConfirmTransfer: (payload: {
    id: string;
    team: TeamCode;
    category: PlayerCategory;
    isCaptain: boolean;
    replacementCaptainForOldTeam?: string;
  }) => Promise<void>;
  onOpenFullEdit: (player: Player) => void;
}

export const PlayerTransferModal: React.FC<PlayerTransferModalProps> = ({
  isOpen,
  player,
  allPlayers,
  teams,
  onClose,
  onConfirmTransfer,
  onOpenFullEdit,
}) => {
  const [targetTeam, setTargetTeam] = useState<TeamCode>('MI');
  const [category, setCategory] = useState<PlayerCategory>('Batsman');
  const [makeCaptain, setMakeCaptain] = useState(false);
  const [replacementCaptain, setReplacementCaptain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oldTeamCandidates = useMemo(() => {
    if (!player) return [];
    return allPlayers.filter((p) => p.team === player.team && p.id !== player.id);
  }, [allPlayers, player]);

  useEffect(() => {
    if (!isOpen || !player) return;
    setTargetTeam(player.team);
    setCategory(player.category);
    setMakeCaptain(Boolean(player.isCaptain));
    setReplacementCaptain(oldTeamCandidates[0]?.name || '');
    setError(null);
  }, [isOpen, player, oldTeamCandidates]);

  if (!isOpen || !player) return null;

  const isShiftingTeam = targetTeam !== player.team;
  const steppingDownOldCaptain =
    Boolean(player.isCaptain) && (isShiftingTeam || !makeCaptain);
  const destinationTeamInfo = teams.find((t) => t.code === targetTeam);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConfirmTransfer({
        id: player.id,
        team: targetTeam,
        category,
        isCaptain: makeCaptain,
        replacementCaptainForOldTeam: steppingDownOldCaptain
          ? replacementCaptain.trim() || undefined
          : undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="transfer-modal-title" className="text-base font-display font-bold text-slate-900">
              Update Team &amp; Captaincy — {player.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transfer player across IPL franchises or update team captaincy assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close update modal"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Current vs Destination Franchise */}
          <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
            <div className="sm:col-span-4 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-medium text-slate-500">Current Team</div>
              <div className="text-sm font-display font-bold text-slate-900 mt-0.5">
                {player.team}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {player.isCaptain ? 'Current Captain' : player.category}
              </div>
            </div>

            <div className="sm:col-span-1 flex justify-center text-slate-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Transfer / Assign IPL Team
              </label>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value as TeamCode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role / Category */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Playing Category
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
              {(['Batsman', 'Bowler', 'All-Rounder'] as PlayerCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    category === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Captaincy Assignment */}
          <div className="p-3.5 rounded-lg border border-slate-200 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={makeCaptain}
                onChange={(e) => setMakeCaptain(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  Set {player.name} as {targetTeam} Captain
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Current {targetTeam} captain: {destinationTeamInfo?.captain || 'TBD'}. Enabling this replaces the franchise captain automatically.
                </div>
              </div>
            </label>

            {steppingDownOldCaptain && (
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-[11px] font-medium text-slate-700 mb-1.5">
                  New Captain for {player.team} (since {player.name} is leaving/stepping down)
                </label>
                <input
                  type="text"
                  list="old-team-captains"
                  value={replacementCaptain}
                  onChange={(e) => setReplacementCaptain(e.target.value)}
                  placeholder="Select or type new captain name"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
                <datalist id="old-team-captains">
                  {oldTeamCandidates.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullEdit(player);
              }}
              className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
            >
              Edit Full Stats &amp; Photo →
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Update
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
