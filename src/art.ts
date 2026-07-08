import { Mood } from "./sim";

// All faces render 5 columns wide; they're padded to the 6-wide {FACE}
// token at insertion time so the art stays aligned.
export const FACES: Record<Mood, string> = {
  thriving: "◕ ᴥ ◕",
  content: "• ᴥ •",
  hungry: "◉ ᴥ ◉", // the begging eyes
  lonely: "• ︵ •",
  sleepy: "– ᴥ –",
  waiting: "u ᴥ u",
};

const PUPPY = String.raw`
  ,-.___,-.
 ( ( {FACE}) )
  \_)     (_/
   |       |
  (_)     (_)  ~
`;

const GOOD_DOG = String.raw`
   ,-.____,-.
  ( (  {FACE} ) )
   \_)       (_/
   /           \
  |             |   ,,
  |             |__//
  (__)   (__)   '--'
`;

const BEST_FRIEND = String.raw`
    ,-._____,-.
   ( (  {FACE}  ) )
    \_)        (_/
    o===[ * ]===o
   /              \
  |                |    ,,
  |                |___//
  |                |--'
  (__)   (__)   (__)
`;

const OLD_FAITHFUL = String.raw`
     .~        ~.
    ,-._____,-.
   ( (  {FACE}  ) )
    \_)        (_/
   o===[ * * ]===o
   /              \
  |                |    ,,
  |                |___//
  |                |--'
  (__)   (__)   (__)
`;

const WAITING = String.raw`
            ______
           |      |
  ,-.___,-.|      |
 ( ( {FACE}) )    |
  \_)     (_/     |
   |       |      |
  (_)     (_)_____|
`;

const STAGE_ART: Record<string, string> = {
  puppy: PUPPY,
  "good dog": GOOD_DOG,
  "best friend": BEST_FRIEND,
  "old faithful": OLD_FAITHFUL,
};

export function petArt(stageName: string, mood: Mood): string[] {
  const face = FACES[mood].padEnd(6);
  const art = mood === "waiting" ? WAITING : STAGE_ART[stageName] ?? PUPPY;
  return art
    .replace("{FACE}", face)
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

export const BOX_ART = [
  String.raw`    _________________ `,
  String.raw`   |     /\   /\     |`,
  String.raw`   |    (  o.o  )    |`,
  String.raw`   |     \_____/     |`,
  String.raw`   |_________________|`,
  String.raw`        * woof? *`,
];
