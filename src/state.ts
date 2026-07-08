import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const SHELLBY_DIR = path.join(os.homedir(), ".shellby");
const STATE_PATH = path.join(SHELLBY_DIR, "state.json");

export interface DailyActivity {
  commits: number;
  prsMerged: number;
  reviews: number;
  claudeTokens: number;
}

export interface Totals {
  commits: number;
  prsMerged: number;
  reviews: number;
  claudeTokens: number;
}

export interface PetState {
  version: 1;
  name: string;
  hatchedAt: string;
  lastTick: string;
  lastActivity: string;
  hunger: number; // 0-100, 100 = full
  happiness: number; // 0-100
  xp: number;
  hibernating: boolean;
  githubLogin: string | null;
  lastGhPoll: string | null;
  lastClaudeScan: string | null;
  lastLocalScan: string | null;
  seenEventIds: string[];
  seenShas: string[];
  knownRepos: string[];
  dailyLog: Record<string, DailyActivity>;
  totals: Totals;
  sleepStart: number; // hour, local
  sleepEnd: number;
}

export function newState(name: string, githubLogin: string | null, now: Date): PetState {
  const iso = now.toISOString();
  return {
    version: 1,
    name,
    hatchedAt: iso,
    lastTick: iso,
    lastActivity: iso,
    hunger: 80,
    happiness: 75,
    xp: 0,
    hibernating: false,
    githubLogin,
    lastGhPoll: null,
    lastClaudeScan: iso,
    lastLocalScan: iso,
    seenEventIds: [],
    seenShas: [],
    knownRepos: [],
    dailyLog: {},
    totals: { commits: 0, prsMerged: 0, reviews: 0, claudeTokens: 0 },
    sleepStart: 23,
    sleepEnd: 7,
  };
}

export function loadState(): PetState | null {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw) as PetState;
  } catch {
    return null;
  }
}

export function saveState(state: PetState): void {
  // Trim unbounded lists so the state file stays small.
  state.seenEventIds = state.seenEventIds.slice(-1000);
  state.seenShas = state.seenShas.slice(-2000);
  const days = Object.keys(state.dailyLog).sort();
  for (const day of days.slice(0, Math.max(0, days.length - 60))) {
    delete state.dailyLog[day];
  }
  fs.mkdirSync(SHELLBY_DIR, { recursive: true });
  const tmp = STATE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ensureDay(state: PetState, key: string): DailyActivity {
  if (!state.dailyLog[key]) {
    state.dailyLog[key] = { commits: 0, prsMerged: 0, reviews: 0, claudeTokens: 0 };
  }
  return state.dailyLog[key];
}
