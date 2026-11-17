import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { INITIAL_LEAGUE_DATA, INITIAL_PLAYERS, TEAM_ORDER } from './src/data/initialIplData.ts';
import type {
  GroundingSource,
  LeaguePayload,
  Player,
  RecentMatchForm,
  TeamCode,
} from './src/types/ipl.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'ipl_store.json');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const INITIAL_PLAYER_MAP = new Map(INITIAL_PLAYERS.map((p) => [p.id, p]));

function buildFallbackRecentForm(p: Partial<Player>): RecentMatchForm[] {
  const base =
    p.category === 'Bowler'
      ? 45
      : p.category === 'All-Rounder'
        ? 52
        : 44;
  return [
    { match: 'M1', score: base - 6, label: `${base - 6}` },
    { match: 'M2', score: base + 12, label: `${base + 12}` },
    { match: 'M3', score: base - 10, label: `${base - 10}` },
    { match: 'M4', score: base + 18, label: `${base + 18}` },
    { match: 'M5', score: base + 8, label: `${base + 8}` },
  ];
}

function teamPresetFor(team: TeamCode): Player['avatarPreset'] {
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
    default:
      return 'navy';
  }
}

async function ensureStore(): Promise<LeaguePayload> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LeaguePayload;
    if (Array.isArray(parsed.teams) && Array.isArray(parsed.players)) {
      parsed.teams.sort(
        (a, b) => TEAM_ORDER.indexOf(a.code) - TEAM_ORDER.indexOf(b.code)
      );
      let mutated = false;
      parsed.players = parsed.players.map((p) => {
        const seed = INITIAL_PLAYER_MAP.get(p.id);
        let next = p;
        if (!Array.isArray(p.recentForm) || p.recentForm.length === 0) {
          mutated = true;
          next = {
            ...next,
            recentForm: seed?.recentForm || buildFallbackRecentForm(p),
          };
        }
        if (!p.avatarPreset || p.avatarPreset === 'initial') {
          mutated = true;
          next = {
            ...next,
            avatarPreset: seed?.avatarPreset || teamPresetFor(p.team),
          };
        }
        return next;
      });
      if (mutated) {
        await saveStore(parsed);
      }
      return parsed;
    }
  } catch {
    // Initialize fresh store
  }
  await fs.writeFile(DATA_FILE, JSON.stringify(INITIAL_LEAGUE_DATA, null, 2), 'utf-8');
  return structuredClone(INITIAL_LEAGUE_DATA);
}

async function saveStore(data: LeaguePayload): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  data.teams.sort((a, b) => TEAM_ORDER.indexOf(a.code) - TEAM_ORDER.indexOf(b.code));
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function extractJsonObject<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('Could not parse structured JSON from AI response.');
  }
}

function extractGroundingSources(response: unknown): GroundingSource[] {
  const r = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };
  const chunks = r?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: GroundingSource[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ uri, title: title || uri });
    }
  }
  return sources.slice(0, 6);
}

async function lookupWikipediaPortrait(playerName: string): Promise<string | null> {
  try {
    const slug = encodeURIComponent(playerName.trim().replace(/\s+/g, '_'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'IPLQuantLab/1.0',
        },
      }
    );
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    };
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // 1. Fetch full league data
  app.get('/api/data', async (_req, res) => {
    try {
      const store = await ensureStore();
      res.json(store);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. Add new player
  app.post('/api/players', async (req, res) => {
    try {
      const store = await ensureStore();
      const incoming = req.body as Partial<Player>;
      if (!incoming.name || !incoming.team || !incoming.category) {
        res.status(400).json({ error: 'Player name, team, and category are required.' });
        return;
      }
      const newPlayer: Player = {
        id:
          incoming.id ||
          `${incoming.team.toLowerCase()}-${incoming.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`,
        name: incoming.name.trim(),
        team: incoming.team,
        category: incoming.category,
        isCaptain: Boolean(incoming.isCaptain),
        nationality: incoming.nationality?.trim() || 'India',
        jerseyNumber: Number(incoming.jerseyNumber) || 0,
        photoUrl: incoming.photoUrl || '',
        avatarPreset:
          incoming.avatarPreset && incoming.avatarPreset !== 'initial'
            ? incoming.avatarPreset
            : teamPresetFor(incoming.team),
        batting: {
          matches: Number(incoming.batting?.matches) || 0,
          innings: Number(incoming.batting?.innings) || 0,
          runs: Number(incoming.batting?.runs) || 0,
          ballsFaced: Number(incoming.batting?.ballsFaced) || 0,
          dotBallsFaced: Number(incoming.batting?.dotBallsFaced) || 0,
          strikeRate: Number(incoming.batting?.strikeRate) || 0,
          average: Number(incoming.batting?.average) || 0,
          fours: Number(incoming.batting?.fours) || 0,
          sixes: Number(incoming.batting?.sixes) || 0,
          fifties: Number(incoming.batting?.fifties) || 0,
          hundreds: Number(incoming.batting?.hundreds) || 0,
          highScore: Number(incoming.batting?.highScore) || 0,
        },
        bowling: {
          matches: Number(incoming.bowling?.matches) || 0,
          innings: Number(incoming.bowling?.innings) || 0,
          overs: Number(incoming.bowling?.overs) || 0,
          runsConceded: Number(incoming.bowling?.runsConceded) || 0,
          wickets: Number(incoming.bowling?.wickets) || 0,
          dotBallsBowled: Number(incoming.bowling?.dotBallsBowled) || 0,
          economy: Number(incoming.bowling?.economy) || 0,
          bowlingAverage: Number(incoming.bowling?.bowlingAverage) || 0,
          bowlingStrikeRate: Number(incoming.bowling?.bowlingStrikeRate) || 0,
          maidens: Number(incoming.bowling?.maidens) || 0,
          fourWickets: Number(incoming.bowling?.fourWickets) || 0,
          bestFigures: incoming.bowling?.bestFigures || '0/0',
        },
        recentForm:
          Array.isArray(incoming.recentForm) && incoming.recentForm.length > 0
            ? incoming.recentForm
            : buildFallbackRecentForm(incoming),
        lastUpdated: new Date().toISOString(),
        aiSynced: Boolean(incoming.aiSynced),
      };

      if (newPlayer.isCaptain) {
        store.players = store.players.map((p) =>
          p.team === newPlayer.team ? { ...p, isCaptain: false } : p
        );
        store.teams = store.teams.map((t) =>
          t.code === newPlayer.team ? { ...t, captain: newPlayer.name } : t
        );
      }

      store.players.unshift(newPlayer);
      await saveStore(store);
      res.status(201).json({ player: newPlayer, data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Edit player (stats, role, photo upload, captaincy, recentForm)
  app.put('/api/players/:id', async (req, res) => {
    try {
      const store = await ensureStore();
      const { id } = req.params;
      const idx = store.players.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }

      const existing = store.players[idx];
      const patch = req.body as Partial<Player> & {
        replacementCaptainForOldTeam?: string;
      };
      const nextTeam = patch.team || existing.team;
      const teamChanged = nextTeam !== existing.team;

      const updated: Player = {
        ...existing,
        ...patch,
        id: existing.id,
        team: nextTeam,
        avatarPreset:
          teamChanged && !patch.avatarPreset
            ? teamPresetFor(nextTeam)
            : patch.avatarPreset || existing.avatarPreset,
        batting: patch.batting ? { ...existing.batting, ...patch.batting } : existing.batting,
        bowling: patch.bowling ? { ...existing.bowling, ...patch.bowling } : existing.bowling,
        recentForm:
          Array.isArray(patch.recentForm) && patch.recentForm.length > 0
            ? patch.recentForm
            : existing.recentForm,
        lastUpdated: new Date().toISOString(),
      };

      // Handle old team captaincy if player was captain of old team and either moved or stepped down
      if (existing.isCaptain && (teamChanged || updated.isCaptain === false)) {
        const oldTeamCode = existing.team;
        const replacement = patch.replacementCaptainForOldTeam?.trim();
        if (replacement) {
          store.teams = store.teams.map((t) =>
            t.code === oldTeamCode ? { ...t, captain: replacement } : t
          );
          store.players = store.players.map((p) =>
            p.team === oldTeamCode && p.id !== updated.id
              ? { ...p, isCaptain: p.name.toLowerCase() === replacement.toLowerCase() }
              : p
          );
        } else {
          const fallbackCandidate = store.players.find(
            (p) => p.team === oldTeamCode && p.id !== updated.id
          );
          const nextCapName = fallbackCandidate ? fallbackCandidate.name : 'TBD';
          store.teams = store.teams.map((t) =>
            t.code === oldTeamCode ? { ...t, captain: nextCapName } : t
          );
          if (fallbackCandidate) {
            store.players = store.players.map((p) =>
              p.id === fallbackCandidate.id ? { ...p, isCaptain: true } : p
            );
          }
        }
      }

      if (updated.isCaptain) {
        store.players = store.players.map((p) =>
          p.team === updated.team && p.id !== updated.id ? { ...p, isCaptain: false } : p
        );
        store.teams = store.teams.map((t) =>
          t.code === updated.team ? { ...t, captain: updated.name } : t
        );
      }

      store.players[idx] = updated;
      await saveStore(store);
      res.json({ player: updated, data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3b. Dedicated Photo Upload / Update API for any player
  app.put('/api/players/:id/photo', async (req, res) => {
    try {
      const store = await ensureStore();
      const { id } = req.params;
      const { photoUrl, avatarPreset } = req.body as {
        photoUrl?: string;
        avatarPreset?: Player['avatarPreset'];
      };
      const idx = store.players.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }
      store.players[idx] = {
        ...store.players[idx],
        photoUrl: photoUrl !== undefined ? photoUrl : store.players[idx].photoUrl,
        avatarPreset: avatarPreset || store.players[idx].avatarPreset,
        lastUpdated: new Date().toISOString(),
      };
      await saveStore(store);
      res.json({ player: store.players[idx], data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3c. Autonomous Photo Sync API (fetches Wikimedia/Wikipedia cricketer portraits for players)
  app.post('/api/ai/fetch-photos', async (req, res) => {
    try {
      const store = await ensureStore();
      const { teamCode, playerName, playerId } = (req.body || {}) as {
        teamCode?: TeamCode | 'ALL';
        playerName?: string;
        playerId?: string;
      };

      // Single player lookup mode (e.g. inside Add/Edit Player modal)
      if (playerName) {
        const foundUrl = await lookupWikipediaPortrait(playerName);
        if (playerId && foundUrl) {
          store.players = store.players.map((p) =>
            p.id === playerId
              ? { ...p, photoUrl: foundUrl, lastUpdated: new Date().toISOString() }
              : p
          );
          await saveStore(store);
        }
        res.json({ photoUrl: foundUrl, data: store });
        return;
      }

      // Batch franchise or league photo sync
      const targets =
        teamCode && teamCode !== 'ALL'
          ? store.players.filter((p) => p.team === teamCode)
          : store.players;

      let updatedCount = 0;
      const results = await Promise.all(
        targets.map(async (p) => {
          const url = await lookupWikipediaPortrait(p.name);
          return { id: p.id, url };
        })
      );

      const urlMap = new Map(results.filter((r) => r.url).map((r) => [r.id, r.url!]));
      const now = new Date().toISOString();
      store.players = store.players.map((p) => {
        const newUrl = urlMap.get(p.id);
        if (newUrl) {
          updatedCount++;
          return { ...p, photoUrl: newUrl, lastUpdated: now };
        }
        return p;
      });

      await saveStore(store);
      res.json({ updatedCount, data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Photo sync API failed.' });
    }
  });

  // 4. Delete player
  app.delete('/api/players/:id', async (req, res) => {
    try {
      const store = await ensureStore();
      const { id } = req.params;
      store.players = store.players.filter((p) => p.id !== id);
      await saveStore(store);
      res.json({ data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 5. Update team captain / metadata
  app.put('/api/teams/:code', async (req, res) => {
    try {
      const store = await ensureStore();
      const code = req.params.code as TeamCode;
      const { captain } = req.body as { captain?: string };
      if (!captain || !captain.trim()) {
        res.status(400).json({ error: 'Captain name is required.' });
        return;
      }
      store.teams = store.teams.map((t) =>
        t.code === code ? { ...t, captain: captain.trim() } : t
      );
      store.players = store.players.map((p) =>
        p.team === code
          ? {
              ...p,
              isCaptain: p.name.toLowerCase() === captain.trim().toLowerCase(),
            }
          : p
      );
      await saveStore(store);
      res.json({ data: store });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 6. Autonomous AI Sync API: updates IPL team captains, player stats & 5-match recentForm
  app.post('/api/ai/sync', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const store = await ensureStore();
      const { teamCode } = (req.body || {}) as { teamCode?: TeamCode | 'ALL' };
      const targetPlayers =
        teamCode && teamCode !== 'ALL'
          ? store.players.filter((p) => p.team === teamCode)
          : store.players.slice(0, 18);

      const targetTeams =
        teamCode && teamCode !== 'ALL'
          ? store.teams.filter((t) => t.code === teamCode)
          : store.teams;

      const prompt = `You are a sports data engineering API for Indian Premier League (IPL) cricket.
Use Google Search to verify the latest official IPL captains and latest career/IPL T20 statistics (including runs, balls faced, estimated dot balls faced, strike rate, average, 4s, 6s, wickets, overs, runs conceded, economy, bowling strike rate, dot balls bowled, and last 5 T20/IPL match form scores) for these teams and players.

Teams to check:
${targetTeams.map((t) => `- ${t.code} (${t.name}): current captain listed as "${t.captain}"`).join('\n')}

Players to update:
${targetPlayers
  .map(
    (p) =>
      `- id="${p.id}", name="${p.name}", team="${p.team}", category="${p.category}", currentRuns=${p.batting.runs}, currentWickets=${p.bowling.wickets}`
  )
  .join('\n')}

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{
  "summary": "1-2 sentence summary of what was verified/updated from latest IPL records",
  "captainUpdates": [
    { "teamCode": "MI", "captain": "Full Name" }
  ],
  "playerUpdates": [
    {
      "id": "existing-player-id",
      "team": "MI",
      "isCaptain": true,
      "recentForm": [
        { "match": "M1", "score": 34, "label": "34 runs" },
        { "match": "M2", "score": 21, "label": "21 runs" },
        { "match": "M3", "score": 46, "label": "46 runs" },
        { "match": "M4", "score": 18, "label": "18 runs" },
        { "match": "M5", "score": 52, "label": "52 runs" }
      ],
      "batting": {
        "matches": 137,
        "innings": 128,
        "runs": 2525,
        "ballsFaced": 1732,
        "dotBallsFaced": 540,
        "strikeRate": 145.79,
        "average": 28.69,
        "fours": 190,
        "sixes": 136,
        "fifties": 10,
        "hundreds": 0,
        "highScore": 91
      },
      "bowling": {
        "matches": 137,
        "innings": 98,
        "overs": 286.4,
        "runsConceded": 2594,
        "wickets": 64,
        "dotBallsBowled": 582,
        "economy": 9.05,
        "bowlingAverage": 40.53,
        "bowlingStrikeRate": 26.8,
        "maidens": 1,
        "fourWickets": 0,
        "bestFigures": "3/17"
      }
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = extractJsonObject<{
        summary?: string;
        captainUpdates?: Array<{ teamCode: TeamCode; captain: string }>;
        playerUpdates?: Array<Partial<Player> & { id: string }>;
      }>(response.text || '{}');

      const now = new Date().toISOString();

      if (Array.isArray(parsed.captainUpdates)) {
        for (const cu of parsed.captainUpdates) {
          if (cu.teamCode && cu.captain) {
            store.teams = store.teams.map((t) =>
              t.code === cu.teamCode ? { ...t, captain: cu.captain } : t
            );
          }
        }
      }

      let updatedCount = 0;
      if (Array.isArray(parsed.playerUpdates)) {
        for (const pu of parsed.playerUpdates) {
          const idx = store.players.findIndex((p) => p.id === pu.id);
          if (idx !== -1) {
            const existing = store.players[idx];
            store.players[idx] = {
              ...existing,
              team: pu.team || existing.team,
              isCaptain:
                typeof pu.isCaptain === 'boolean' ? pu.isCaptain : existing.isCaptain,
              batting: pu.batting
                ? { ...existing.batting, ...pu.batting }
                : existing.batting,
              bowling: pu.bowling
                ? { ...existing.bowling, ...pu.bowling }
                : existing.bowling,
              recentForm:
                Array.isArray(pu.recentForm) && pu.recentForm.length === 5
                  ? pu.recentForm
                  : existing.recentForm,
              lastUpdated: now,
              aiSynced: true,
            };
            updatedCount++;
          }
        }
      }

      store.lastAiSync = now;
      store.aiSyncNotes =
        parsed.summary || `AI synchronized ${updatedCount} player records using live search.`;
      store.groundingSources = extractGroundingSources(response);

      await saveStore(store);
      res.json({
        updatedCount,
        data: store,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'AI synchronization failed.' });
    }
  });

  // 7. AI Scout Player: Auto-populate a new player's stats, photo, and 5-match recentForm
  app.post('/api/ai/scout-player', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }
      const { name, team, category } = req.body as {
        name?: string;
        team?: TeamCode;
        category?: string;
      };
      if (!name?.trim()) {
        res.status(400).json({ error: 'Player name is required to auto-scout.' });
        return;
      }

      const prompt = `Search latest IPL / T20 cricket career statistics for cricketer "${name}" (Team context: ${team || 'IPL'}, Category: ${category || 'Auto-detect'}).
Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "name": "${name.trim()}",
  "nationality": "Country",
  "jerseyNumber": 10,
  "category": "Batsman" | "Bowler" | "All-Rounder",
  "recentForm": [
    { "match": "M1", "score": 30, "label": "30" },
    { "match": "M2", "score": 45, "label": "45" },
    { "match": "M3", "score": 22, "label": "22" },
    { "match": "M4", "score": 61, "label": "61" },
    { "match": "M5", "score": 38, "label": "38" }
  ],
  "batting": {
    "matches": 0,
    "innings": 0,
    "runs": 0,
    "ballsFaced": 0,
    "dotBallsFaced": 0,
    "strikeRate": 0,
    "average": 0,
    "fours": 0,
    "sixes": 0,
    "fifties": 0,
    "hundreds": 0,
    "highScore": 0
  },
  "bowling": {
    "matches": 0,
    "innings": 0,
    "overs": 0,
    "runsConceded": 0,
    "wickets": 0,
    "dotBallsBowled": 0,
    "economy": 0,
    "bowlingAverage": 0,
    "bowlingStrikeRate": 0,
    "maidens": 0,
    "fourWickets": 0,
    "bestFigures": "0/0"
  }
}`;

      const [response, photoUrl] = await Promise.all([
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
        lookupWikipediaPortrait(name.trim()),
      ]);

      const scouted = extractJsonObject<Partial<Player>>(response.text || '{}');
      res.json({
        scouted,
        photoUrl,
        sources: extractGroundingSources(response),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'AI player scouting failed.' });
    }
  });

  // 8. AI Data Science Scouting Report
  app.post('/api/ai/insights', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }
      const { contextLabel, metricsSummary } = req.body as {
        contextLabel?: string;
        metricsSummary?: string;
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are a Principal Cricket Data Scientist for an IPL franchise analytics lab.
Analyze this statistical summary for ${contextLabel || 'IPL League'}:
${metricsSummary || ''}

Provide 3 crisp, quantitative bullet points covering:
1. Efficiency frontier / regression outliers (strike rate vs dot-ball pressure or economy vs wicket strike rate).
2. All-rounder dual-impact balance or squad construction gap.
3. Actionable tactical deployment recommendation for the upcoming IPL matchday.
Keep it concise, analytical, and free of fluff.`,
      });

      res.json({ insights: response.text || '' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 9. Reset to default dataset
  app.post('/api/reset', async (_req, res) => {
    try {
      const fresh = structuredClone(INITIAL_LEAGUE_DATA);
      await saveStore(fresh);
      res.json(fresh);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IPL QuantLab server running on http://localhost:${PORT}`);
  });
}

startServer();
