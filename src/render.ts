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

const FRAME_MS = 320;

/**
 * Print the pet. On a real terminal the sprite animates in place above a
 * static stats block. With `loop`, it keeps animating until the user hits
 * Ctrl+C (`woof status`); otherwise it plays the idle sequence once and
 * returns (`woof feed`). Piped/non-TTY output is a single static frame.
 */
export async function showStatus(
  state: PetState,
  now: Date,
  opts: { loop?: boolean } = {}
): Promise<void> {
  const mood = moodFor(state, now);
  const stage = stageFor(state.xp);
  const frames = petFrames(stage.name, mood);
  const seq = MOOD_SEQUENCE[mood];
  const info = renderInfo(state, now);
  const spriteH = frames[0].length;
  const infoH = info.split("\n").length;

  // Initial paint: sprite, then the stats block beneath it.
  process.stdout.write("\n");
  process.stdout.write(frames[0].join("\n") + "\n");
  process.stdout.write(info + "\n");

  if (!process.stdout.isTTY || frames.length < 2) return;

  // Redraw only the sprite region, leaving the stats block untouched.
  const redraw = (idx: number) => {
    process.stdout.write(`\x1b[${spriteH + infoH}A`); // up to the sprite's top
    for (const line of frames[idx]) process.stdout.write(line + "\x1b[K\n");
    process.stdout.write(`\x1b[${infoH}B`); // back down past the stats
  };

  process.stdout.write("\x1b[?25l"); // hide cursor
  const restore = () => process.stdout.write("\x1b[?25h");

  // A testing hook so we can exercise the animation without hanging forever.
  const maxFrames = process.env.WOOF_MAX_FRAMES
    ? parseInt(process.env.WOOF_MAX_FRAMES, 10)
    : Infinity;

  if (opts.loop) {
    const onSigint = () => {
      restore();
      process.stdout.write("\n");
      process.exit(0);
    };
    process.on("SIGINT", onSigint);
    let i = 0;
    for (let count = 0; count < maxFrames; count++) {
      await sleep(FRAME_MS);
      i = (i + 1) % seq.length;
      redraw(seq[i]);
    }
    process.off("SIGINT", onSigint);
    restore();
  } else {
    try {
      for (const idx of seq.slice(1)) {
        await sleep(FRAME_MS);
        redraw(idx);
      }
    } finally {
      restore();
    }
  }
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
