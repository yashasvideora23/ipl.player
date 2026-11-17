import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, Upload, X } from 'lucide-react';
import type { Player, PlayerCategory, RecentMatchForm, TeamCode, TeamInfo } from '../types/ipl';
import { getTeamDefaultPreset, STUDIO_PORTRAITS } from '../utils/portraits';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playerData: Omit<Player, 'id' | 'lastUpdated'> & { id?: string }) => Promise<void>;
  teams: TeamInfo[];
  initialPlayer?: Player | null;
  defaultTeam?: TeamCode;
}

const DEFAULT_BATTING = {
  matches: 0,
  innings: 0,
  runs: 0,
  ballsFaced: 0,
  dotBallsFaced: 0,
  strikeRate: 0,
  average: 0,
  fours: 0,
  sixes: 0,
  fifties: 0,
  hundreds: 0,
  highScore: 0,
};

const DEFAULT_BOWLING = {
  matches: 0,
  innings: 0,
  overs: 0,
  runsConceded: 0,
  wickets: 0,
  dotBallsBowled: 0,
  economy: 0,
  bowlingAverage: 0,
  bowlingStrikeRate: 0,
  maidens: 0,
  fourWickets: 0,
  bestFigures: '0/0',
};

const DEFAULT_RECENT_FORM: RecentMatchForm[] = [
  { match: 'M1', score: 35, label: 'M1: 35' },
  { match: 'M2', score: 42, label: 'M2: 42' },
  { match: 'M3', score: 28, label: 'M3: 28' },
  { match: 'M4', score: 56, label: 'M4: 56' },
  { match: 'M5', score: 48, label: 'M5: 48' },
];

type PresetKey = 'navy' | 'yellow' | 'crimson' | 'pink' | 'orange' | 'purple';

export const PlayerModal: React.FC<PlayerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teams,
  initialPlayer,
  defaultTeam = 'MI',
}) => {
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamCode>(defaultTeam);
  const [category, setCategory] = useState<PlayerCategory>('Batsman');
  const [isCaptain, setIsCaptain] = useState(false);
  const [nationality, setNationality] = useState('India');
  const [jerseyNumber, setJerseyNumber] = useState(0);
  const [photoUrl, setPhotoUrl] = useState('');
  const [avatarPreset, setAvatarPreset] = useState<PresetKey>(getTeamDefaultPreset(defaultTeam));
  const [batting, setBatting] = useState(DEFAULT_BATTING);
  const [bowling, setBowling] = useState(DEFAULT_BOWLING);
  const [recentForm, setRecentForm] = useState<RecentMatchForm[]>(DEFAULT_RECENT_FORM);

  const [scouting, setScouting] = useState(false);
  const [fetchingPhoto, setFetchingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialPlayer) {
      setName(initialPlayer.name);
      setTeam(initialPlayer.team);
      setCategory(initialPlayer.category);
      setIsCaptain(Boolean(initialPlayer.isCaptain));
      setNationality(initialPlayer.nationality);
      setJerseyNumber(initialPlayer.jerseyNumber);
      setPhotoUrl(initialPlayer.photoUrl || '');
      const preset =
        initialPlayer.avatarPreset && initialPlayer.avatarPreset !== 'initial'
          ? initialPlayer.avatarPreset
          : getTeamDefaultPreset(initialPlayer.team);
      setAvatarPreset(preset);
      setBatting({ ...DEFAULT_BATTING, ...initialPlayer.batting });
      setBowling({ ...DEFAULT_BOWLING, ...initialPlayer.bowling });
      setRecentForm(
        initialPlayer.recentForm && initialPlayer.recentForm.length === 5
          ? initialPlayer.recentForm
          : DEFAULT_RECENT_FORM
      );
    } else {
      setName('');
      setTeam(defaultTeam);
      setCategory('Batsman');
      setIsCaptain(false);
      setNationality('India');
      setJerseyNumber(0);
      setPhotoUrl('');
      setAvatarPreset(getTeamDefaultPreset(defaultTeam));
      setBatting({ ...DEFAULT_BATTING });
      setBowling({ ...DEFAULT_BOWLING });
      setRecentForm(DEFAULT_RECENT_FORM);
    }
  }, [isOpen, initialPlayer, defaultTeam]);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFetchPhotoApi = async () => {
    if (!name.trim()) {
      setError('Enter player name first to fetch photo via API.');
      return;
    }
    setFetchingPhoto(true);
    setError(null);
    try {
      const resp = await fetch('/api/ai/fetch-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name.trim(), playerId: initialPlayer?.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Photo API lookup failed.');
      if (json.photoUrl) {
        setPhotoUrl(json.photoUrl);
      } else {
        setError('No public photo found for that spelling; studio jersey portrait kept.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetchingPhoto(false);
    }
  };

  const handleAiScout = async () => {
    if (!name.trim()) {
      setError('Enter a player name first to auto-scout their IPL data.');
      return;
    }
    setError(null);
    setScouting(true);
    try {
      const resp = await fetch('/api/ai/scout-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), team, category }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Auto-scout failed');
      const s = json.scouted as Partial<Player>;
      if (s.nationality) setNationality(s.nationality);
      if (typeof s.jerseyNumber === 'number' && s.jerseyNumber > 0) setJerseyNumber(s.jerseyNumber);
      if (s.category && ['Batsman', 'Bowler', 'All-Rounder'].includes(s.category)) {
        setCategory(s.category as PlayerCategory);
      }
      if (s.batting) setBatting({ ...DEFAULT_BATTING, ...s.batting });
      if (s.bowling) setBowling({ ...DEFAULT_BOWLING, ...s.bowling });
      if (Array.isArray(s.recentForm) && s.recentForm.length === 5) {
        setRecentForm(s.recentForm);
      }
      if (json.photoUrl && !photoUrl) {
        setPhotoUrl(json.photoUrl);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScouting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Player name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialPlayer?.id,
        name: name.trim(),
        team,
        category,
        isCaptain,
        nationality: nationality.trim() || 'India',
        jerseyNumber: Number(jerseyNumber) || 0,
        photoUrl: photoUrl.trim(),
        avatarPreset,
        batting,
        bowling,
        recentForm,
        aiSynced: initialPlayer?.aiSynced,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const showBatting = category === 'Batsman' || category === 'All-Rounder';
  const showBowling = category === 'Bowler' || category === 'All-Rounder';

  const updateBat = (field: keyof typeof DEFAULT_BATTING, val: string) => {
    const num = Number(val) || 0;
    setBatting((prev) => {
      const next = { ...prev, [field]: num };
      if ((field === 'runs' || field === 'ballsFaced') && next.ballsFaced > 0) {
        next.strikeRate = Math.round((next.runs / next.ballsFaced) * 10000) / 100;
      }
      return next;
    });
  };

  const updateBowl = (field: keyof typeof DEFAULT_BOWLING, val: string) => {
    if (field === 'bestFigures') {
      setBowling((prev) => ({ ...prev, bestFigures: val }));
      return;
    }
    const num = Number(val) || 0;
    setBowling((prev) => {
      const next = { ...prev, [field]: num };
      if ((field === 'runsConceded' || field === 'overs') && next.overs > 0) {
        const whole = Math.floor(next.overs);
        const part = Math.round((next.overs - whole) * 10);
        const totalOversDecimal = whole + part / 6;
        if (totalOversDecimal > 0) {
          next.economy = Math.round((next.runsConceded / totalOversDecimal) * 100) / 100;
        }
      }
      if ((field === 'runsConceded' || field === 'wickets') && next.wickets > 0) {
        next.bowlingAverage = Math.round((next.runsConceded / next.wickets) * 100) / 100;
      }
      return next;
    });
  };

  const updateRecentScore = (index: number, rawVal: string) => {
    const num = Number(rawVal) || 0;
    setRecentForm((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              score: num,
              label:
                category === 'Bowler'
                  ? `${Math.round(num / 25)} wkts`
                  : `${num} pts`,
            }
          : item
      )
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="player-modal-title" className="text-lg font-display font-bold text-slate-900">
              {initialPlayer ? `Edit Player — ${initialPlayer.name}` : 'Add New IPL Player'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select player category, upload or fetch portrait via Photo API, and manage 5-match recent form.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Category Segmented Control */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Player Category
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
              {(['Batsman', 'Bowler', 'All-Rounder'] as PlayerCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    category === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'Batsman' ? 'Batsman / Cricketer' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Identity & AI Scout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Player Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tilak Varma"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                IPL Franchise
              </label>
              <select
                value={team}
                onChange={(e) => {
                  const nextTeam = e.target.value as TeamCode;
                  setTeam(nextTeam);
                  if (!initialPlayer) setAvatarPreset(getTeamDefaultPreset(nextTeam));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <button
                type="button"
                onClick={handleAiScout}
                disabled={scouting}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                {scouting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scouting Stats...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill Stats via AI
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nationality
              </label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Jersey Number
              </label>
              <input
                type="number"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCaptain}
                  onChange={(e) => setIsCaptain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Assign as Team Captain</span>
              </label>
            </div>
          </div>

          {/* Photo Upload, Photo API Lookup & 6 Studio Portraits */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-display font-semibold text-slate-900">
                  Player Portrait Photo
                </h3>
                <p className="text-xs text-slate-500">
                  Upload photo, fetch via Photo API, paste URL, or choose a studio jersey portrait.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleFetchPhotoApi}
                  disabled={fetchingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  {fetchingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  Fetch via Photo API
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  Upload File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={photoUrl.startsWith('data:') ? 'Custom uploaded image (base64)' : photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Paste https:// player image URL (optional)"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-6 flex flex-wrap items-center gap-1.5">
                {(['navy', 'yellow', 'crimson', 'pink', 'orange', 'purple'] as PresetKey[]).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAvatarPreset(preset);
                        setPhotoUrl('');
                      }}
                      className={`p-0.5 rounded-md border transition-colors cursor-pointer ${
                        avatarPreset === preset && !photoUrl
                          ? 'border-blue-600 ring-2 ring-blue-600/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      title={`${preset} studio portrait`}
                    >
                      <img
                        src={STUDIO_PORTRAITS[preset]}
                        alt={preset}
                        className="w-8 h-8 rounded-xs object-cover object-top"
                      />
                    </button>
                  )
                )}
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt="Active Preview"
                    className="w-9 h-9 rounded-md object-cover object-top border-2 border-blue-600 ml-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Last 5 Matches Recent Form */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-display font-semibold text-slate-900 mb-2">
              Last 5 Matches Trend (Sparkline Data)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {recentForm.map((item, idx) => (
                <div key={item.match}>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {item.match} Score
                  </label>
                  <input
                    type="number"
                    value={item.score}
                    onChange={(e) => updateRecentScore(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Batting Section */}
          {showBatting && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-display font-semibold text-slate-900 mb-3">
                Batting &amp; Scoring Analytics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ['matches', 'Matches'],
                    ['innings', 'Innings'],
                    ['runs', 'Total Runs'],
                    ['ballsFaced', 'Balls Faced'],
                    ['dotBallsFaced', 'Dot Balls Faced'],
                    ['strikeRate', 'Strike Rate'],
                    ['average', 'Batting Avg'],
                    ['fours', 'Fours (4s)'],
                    ['sixes', 'Sixes (6s)'],
                    ['fifties', '50s'],
                    ['hundreds', '100s'],
                    ['highScore', 'High Score'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={batting[key]}
                      onChange={(e) => updateBat(key, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bowling Section */}
          {showBowling && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-display font-semibold text-slate-900 mb-3">
                Bowling &amp; Control Analytics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ['matches', 'Matches'],
                    ['innings', 'Innings Bowled'],
                    ['overs', 'Overs Bowled'],
                    ['runsConceded', 'Runs Conceded'],
                    ['wickets', 'Wickets'],
                    ['dotBallsBowled', 'Dot Balls Bowled'],
                    ['economy', 'Economy Rate'],
                    ['bowlingAverage', 'Bowling Avg'],
                    ['bowlingStrikeRate', 'Bowling SR'],
                    ['maidens', 'Maidens'],
                    ['fourWickets', '4W+ Hauls'],
                    ['bestFigures', 'Best Figures (e.g. 4/21)'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {label}
                    </label>
                    <input
                      type={key === 'bestFigures' ? 'text' : 'number'}
                      step={key === 'bestFigures' ? undefined : '0.01'}
                      value={bowling[key]}
                      onChange={(e) => updateBowl(key, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
              className="px-5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {initialPlayer ? 'Save Player Updates' : 'Add Player to Squad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
