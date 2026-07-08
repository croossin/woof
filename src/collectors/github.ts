import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PetState } from "../state";
import { FeedEvent } from "../sim";

const run = promisify(execFile);

// A single push carrying more than this is almost always a merge/rebase
// sweeping in history, not a day's honest work.
const MAX_COMMITS_PER_PUSH = 25;

async function gh(path: string): Promise<any> {
  const { stdout } = await run("gh", ["api", path], {
    timeout: 15_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function ghLogin(): Promise<string | null> {
  try {
    const { stdout } = await run("gh", ["api", "user", "-q", ".login"], { timeout: 10_000 });
    const login = stdout.trim();
    return login || null;
  } catch {
    return null;
  }
}

interface GhEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name: string };
  payload: any;
}

interface SlimPush {
  repo: string;
  before?: string;
  head?: string;
  when: Date;
}

interface PrLookup {
  repo: string;
  number: number;
  when: Date;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit).map(fn);
    out.push(...(await Promise.all(batch)));
  }
  return out;
}

/**
 * Poll the GitHub events feed via `gh` (auth included for free) and turn
 * unseen events into feed events. Mutates seenEventIds/seenShas on state.
 *
 * Private-repo events arrive "slimmed": PushEvents carry only before/head
 * SHAs and closed-PR events omit the merged flag. We enrich those with the
 * compare API and a PR lookup, capped so a poll stays cheap.
 */
export async function fetchGithubEvents(
  state: PetState,
  opts: { pages?: number; enrichCap?: number } = {}
): Promise<FeedEvent[]> {
  if (!state.githubLogin) return [];
  const pages = opts.pages ?? 1;
  const enrichCap = opts.enrichCap ?? 60;
  const feeds: FeedEvent[] = [];
  const seenIds = new Set(state.seenEventIds);
  const seenShas = new Set(state.seenShas);
  const slimPushes: SlimPush[] = [];
  const prLookups: PrLookup[] = [];

  const markSha = (sha: string | undefined): boolean => {
    if (!sha || seenShas.has(sha)) return false;
    seenShas.add(sha);
    state.seenShas.push(sha);
    return true;
  };

  for (let page = 1; page <= pages; page++) {
    let events: GhEvent[];
    try {
      events = await gh(`users/${state.githubLogin}/events?per_page=100&page=${page}`);
    } catch {
      break; // offline, rate-limited, or gh missing — try again next poll
    }
    if (!Array.isArray(events) || events.length === 0) break;

    for (const ev of events) {
      if (!ev?.id || seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);
      state.seenEventIds.push(ev.id);
      const when = new Date(ev.created_at);
      const repo = ev.repo?.name ?? "";

      if (ev.type === "PushEvent") {
        const commits: Array<{ sha: string }> = ev.payload?.commits ?? [];
        if (commits.length > 0 || ev.payload?.distinct_size != null) {
          // Public-style payload: commits listed inline.
          let fresh = 0;
          for (const c of commits) if (markSha(c?.sha)) fresh++;
          const distinct = ev.payload?.distinct_size ?? commits.length;
          fresh += Math.max(0, distinct - commits.length);
          fresh = Math.min(fresh, MAX_COMMITS_PER_PUSH);
          if (fresh > 0) feeds.push({ kind: "commits", count: fresh, when });
        } else if (repo) {
          slimPushes.push({ repo, before: ev.payload?.before, head: ev.payload?.head, when });
        }
      } else if (ev.type === "PullRequestEvent" && ev.payload?.action === "closed") {
        const pr = ev.payload?.pull_request ?? {};
        if (pr.merged === true || pr.merged_at) {
          feeds.push({ kind: "pr-merged", count: 1, when });
        } else if (pr.merged == null && repo && pr.number) {
          prLookups.push({ repo, number: pr.number, when }); // slim payload — verify
        }
      } else if (ev.type === "PullRequestReviewEvent") {
        feeds.push({ kind: "review", count: 1, when });
      }
    }
  }

  // Enrich slim pushes: exact commit count + SHAs from the compare API.
  const pushResults = await mapLimit(slimPushes.slice(0, enrichCap), 8, async (p) => {
    const fallback = () => {
      // New branch or force push we can't diff — count the head commit only.
      return markSha(p.head) ? { count: 1, when: p.when } : null;
    };
    if (!p.before || /^0+$/.test(p.before) || !p.head) return fallback();
    try {
      const cmp = await gh(`repos/${p.repo}/compare/${p.before}...${p.head}`);
      const listed: Array<{ sha: string; author?: { login?: string } }> = cmp?.commits ?? [];
      // A push can carry merged-in commits from teammates (merging main into
      // a branch) — only commits YOU authored feed the pet.
      const login = state.githubLogin!.toLowerCase();
      let fresh = 0;
      for (const c of listed) {
        const isNew = markSha(c?.sha);
        const mine = !c?.author?.login || c.author.login.toLowerCase() === login;
        if (isNew && mine) fresh++;
      }
      fresh = Math.min(fresh, MAX_COMMITS_PER_PUSH);
      return fresh > 0 ? { count: fresh, when: p.when } : null;
    } catch {
      return fallback();
    }
  });
  for (const r of pushResults) {
    if (r) feeds.push({ kind: "commits", count: r.count, when: r.when });
  }

  // Enrich slim closed-PR events: confirm the merge.
  const prResults = await mapLimit(prLookups.slice(0, 20), 8, async (p) => {
    try {
      const pr = await gh(`repos/${p.repo}/pulls/${p.number}`);
      return pr?.merged_at ? { when: p.when } : null;
    } catch {
      return null;
    }
  });
  for (const r of prResults) {
    if (r) feeds.push({ kind: "pr-merged", count: 1, when: r.when });
  }

  return feeds;
}
