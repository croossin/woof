import { Mood } from "./sim";

export const FACES: Record<Mood, string> = {
  thriving: "◕ ‿ ◕",
  content: "• ᴗ •",
  hungry: "• ⌓ •",
  lonely: "• ︵ •",
  sleepy: "– ᴗ –",
  hibernating: "     ",
};

// Each stage's art contains the literal token {FACE} (5 chars wide).
const HATCHLING = String.raw`
      _.-.
    .'    '.
   (  {FACE}  )
    '.,  ,.'
    ~ "  " ~
`;

const SPROUT = String.raw`
       .-~~-.
      / ,--, \
     ( ( () ) )
      \ '--' /
    .-'      '-.
   (   {FACE}    )
    '.,      ,.'
    /\ "    " /\
`;

const COMPANION = String.raw`
        .--~~~--.
       / .-~~~-. \
      / /  ,-,  \ \
     ( (  ( () ) ) )
      \ \  '-'  / /
       \ '-...-' /
     .-'         '-.
    (    {FACE}      )
     '..,       ,..'
    /\  "       "  /\
   m  m           m  m
`;

const ELDER = String.raw`
         .--~~~~~--.
        / .-~~~~~-. \
       / / .-~~~-. \ \
      / / /  ,-,  \ \ \
     ( ( (  ( () ) ) ) )
      \ \ \  '-'  / / /
       \ \ '-...-' / /
        \ '-.....-' /
      .-'           '-.
     (     {FACE}       )
      '..,         ,..'
     /\  "         "  /\
    m  m    *   *    m  m
`;

const HIBERNATING = String.raw`
       .--~~~--.
      / .-~~~-. \      z
     ( (  ,-,  ) )   z
      \ \ ( () ) /  z
       \ '-'--' /
        '-.....-'
      (tucked away)
`;

const STAGE_ART: Record<string, string> = {
  hatchling: HATCHLING,
  sprout: SPROUT,
  companion: COMPANION,
  elder: ELDER,
};

export function petArt(stageName: string, mood: Mood): string[] {
  const art = mood === "hibernating" ? HIBERNATING : STAGE_ART[stageName] ?? HATCHLING;
  const face = FACES[mood];
  return art
    .replace("{FACE}", face)
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

export const EGG_ART = [
  "      .-~~-. ",
  "     / .''. \\",
  "    | : ~~ : |",
  "    | : ~~ : |",
  "     \\ '..' /",
  "      '-..-' ",
];
