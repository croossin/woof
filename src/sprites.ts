import { Mood } from "./sim";

// ── Palette ──────────────────────────────────────────────────────────
// Sprites are text grids; each letter is a pixel color, "." is transparent.
type RGB = [number, number, number];
const PALETTE: Record<string, RGB> = {
  o: [222, 148, 74], // tan body
  d: [188, 113, 48], // dark tan (outline/shade)
  c: [246, 224, 187], // cream muzzle/chest
  g: [201, 201, 201], // grey (old faithful's muzzle)
  k: [40, 32, 30], // near-black (eyes, nose)
  w: [255, 255, 255], // eye shine
  p: [239, 137, 148], // pink (tongue, inner ear)
  r: [204, 70, 60], // collar red
  y: [240, 200, 80], // collar tag gold
  x: [193, 154, 107], // cardboard
  X: [141, 110, 74], // cardboard edge
  z: [150, 170, 205], // sleepy "z" bubble
};

// One-line kaomoji faces for the statusline (sprites don't fit one line).
export const FACES: Record<Mood, string> = {
  thriving: "◕ ᴥ ◕",
  content: "• ᴥ •",
  hungry: "◉ ᴥ ◉",
  lonely: "• ︵ •",
  sleepy: "– ᴥ –",
  waiting: "u ᴥ u",
};

// ── Half-block renderer ──────────────────────────────────────────────
const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM ?? "") ||
  /iterm|kitty|ghostty|vscode|alacritty|wezterm/i.test(process.env.TERM_PROGRAM ?? process.env.TERM ?? "") ||
  process.env.COLORTERM !== undefined;

function to256([r, g, b]: RGB): number {
  return 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
}

function fg(c: RGB): string {
  return TRUECOLOR ? `\x1b[38;2;${c[0]};${c[1]};${c[2]}m` : `\x1b[38;5;${to256(c)}m`;
}

function bg(c: RGB): string {
  return TRUECOLOR ? `\x1b[48;2;${c[0]};${c[1]};${c[2]}m` : `\x1b[48;5;${to256(c)}m`;
}

/** Render a pixel grid to ANSI lines — each cell is two vertical pixels. */
export function renderGrid(rows: string[], indent = "   "): string[] {
  const width = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(width, "."));
  const out: string[] = [];
  for (let y = 0; y < grid.length; y += 2) {
    let line = indent;
    for (let x = 0; x < width; x++) {
      const top = PALETTE[grid[y][x]] ?? null;
      const bot = y + 1 < grid.length ? PALETTE[grid[y + 1][x]] ?? null : null;
      if (!top && !bot) line += " ";
      else if (top && bot) line += `${fg(top)}${bg(bot)}▀\x1b[0m`;
      else if (top) line += `${fg(top)}▀\x1b[0m`;
      else line += `${fg(bot!)}▄\x1b[0m`;
    }
    out.push(line);
  }
  return out;
}

// ── Sprite definitions ───────────────────────────────────────────────
type EyeStyle = "open" | "blink" | "happy" | "begging";
type MouthStyle = "normal" | "tongue" | "frown";

interface Variant {
  eyes: EyeStyle;
  mouth: MouthStyle;
  tail?: "up" | "down";
}

interface StageSprite {
  base: string[];
  eyeRows: [number, number];
  eyes: Record<EyeStyle, [string, string]>;
  mouthRows: [number, number];
  mouth: Record<MouthStyle, [string, string]>;
  tailRows?: number[];
  tail?: Record<"up" | "down", string[]>;
}

const PUPPY: StageSprite = {
  base: [
    "....dd........dd....",
    "...dood......dood...",
    "...dopod....dopod...",
    "...doooddddddooood..",
    "..dooooooooooooood..",
    "..dooooooooooooood..",
    "..dokwoooooookwood..",
    "..dokkoooooookkood..",
    "..doooodccccdooood..",
    "...doodccccccdood...",
    "...doodcckkccdood...",
    "....ddccccccccdd....",
    ".....dcc.cc.ccd.....",
    "....dooooooooood....",
    "...dooocccccooood...",
    "....dd.dd..dd.dd....",
  ],
  eyeRows: [6, 7],
  eyes: {
    open: ["..dokwoooooookwood..", "..dokkoooooookkood.."],
    blink: ["..dooooooooooooood..", "..dokkoooooookkood.."],
    happy: ["..dokkoooooookkood..", "..dooooooooooooood.."],
    begging: ["..dokwoooooookwood..", "..dokwoooooookwood.."],
  },
  mouthRows: [11, 12],
  mouth: {
    normal: ["....ddccccccccdd....", ".....dcc.cc.ccd....."],
    tongue: ["....ddcccppcccdd....", ".....dcc.pp.ccd....."],
    frown: ["....ddccccccccdd....", ".....dcckkkkccd....."],
  },
};

const GOOD_DOG: StageSprite = {
  base: [
    "......dd........dd......",
    ".....dood......dood.....",
    ".....dopod....dopod.....",
    ".....doooddddddooood....",
    "....dooooooooooooood....",
    "....dooooooooooooood....",
    "....dokwoooooookwood....",
    "....dokkoooooookkood....",
    "....doooodccccdooood....",
    ".....doodccccccdood.....",
    ".....doodcckkccdood.....",
    "......ddccccccccdd......",
    ".......dcc.cc.ccd.......",
    ".....dooooooooooood.....",
    "....dooocccccccoood.dd..",
    "....dooocccccccoooodddd.",
    "....dood.doood.dood.....",
    ".....dd...dd....dd......",
  ],
  eyeRows: [6, 7],
  eyes: {
    open: ["....dokwoooooookwood....", "....dokkoooooookkood...."],
    blink: ["....dooooooooooooood....", "....dokkoooooookkood...."],
    happy: ["....dokkoooooookkood....", "....dooooooooooooood...."],
    begging: ["....dokwoooooookwood....", "....dokwoooooookwood...."],
  },
  mouthRows: [11, 12],
  mouth: {
    normal: ["......ddccccccccdd......", ".......dcc.cc.ccd......."],
    tongue: ["......ddcccppcccdd......", ".......dcc.pp.ccd......."],
    frown: ["......ddccccccccdd......", ".......dcckkkkccd......."],
  },
  tailRows: [13, 14, 15],
  tail: {
    up: [
      ".....dooooooooooood..dd.",
      "....dooocccccccoood.dd..",
      "....dooocccccccoooodd...",
    ],
    down: [
      ".....dooooooooooood.....",
      "....dooocccccccoood.....",
      "....dooocccccccooooddd..",
    ],
  },
};

const BEST_FRIEND: StageSprite = {
  base: [
    ".......dd........dd.......",
    "......dood......dood......",
    "......dopod....dopod......",
    "......doooddddddooood.....",
    ".....dooooooooooooood.....",
    ".....dooooooooooooood.....",
    ".....dokwoooooookwood.....",
    ".....dokkoooooookkood.....",
    ".....doooodccccdooood.....",
    "......doodccccccdood......",
    "......doodcckkccdood......",
    ".......ddccccccccdd.......",
    "........dcc.cc.ccd........",
    "......drrrrrryyrrrrd......",
    ".....dooooooooooooood.....",
    "....doooocccccccooood.dd..",
    "....doooocccccccoooodddd.",
    "....doooocccccccooood.....",
    "....dood..doood..dood.....",
    ".....dd....dd.....dd......",
  ],
  eyeRows: [6, 7],
  eyes: {
    open: [".....dokwoooooookwood.....", ".....dokkoooooookkood....."],
    blink: [".....dooooooooooooood.....", ".....dokkoooooookkood....."],
    happy: [".....dokkoooooookkood.....", ".....dooooooooooooood....."],
    begging: [".....dokwoooooookwood.....", ".....dokwoooooookwood....."],
  },
  mouthRows: [11, 12],
  mouth: {
    normal: [".......ddccccccccdd.......", "........dcc.cc.ccd........"],
    tongue: [".......ddcccppcccdd.......", "........dcc.pp.ccd........"],
    frown: [".......ddccccccccdd.......", "........dcckkkkccd........"],
  },
  tailRows: [15, 16, 17],
  tail: {
    up: [
      "....doooocccccccooood.dd..",
      "....doooocccccccoooodddd..",
      "....doooocccccccooood.....",
    ],
    down: [
      "....doooocccccccooood.....",
      "....doooocccccccooooddd...",
      "....doooocccccccoooodd....",
    ],
  },
};

// Old faithful: best friend's frame, gone grey around the muzzle.
function greyMuzzle(sprite: StageSprite): StageSprite {
  const greyRow = (row: string, i: number) => (i <= 12 ? row.replace(/c/g, "g") : row);
  const greyPair = (p: [string, string], offset: number): [string, string] => [
    greyRow(p[0], offset),
    greyRow(p[1], offset + 1),
  ];
  return {
    ...sprite,
    base: sprite.base.map(greyRow),
    eyes: Object.fromEntries(
      Object.entries(sprite.eyes).map(([k, v]) => [k, greyPair(v as [string, string], sprite.eyeRows[0])])
    ) as StageSprite["eyes"],
    mouth: Object.fromEntries(
      Object.entries(sprite.mouth).map(([k, v]) => [k, greyPair(v as [string, string], sprite.mouthRows[0])])
    ) as StageSprite["mouth"],
  };
}

const SPRITES: Record<string, StageSprite> = {
  puppy: PUPPY,
  "good dog": GOOD_DOG,
  "best friend": BEST_FRIEND,
  "old faithful": greyMuzzle(BEST_FRIEND),
};

// ── Mood → animation frames ──────────────────────────────────────────
const MOOD_FRAMES: Record<Mood, Variant[]> = {
  content: [
    { eyes: "open", mouth: "normal", tail: "down" },
    { eyes: "blink", mouth: "normal", tail: "down" },
  ],
  thriving: [
    { eyes: "happy", mouth: "tongue", tail: "up" },
    { eyes: "happy", mouth: "tongue", tail: "down" },
  ],
  hungry: [
    { eyes: "begging", mouth: "normal", tail: "down" },
    { eyes: "open", mouth: "normal", tail: "down" },
  ],
  lonely: [
    { eyes: "open", mouth: "frown", tail: "down" },
    { eyes: "blink", mouth: "frown", tail: "down" },
  ],
  sleepy: [{ eyes: "blink", mouth: "normal", tail: "down" }],
  waiting: [
    { eyes: "open", mouth: "frown", tail: "down" },
    { eyes: "blink", mouth: "frown", tail: "down" },
  ],
};

/** How the frames should be sequenced over an idle loop. */
export const MOOD_SEQUENCE: Record<Mood, number[]> = {
  content: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  thriving: [0, 1, 0, 1, 0, 1, 0, 1, 0],
  hungry: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  lonely: [0, 0, 0, 0, 0, 0, 1, 0],
  sleepy: [0, 0, 0, 1, 1, 1, 0],
  waiting: [0, 0, 0, 0, 0, 1, 0, 0],
};

function buildGrid(sprite: StageSprite, v: Variant): string[] {
  const grid = [...sprite.base];
  grid[sprite.eyeRows[0]] = sprite.eyes[v.eyes][0];
  grid[sprite.eyeRows[1]] = sprite.eyes[v.eyes][1];
  grid[sprite.mouthRows[0]] = sprite.mouth[v.mouth][0];
  grid[sprite.mouthRows[1]] = sprite.mouth[v.mouth][1];
  if (sprite.tailRows && sprite.tail && v.tail) {
    sprite.tailRows.forEach((row, i) => (grid[row] = sprite.tail![v.tail!][i]));
  }
  return grid;
}

const setPixel = (row: string, col: number, ch: string) =>
  col < 0 || col >= row.length ? row : row.slice(0, col) + ch + row.slice(col + 1);

/**
 * The sleeping dog (eyes closed) with a "z" bubble that drifts up and to the
 * right across the two frames — so `woof status` keeps breathing at night
 * instead of freezing on a single frame.
 */
function buildSleepyFrames(sprite: StageSprite): string[][] {
  const body = buildGrid(sprite, { eyes: "blink", mouth: "normal", tail: "down" });
  const w = body[0].length;
  const blank = ".".repeat(w);
  const col = Math.floor(w * 0.72); // above the right ear
  // Two prepended rows give the bubble room to float; both frames stay the
  // same height so the animation redraws cleanly in place.
  const low = [blank, setPixel(blank, col, "z"), ...body];
  const high = [setPixel(blank, col + 1, "z"), blank, ...body];
  return [renderGrid(low), renderGrid(high)];
}

/** Rendered ANSI frames for a stage + mood. Every frame has equal height. */
export function petFrames(stageName: string, mood: Mood): string[][] {
  const sprite = SPRITES[stageName] ?? PUPPY;
  if (mood === "sleepy") return buildSleepyFrames(sprite);
  return MOOD_FRAMES[mood].map((v) => renderGrid(buildGrid(sprite, v)));
}

/** Plain-text grids for debugging sprite shapes (`woof _sprites`). */
export function debugGrids(): Array<{ label: string; grid: string[] }> {
  const out: Array<{ label: string; grid: string[] }> = [];
  for (const stage of Object.keys(SPRITES)) {
    for (const mood of Object.keys(MOOD_FRAMES) as Mood[]) {
      MOOD_FRAMES[mood].forEach((v, i) => {
        out.push({ label: `${stage} / ${mood} / f${i}`, grid: buildGrid(SPRITES[stage], v) });
      });
    }
  }
  return out;
}

export const BOX_GRID = [
  "....dd........dd....",
  "...dood......dood...",
  "..dooooooooooooood..",
  "..dokwoooooookwood..",
  "XXXXXXXXXXXXXXXXXXXX",
  "XxxxxxxxxxxxxxxxxxX.",
  "XxxxxxxxxxxxxxxxxxX.",
  "XXXXXXXXXXXXXXXXXXXX",
];
