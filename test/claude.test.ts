import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// claude.ts captures ~/.claude/projects at import via os.homedir(); set HOME
// first, then lazy-require.
let home: string;
let claude: typeof import("../src/collectors/claude");
let stateMod: typeof import("../src/state");

before(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "woof-claude-"));
  process.env.HOME = home;
  claude = require("../src/collectors/claude");
  stateMod = require("../src/state");
});

after(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

function session(lines: object[]): void {
  const dir = path.join(home, ".claude", "projects", "proj-a");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "s.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

describe("scanClaudeTokens", () => {
  test("returns nothing when there is no ~/.claude directory", async () => {
    const s = stateMod.newState("Byte", "me", new Date("2026-06-01T00:00:00Z"));
    const feeds = await claude.scanClaudeTokens(s, new Date("2026-06-01T01:00:00Z"));
    assert.deepEqual(feeds, []);
    // No projects dir → early return; the scan cursor is left untouched so a
    // later install can still backfill from the original point.
    assert.equal(s.lastClaudeScan, new Date("2026-06-01T00:00:00Z").toISOString());
  });

  test("sums output tokens from lines newer than the last scan", async () => {
    const s = stateMod.newState("Byte", "me", new Date("2026-06-01T00:00:00Z"));
    s.lastClaudeScan = new Date("2026-06-01T00:00:00Z").toISOString();
    session([
      { timestamp: "2026-06-01T00:30:00Z", message: { usage: { output_tokens: 1200 } } },
      { timestamp: "2026-06-01T00:45:00Z", message: { usage: { output_tokens: 800 } } },
    ]);
    const feeds = await claude.scanClaudeTokens(s, new Date("2026-06-01T01:00:00Z"));
    assert.equal(feeds.length, 1);
    assert.equal(feeds[0].kind, "claude-tokens");
    assert.equal(feeds[0].count, 2000);
  });

  test("ignores lines at or before the last scan timestamp", async () => {
    const s = stateMod.newState("Byte", "me", new Date("2026-06-01T00:00:00Z"));
    s.lastClaudeScan = new Date("2026-06-01T00:40:00Z").toISOString();
    session([
      { timestamp: "2026-06-01T00:30:00Z", message: { usage: { output_tokens: 999 } } }, // old
      { timestamp: "2026-06-01T00:50:00Z", message: { usage: { output_tokens: 500 } } }, // new
    ]);
    // Bump file mtime into the future so the file itself isn't skipped.
    const f = path.join(home, ".claude", "projects", "proj-a", "s.jsonl");
    const future = new Date("2026-06-01T02:00:00Z");
    fs.utimesSync(f, future, future);
    const feeds = await claude.scanClaudeTokens(s, new Date("2026-06-01T01:00:00Z"));
    assert.equal(feeds.reduce((a, b) => a + b.count, 0), 500);
  });

  test("tolerates malformed / partial JSON lines", async () => {
    const s = stateMod.newState("Byte", "me", new Date("2026-06-01T00:00:00Z"));
    s.lastClaudeScan = new Date("2026-06-01T00:00:00Z").toISOString();
    const dir = path.join(home, ".claude", "projects", "proj-a");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "s.jsonl"),
      [
        '{"timestamp":"2026-06-01T00:30:00Z","message":{"usage":{"output_tokens":300}}}',
        '{"broken":', // partial line mid-write
        "not json at all",
      ].join("\n") + "\n"
    );
    const future = new Date("2026-06-01T02:00:00Z");
    fs.utimesSync(path.join(dir, "s.jsonl"), future, future);
    const feeds = await claude.scanClaudeTokens(s, new Date("2026-06-01T01:00:00Z"));
    assert.equal(feeds.reduce((a, b) => a + b.count, 0), 300);
  });
});
