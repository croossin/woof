import { PetState, dayKey } from "./state";
import { moodFor, stageFor, nextStage, Mood } from "./sim";
import { petArt, FACES } from "./art";
import { recentJournal } from "./journal";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

export function bar(value: number, width = 10): string {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * width);
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

const MOOD_BLURBS: Record<Mood, string> = {
  thriving: "is thriving. The tail says it all.",
  content: "is doing alright.",
  hungry: "is giving you the begging eyes. A commit would really hit the spot.",
  lonely: "misses working with you.",
  sleepy: "is curled up asleep. Shhh.",
  waiting: "has been waiting by the door. Any work will bring them bounding back.",
};

export function renderStatus(state: PetState, now: Date): string {
  const mood = moodFor(state, now);
  const stage = stageFor(state.xp);
  const next = nextStage(state.xp);
  const art = petArt(stage.name, mood);
  const today = state.dailyLog[dayKey(now)];

  const lines: string[] = [];
  lines.push("");
  for (const l of art) lines.push("  " + cyan(l));
  lines.push("");
  lines.push(`  ${bold(state.name)} the ${stage.name} ${MOOD_BLURBS[mood]}`);
  lines.push("");
  lines.push(`  food  ${yellow(bar(state.hunger))}   joy  ${magenta(bar(state.happiness))}`);
  const xpLine = next
    ? `  xp    ${state.xp} ${dim(`(${next.minXp - state.xp} to ${next.name})`)}`
    : `  xp    ${state.xp} ${dim("(fully grown, still growing)")}`;
  lines.push(xpLine);
  lines.push("");
  if (today) {
    const bits: string[] = [];
    if (today.commits) bits.push(`${today.commits} commit${today.commits === 1 ? "" : "s"}`);
    if (today.prsMerged) bits.push(`${today.prsMerged} PR${today.prsMerged === 1 ? "" : "s"} merged`);
    if (today.reviews) bits.push(`${today.reviews} review${today.reviews === 1 ? "" : "s"}`);
    if (today.claudeTokens) bits.push(`${Math.round(today.claudeTokens / 1000)}k tokens together`);
    if (bits.length) lines.push(dim(`  today: ${bits.join(" · ")}`));
  }
  const t = state.totals;
  lines.push(
    dim(
      `  lifetime: ${t.commits} commits · ${t.prsMerged} PRs · ${t.reviews} reviews · ${Math.round(
        t.claudeTokens / 1000
      )}k tokens`
    )
  );
  lines.push("");
  return lines.join("\n");
}

export function renderStatusline(state: PetState, now: Date): string {
  const mood = moodFor(state, now);
  const stage = stageFor(state.xp);
  return `🐶(${FACES[mood]}) 🍖${bar(state.hunger, 5)} ✨${bar(state.happiness, 5)} ${stage.name}`;
}

export function renderJournal(state: PetState): string {
  const entries = recentJournal(state, 7);
  if (entries.length === 0) {
    return `\n  ${dim("The journal is empty so far. Come back after a day together.")}\n`;
  }
  const lines: string[] = [""];
  lines.push(`  ${bold(`${state.name}'s journal`)}`);
  lines.push("");
  for (const e of entries) {
    lines.push(`  ${dim(e.day)}  ${e.line}`);
  }
  lines.push("");
  return lines.join("\n");
}
