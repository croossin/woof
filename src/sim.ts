import { PetState, dayKey, ensureDay } from "./state";

export interface FeedEvent {
  kind: "commits" | "pr-merged" | "review" | "claude-tokens";
  count: number;
  when: Date;
}

export interface Stage {
  name: string;
  minXp: number;
}

export const STAGES: Stage[] = [
  { name: "hatchling", minXp: 0 },
  { name: "sprout", minXp: 300 },
  { name: "companion", minXp: 1500 },
  { name: "elder", minXp: 5000 },
];

export function stageFor(xp: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (xp >= s.minXp) current = s;
  }
  return current;
}

export function nextStage(xp: number): Stage | null {
  for (const s of STAGES) {
    if (xp < s.minXp) return s;
  }
  return null;
}

const HUNGER_DECAY_PER_HOUR = 2.0; // full -> empty in ~2 days
const HAPPY_DECAY_PER_HOUR = 1.2; // full -> empty in ~3.5 days
const HIBERNATE_AFTER_DAYS = 14;

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function isAsleep(state: PetState, now: Date): boolean {
  const h = now.getHours();
  if (state.sleepStart > state.sleepEnd) {
    return h >= state.sleepStart || h < state.sleepEnd;
  }
  return h >= state.sleepStart && h < state.sleepEnd;
}

/** Advance the simulation clock: apply decay for time elapsed since lastTick. */
export function tick(state: PetState, now: Date): void {
  const last = new Date(state.lastTick);
  const hours = Math.max(0, (now.getTime() - last.getTime()) / 3_600_000);
  if (hours > 0 && !state.hibernating) {
    // Roughly a third of any long stretch is sleep, when decay halves.
    const effective = hours <= 1 ? hours : hours * 0.84;
    state.hunger = clamp(state.hunger - effective * HUNGER_DECAY_PER_HOUR);
    state.happiness = clamp(state.happiness - effective * HAPPY_DECAY_PER_HOUR);
  }
  const idleDays = (now.getTime() - new Date(state.lastActivity).getTime()) / 86_400_000;
  if (idleDays > HIBERNATE_AFTER_DAYS && !state.hibernating) {
    state.hibernating = true;
    state.hunger = Math.max(state.hunger, 10);
    state.happiness = Math.max(state.happiness, 10);
  }
  state.lastTick = now.toISOString();
}

/** Apply feed events to meters, XP, totals, and the daily log. */
export function applyFeeds(state: PetState, events: FeedEvent[], now: Date): void {
  if (events.length === 0) return;
  if (state.hibernating) {
    state.hibernating = false;
    state.happiness = clamp(state.happiness + 25); // overjoyed you're back
  }
  for (const e of events) {
    const day = ensureDay(state, dayKey(e.when));
    switch (e.kind) {
      case "commits": {
        const n = e.count;
        state.hunger = clamp(state.hunger + Math.min(30, n * 6));
        state.happiness = clamp(state.happiness + Math.min(6, n * 2));
        state.xp += n * 5;
        state.totals.commits += n;
        day.commits += n;
        break;
      }
      case "pr-merged": {
        state.hunger = clamp(state.hunger + 20 * e.count);
        state.happiness = clamp(state.happiness + 10 * e.count);
        state.xp += 25 * e.count;
        state.totals.prsMerged += e.count;
        day.prsMerged += e.count;
        break;
      }
      case "review": {
        state.happiness = clamp(state.happiness + 8 * e.count);
        state.hunger = clamp(state.hunger + 4 * e.count);
        state.xp += 10 * e.count;
        state.totals.reviews += e.count;
        day.reviews += e.count;
        break;
      }
      case "claude-tokens": {
        const tokens = e.count;
        state.happiness = clamp(state.happiness + Math.min(40, tokens / 5000));
        state.xp += Math.floor(tokens / 10_000);
        state.totals.claudeTokens += tokens;
        day.claudeTokens += tokens;
        break;
      }
    }
  }
  state.lastActivity = now.toISOString();
}

export type Mood =
  | "hibernating"
  | "sleepy"
  | "hungry"
  | "lonely"
  | "thriving"
  | "content";

export function moodFor(state: PetState, now: Date): Mood {
  if (state.hibernating) return "hibernating";
  if (isAsleep(state, now)) return "sleepy";
  if (state.hunger < 35) return "hungry";
  if (state.happiness < 35) return "lonely";
  if (state.hunger > 70 && state.happiness > 70) return "thriving";
  return "content";
}
