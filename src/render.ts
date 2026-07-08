import { PetState, dayKey } from "./state";
import { moodFor, stageFor, nextStage, Mood } from "./sim";
import { petFrames, MOOD_SEQUENCE, FACES } from "./sprites";
import { recentJournal } from "./journal";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
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

function renderInfo(state: PetState, now: Date): string {
  const mood = moodFor(state, now);
  const stage = stageFor(state.xp);
  const next = nextStage(state.xp);
  const today = state.dailyLog[dayKey(now)];

  const lines: string[] = [];
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Print the pet — animated when we're on a real terminal. */
export async function showStatus(state: PetState, now: Date): Promise<void> {
  const mood = moodFor(state, now);
  const stage = stageFor(state.xp);
  const frames = petFrames(stage.name, mood);
  const seq = MOOD_SEQUENCE[mood];

  console.log("");
  process.stdout.write(frames[0].join("\n") + "\n");

  if (process.stdout.isTTY && frames.length > 1) {
    const height = frames[0].length;
    process.stdout.write("\x1b[?25l"); // hide cursor
    try {
      for (const idx of seq.slice(1)) {
        await sleep(320);
        process.stdout.write(`\x1b[${height}A`);
        process.stdout.write(frames[idx].join("\n") + "\n");
      }
    } finally {
      process.stdout.write("\x1b[?25h");
    }
  }
  console.log(renderInfo(state, now));
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
