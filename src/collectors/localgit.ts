import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PetState } from "../state";
import { FeedEvent } from "../sim";

const run = promisify(execFile);

/** Remember any repo shellby is run inside, so we can scan it later. */
export async function registerCwdRepo(state: PetState): Promise<void> {
  try {
    const { stdout } = await run("git", ["rev-parse", "--show-toplevel"], {
      timeout: 5_000,
    });
    const top = stdout.trim();
    if (top && !state.knownRepos.includes(top)) {
      state.knownRepos.push(top);
    }
  } catch {
    // not in a repo — fine
  }
}

/**
 * Catch unpushed/local work: scan known repos for your commits since the
 * last scan. Dedupes by SHA against what the GitHub collector already saw.
 */
export async function scanLocalRepos(state: PetState, now: Date): Promise<FeedEvent[]> {
  const since = new Date(state.lastLocalScan ?? state.hatchedAt);
  const seenShas = new Set(state.seenShas);
  const feeds: FeedEvent[] = [];

  for (const repo of state.knownRepos) {
    if (!fs.existsSync(repo)) continue;
    let email = "";
    try {
      const { stdout } = await run("git", ["-C", repo, "config", "user.email"], {
        timeout: 5_000,
      });
      email = stdout.trim();
    } catch {
      continue;
    }
    if (!email) continue;
    try {
      const { stdout } = await run(
        "git",
        [
          "-C",
          repo,
          "log",
          `--since=${since.toISOString()}`,
          `--author=${email}`,
          "--format=%H %aI",
        ],
        { timeout: 10_000, maxBuffer: 5 * 1024 * 1024 }
      );
      for (const line of stdout.split("\n")) {
        const [sha, dateIso] = line.trim().split(" ");
        if (!sha || seenShas.has(sha)) continue;
        seenShas.add(sha);
        state.seenShas.push(sha);
        feeds.push({ kind: "commits", count: 1, when: dateIso ? new Date(dateIso) : now });
      }
    } catch {
      continue;
    }
  }

  state.lastLocalScan = now.toISOString();
  return feeds;
}
