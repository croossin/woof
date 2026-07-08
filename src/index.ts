#!/usr/bin/env node
import { loadState, saveState, PetState } from "./state";
import { tick, applyFeeds, FeedEvent } from "./sim";
import { fetchGithubEvents } from "./collectors/github";
import { scanClaudeTokens } from "./collectors/claude";
import { scanLocalRepos, registerCwdRepo } from "./collectors/localgit";
import { showStatus, renderStatusline, renderJournal } from "./render";
import { debugGrids } from "./sprites";
import { adopt } from "./adopt";

const GH_POLL_MINUTES = 5;
const LOCAL_SCAN_MINUTES = 10;

function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / 60_000;
}

/** Advance time and gather food from all sources (throttled unless forced). */
async function refresh(state: PetState, now: Date, force = false): Promise<void> {
  await registerCwdRepo(state);
  tick(state, now);

  const feeds: FeedEvent[] = [];
  if (force || minutesSince(state.lastGhPoll, now) >= GH_POLL_MINUTES) {
    state.lastGhPoll = now.toISOString();
    feeds.push(...(await fetchGithubEvents(state)));
  }
  if (force || minutesSince(state.lastLocalScan, now) >= LOCAL_SCAN_MINUTES) {
    feeds.push(...(await scanLocalRepos(state, now)));
  }
  if (force || minutesSince(state.lastClaudeScan, now) >= LOCAL_SCAN_MINUTES) {
    feeds.push(...(await scanClaudeTokens(state, now)));
  }
  applyFeeds(state, feeds, now);
  saveState(state);
}

function requireState(): PetState {
  const state = loadState();
  if (!state) {
    console.log("\n  No dog yet! Run `woof adopt` to bring one home.\n");
    process.exit(1);
  }
  return state;
}

const HELP = `
  🐶 woof — a puppy that grows with your work

  woof adopt [--name X]   bring your dog home (reads your GitHub history via gh)
  woof status             visit your dog
  woof feed               force a refresh from all sources right now
  woof statusline         one-line output for the Claude Code statusline
  woof journal            read the last week of your dog's diary
`;

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const now = new Date();

  switch (cmd) {
    case "adopt":
    case "hatch": // old habits
      await adopt(args);
      break;
    case "status": {
      const state = requireState();
      await refresh(state, now);
      await showStatus(state, now, { loop: true });
      break;
    }
    case "feed": {
      const state = requireState();
      await refresh(state, now, true);
      await showStatus(state, now);
      break;
    }
    case "statusline": {
      // Must never crash or block — it runs inside Claude Code's statusline.
      try {
        const state = loadState();
        if (!state) {
          console.log("🐶 (run `woof adopt`)");
          break;
        }
        await refresh(state, now);
        console.log(renderStatusline(state, now));
      } catch {
        console.log("🐶");
      }
      break;
    }
    case "journal": {
      const state = requireState();
      await refresh(state, now);
      console.log(renderJournal(state));
      break;
    }
    case "_sprites": {
      for (const { label, grid } of debugGrids()) {
        console.log("--- " + label);
        console.log(grid.join("\n").replace(/\./g, " "));
      }
      break;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.log(`\n  Unknown command: ${cmd}\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("woof whimpered:", err?.message ?? err);
  process.exit(1);
});
