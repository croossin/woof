import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// Path to the test-compiled CLI (dist-test/src/index.js). __dirname is
// dist-test/test at runtime.
const CLI = path.join(__dirname, "..", "src", "index.js");

export interface Sandbox {
  home: string; // sandbox HOME → isolates ~/.woof and ~/.claude
  bin: string; // fake gh/git live here, prepended to PATH
  repo: string; // an existing dir to stand in for a git repo
  fixtures: string; // scratch dir for fixture files
  cleanup(): void;
}

// A fake `gh` that dispatches on args and reads canned responses from env.
const FAKE_GH = `#!/bin/sh
case "$*" in
  *"/events"*)
    case "$*" in
      *"page=1"*)
        if [ -n "$FAKE_GH_EVENTS" ] && [ -f "$FAKE_GH_EVENTS" ]; then cat "$FAKE_GH_EVENTS"; else printf '[]\\n'; fi ;;
      *) printf '[]\\n' ;;
    esac ;;
  *"/compare/"*)
    if [ -n "$FAKE_GH_COMPARE" ] && [ -f "$FAKE_GH_COMPARE" ]; then cat "$FAKE_GH_COMPARE"; else printf '{"total_commits":0,"commits":[]}\\n'; fi ;;
  *"/pulls/"*)
    if [ -n "$FAKE_GH_PULL_MERGED_AT" ]; then printf '{"merged_at":"%s"}\\n' "$FAKE_GH_PULL_MERGED_AT"; else printf '{"merged_at":null}\\n'; fi ;;
  *"api user"*)
    if [ -n "$FAKE_GH_LOGIN" ]; then printf '%s\\n' "$FAKE_GH_LOGIN"; exit 0; else exit 1; fi ;;
  *) printf '{}\\n' ;;
esac
`;

// A fake `git` that answers only what the collectors ask for.
const FAKE_GIT = `#!/bin/sh
case "$*" in
  *"rev-parse --show-toplevel"*)
    if [ -n "$FAKE_GIT_REPO" ]; then printf '%s\\n' "$FAKE_GIT_REPO"; exit 0; else exit 128; fi ;;
  *"config user.email"*)
    printf '%s\\n' "\${FAKE_GIT_EMAIL:-you@example.com}" ;;
  *log*)
    if [ -n "$FAKE_GIT_LOG" ] && [ -f "$FAKE_GIT_LOG" ]; then cat "$FAKE_GIT_LOG"; fi ;;
  *) : ;;
esac
`;

export function createSandbox(): Sandbox {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "woof-home-"));
  const bin = path.join(home, "bin");
  const fixtures = path.join(home, "fixtures");
  const repo = path.join(home, "repo");
  for (const d of [bin, fixtures, repo]) fs.mkdirSync(d, { recursive: true });

  fs.writeFileSync(path.join(bin, "gh"), FAKE_GH);
  fs.writeFileSync(path.join(bin, "git"), FAKE_GIT);
  fs.chmodSync(path.join(bin, "gh"), 0o755);
  fs.chmodSync(path.join(bin, "git"), 0o755);

  return {
    home,
    bin,
    repo,
    fixtures,
    cleanup: () => fs.rmSync(home, { recursive: true, force: true }),
  };
}

export interface RunOpts {
  cwd?: string;
  ghLogin?: string; // makes `gh api user` succeed (adopt onboarding)
  eventsFile?: string;
  compareFile?: string;
  pullMergedAt?: string;
  gitRepo?: string; // makes `git rev-parse --show-toplevel` succeed
  gitEmail?: string;
  gitLogFile?: string;
  env?: Record<string, string>;
}

export interface RunResult {
  stdout: string; // raw, with ANSI
  text: string; // stdout with ANSI stripped, for content assertions
  stderr: string;
  status: number | null;
}

export const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

export function runCli(sb: Sandbox, args: string[], opts: RunOpts = {}): RunResult {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: sb.home,
    PATH: `${sb.bin}:${process.env.PATH ?? ""}`,
  };
  // Clear any fakes from a prior run leaking through process.env.
  for (const k of [
    "FAKE_GH_LOGIN",
    "FAKE_GH_EVENTS",
    "FAKE_GH_COMPARE",
    "FAKE_GH_PULL_MERGED_AT",
    "FAKE_GIT_REPO",
    "FAKE_GIT_EMAIL",
    "FAKE_GIT_LOG",
  ]) {
    delete env[k];
  }
  if (opts.ghLogin) env.FAKE_GH_LOGIN = opts.ghLogin;
  if (opts.eventsFile) env.FAKE_GH_EVENTS = opts.eventsFile;
  if (opts.compareFile) env.FAKE_GH_COMPARE = opts.compareFile;
  if (opts.pullMergedAt) env.FAKE_GH_PULL_MERGED_AT = opts.pullMergedAt;
  if (opts.gitRepo) env.FAKE_GIT_REPO = opts.gitRepo;
  if (opts.gitEmail) env.FAKE_GIT_EMAIL = opts.gitEmail;
  if (opts.gitLogFile) env.FAKE_GIT_LOG = opts.gitLogFile;
  Object.assign(env, opts.env ?? {});

  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd: opts.cwd ?? sb.home,
    env,
    encoding: "utf8",
    timeout: 20_000,
  });
  const stdout = res.stdout ?? "";
  return { stdout, text: stripAnsi(stdout), stderr: res.stderr ?? "", status: res.status };
}

export function readState(sb: Sandbox): any {
  return JSON.parse(fs.readFileSync(path.join(sb.home, ".woof", "state.json"), "utf8"));
}

export function stateExists(sb: Sandbox): boolean {
  return fs.existsSync(path.join(sb.home, ".woof", "state.json"));
}

// ── Fixture builders ─────────────────────────────────────────────────
export function writeJson(sb: Sandbox, name: string, value: unknown): string {
  const p = path.join(sb.fixtures, name);
  fs.writeFileSync(p, JSON.stringify(value));
  return p;
}

export function pushEvent(
  id: string,
  createdAt: string,
  shas: string[],
  distinct?: number,
  repo = "me/repo"
) {
  return {
    id,
    type: "PushEvent",
    created_at: createdAt,
    repo: { name: repo },
    payload: { commits: shas.map((sha) => ({ sha })), distinct_size: distinct ?? shas.length },
  };
}

export function slimPushEvent(
  id: string,
  createdAt: string,
  before: string,
  head: string,
  repo = "me/repo"
) {
  return {
    id,
    type: "PushEvent",
    created_at: createdAt,
    repo: { name: repo },
    payload: { before, head },
  };
}

export function mergedPrEvent(id: string, createdAt: string) {
  return {
    id,
    type: "PullRequestEvent",
    created_at: createdAt,
    payload: { action: "closed", pull_request: { merged: true } },
  };
}

export function slimClosedPrEvent(id: string, createdAt: string, number: number, repo = "me/repo") {
  return {
    id,
    type: "PullRequestEvent",
    created_at: createdAt,
    repo: { name: repo },
    payload: { action: "closed", pull_request: { number } },
  };
}

export function reviewEvent(id: string, createdAt: string) {
  return { id, type: "PullRequestReviewEvent", created_at: createdAt, payload: {} };
}

export function compareResult(commits: Array<{ sha: string; login?: string }>, total?: number) {
  return {
    total_commits: total ?? commits.length,
    commits: commits.map((c) => ({ sha: c.sha, author: c.login ? { login: c.login } : undefined })),
  };
}

export function writeClaudeSession(sb: Sandbox, tokens: number, tsMs: number): void {
  const dir = path.join(sb.home, ".claude", "projects", "proj");
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date(tsMs).toISOString(),
    message: { usage: { output_tokens: tokens } },
  });
  fs.writeFileSync(path.join(dir, "session.jsonl"), line + "\n");
}

export function writeGitLog(sb: Sandbox, commits: Array<{ sha: string; iso: string }>): string {
  const p = path.join(sb.fixtures, "gitlog.txt");
  fs.writeFileSync(p, commits.map((c) => `${c.sha} ${c.iso}`).join("\n") + "\n");
  return p;
}
