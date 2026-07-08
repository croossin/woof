import { newState, saveState, loadState, PetState } from "./state";
import { applyFeeds, stageFor } from "./sim";
import { ghLogin, fetchGithubEvents } from "./collectors/github";
import { registerCwdRepo } from "./collectors/localgit";
import { BOX_ART } from "./art";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

export async function adopt(args: string[]): Promise<void> {
  const existing = loadState();
  const force = args.includes("--force");
  if (existing && !force) {
    console.log(
      `\n  ${bold(existing.name)} already lives here. Run ${cyan("woof status")} to say hi,` +
        `\n  or ${dim("woof adopt --force")} to start over (this abandons them!).\n`
    );
    return;
  }

  const nameIdx = args.indexOf("--name");
  const name = nameIdx >= 0 && args[nameIdx + 1] ? args[nameIdx + 1] : "Byte";
  const now = new Date();

  console.log("");
  for (const l of BOX_ART) console.log("  " + cyan(l));
  console.log(`\n  Something is scratching at the box...\n`);

  const login = await ghLogin();
  const state: PetState = newState(name, login, now);
  await registerCwdRepo(state);

  if (login) {
    console.log(dim(`  Found GitHub account @${login} via gh — sniffing the last few months...`));
    const events = await fetchGithubEvents(state, { pages: 3 });
    if (events.length > 0) {
      applyFeeds(state, events, now);
      // History earns XP and memories, but a new pup starts with fresh meters.
      state.hunger = 80;
      state.happiness = 75;
    }
  } else {
    console.log(
      dim(
        "  Couldn't reach GitHub via the gh CLI (not installed or not logged in)." +
          `\n  ${name} will grow from local commits and Claude sessions instead.` +
          "\n  Run `gh auth login` any time and re-adopt to pick up your history."
      )
    );
  }

  saveState(state);

  const stage = stageFor(state.xp);
  console.log(`\n  🐶 ${bold(name)} is home!`);
  if (state.xp > 0) {
    console.log(
      `  They already know your scent — ${state.totals.commits} commits and ` +
        `${state.totals.prsMerged} merged PRs remembered (${state.xp} xp, a ${stage.name}).`
    );
  }
  console.log(`
  Say hi any time:       ${cyan("woof status")}
  Read the diary:        ${cyan("woof journal")}

  ${bold("Optional:")} let ${name} live in your Claude Code statusline by adding
  this to ${dim("~/.claude/settings.json")}:

    "statusLine": { "type": "command", "command": "woof statusline" }

  The statusline refresh doubles as ${name}'s heartbeat — no hooks, no daemons.
`);
}
