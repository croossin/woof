import { newState, saveState, loadState, PetState } from "./state";
import { applyFeeds, stageFor, FeedEvent } from "./sim";
import { ghLogin, fetchGithubEvents } from "./collectors/github";
import { registerCwdRepo } from "./collectors/localgit";
import { animateBox } from "./render";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function tally(events: FeedEvent[]): { commits: number; prs: number; reviews: number } {
  let commits = 0,
    prs = 0,
    reviews = 0;
  for (const e of events) {
    if (e.kind === "commits") commits += e.count;
    else if (e.kind === "pr-merged") prs += e.count;
    else if (e.kind === "review") reviews += e.count;
  }
  return { commits, prs, reviews };
}

function noGithubHelp(name: string): void {
  console.log(
    `\n  ${yellow("No GitHub connection yet.")}` +
      `\n  ${name} will still grow from your local commits and Claude sessions —` +
      `\n  but connecting GitHub lets it feed on your work across every repo,` +
      `\n  pushed from any machine.` +
      `\n\n  ${bold("To connect, once you're set up with the GitHub CLI:")}` +
      `\n    1. Install it:      ${cyan("brew install gh")}   ${dim("(or https://cli.github.com)")}` +
      `\n    2. Log in:          ${cyan("gh auth login")}` +
      `\n    3. Back-fill here:  ${cyan("woof connect")}` +
      `\n\n  ${dim("woof connect reads your recent history and feeds it to " + name + " — no re-adopting.")}\n`
  );
}

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

  await animateBox();
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

  if (!login) {
    noGithubHelp(name);
  }

  console.log(`
  Say hi any time:       ${cyan("woof status")}
  Read the diary:        ${cyan("woof journal")}

  ${bold("Let " + name + " live in your Claude Code statusline:")}
    ${cyan("woof statusline --install")}
  ${dim("(writes the statusLine config into ~/.claude/settings.json for you)")}
`);
}

/** Attach (or refresh) GitHub for an existing dog and back-fill history. */
export async function connectGithub(): Promise<void> {
  const state = loadState();
  if (!state) {
    console.log(`\n  No dog yet! Run ${cyan("woof adopt")} first.\n`);
    process.exit(1);
  }

  const login = await ghLogin();
  if (!login) {
    noGithubHelp(state.name);
    return;
  }

  const wasConnected = state.githubLogin === login;
  state.githubLogin = login;
  const now = new Date();
  const events = await fetchGithubEvents(state, { pages: 3 });
  applyFeeds(state, events, now);
  saveState(state);

  const found = tally(events);
  console.log(`\n  🔗 ${bold(`Connected to @${login}.`)}`);
  if (found.commits || found.prs || found.reviews) {
    console.log(
      `  Fetched ${found.commits} commits, ${found.prs} merged PRs and ` +
        `${found.reviews} reviews for ${state.name}.`
    );
  } else if (wasConnected) {
    console.log(dim(`  Already up to date — nothing new since last time.`));
  } else {
    console.log(dim(`  No recent activity found, but you're connected now.`));
  }
  console.log(`\n  Visit: ${cyan("woof status")}\n`);
}
