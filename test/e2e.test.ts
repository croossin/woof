import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createSandbox,
  runCli,
  readState,
  stateExists,
  writeJson,
  writeClaudeSession,
  writeGitLog,
  pushEvent,
  slimPushEvent,
  mergedPrEvent,
  slimClosedPrEvent,
  reviewEvent,
  compareResult,
  Sandbox,
} from "./helpers";

let sb: Sandbox;
beforeEach(() => {
  sb = createSandbox();
});
afterEach(() => {
  sb.cleanup();
});

describe("help & unknown commands", () => {
  test("no args prints help", () => {
    const r = runCli(sb, []);
    assert.equal(r.status, 0);
    assert.match(r.text, /woof/);
    assert.match(r.text, /adopt/);
  });

  test("unknown command exits non-zero", () => {
    const r = runCli(sb, ["frolic"]);
    assert.equal(r.status, 1);
    assert.match(r.text, /Unknown command/);
  });
});

describe("commands before adoption", () => {
  test("status errors and exits 1 when there is no dog", () => {
    const r = runCli(sb, ["status"]);
    assert.equal(r.status, 1);
    assert.match(r.text, /No dog yet/);
  });

  test("statusline never crashes and nudges you to adopt", () => {
    const r = runCli(sb, ["statusline"]);
    assert.equal(r.status, 0);
    assert.match(r.text, /adopt/);
    assert.ok(!stateExists(sb));
  });
});

describe("adopt — onboarding", () => {
  test("without gh, grows from local sources and starts fresh", () => {
    const r = runCli(sb, ["adopt"]); // no ghLogin → fake gh login fails
    assert.equal(r.status, 0);
    assert.match(r.text, /is home/);
    assert.match(r.text, /grow from local commits/);
    const s = readState(sb);
    assert.equal(s.name, "Byte");
    assert.equal(s.githubLogin, null);
    assert.equal(s.xp, 0);
    assert.equal(s.totals.commits, 0);
  });

  test("--name sets a custom name", () => {
    const r = runCli(sb, ["adopt", "--name", "Pixel"]);
    assert.equal(r.status, 0);
    assert.match(r.text, /Pixel is home/);
    assert.equal(readState(sb).name, "Pixel");
  });

  test("with gh history, backfills commits, a merged PR and a review", () => {
    const events = writeJson(sb, "events.json", [
      pushEvent("e1", "2026-07-05T10:00:00Z", ["a1", "a2", "a3"]),
      pushEvent("e2", "2026-07-05T11:00:00Z", ["b1", "b2"]),
      mergedPrEvent("e3", "2026-07-05T12:00:00Z"),
      reviewEvent("e4", "2026-07-05T13:00:00Z"),
    ]);
    const r = runCli(sb, ["adopt"], { ghLogin: "me", eventsFile: events });
    assert.equal(r.status, 0);
    const s = readState(sb);
    assert.equal(s.githubLogin, "me");
    assert.equal(s.totals.commits, 5);
    assert.equal(s.totals.prsMerged, 1);
    assert.equal(s.totals.reviews, 1);
    assert.equal(s.xp, 5 * 5 + 25 + 10); // 60
    // Meters reset to fresh values even though history was read.
    assert.equal(s.hunger, 80);
    assert.equal(s.happiness, 75);
  });

  test("refuses to overwrite an existing dog without --force", () => {
    runCli(sb, ["adopt", "--name", "Byte"]);
    const before = readState(sb);
    const r = runCli(sb, ["adopt", "--name", "Rex"]);
    assert.equal(r.status, 0);
    assert.match(r.text, /already lives here/);
    assert.equal(readState(sb).name, "Byte"); // unchanged
    assert.equal(readState(sb).hatchedAt, before.hatchedAt);
  });

  test("--force starts over", () => {
    runCli(sb, ["adopt", "--name", "Byte"]);
    const r = runCli(sb, ["adopt", "--force", "--name", "Rex"]);
    assert.equal(r.status, 0);
    assert.equal(readState(sb).name, "Rex");
  });
});

describe("adopt — private-repo event enrichment", () => {
  test("slim push is enriched via compare, counting only your commits", () => {
    const events = writeJson(sb, "events.json", [
      slimPushEvent("e1", "2026-07-05T10:00:00Z", "aaa", "bbb"),
    ]);
    const compare = writeJson(
      sb,
      "compare.json",
      compareResult([
        { sha: "c1", login: "me" },
        { sha: "c2", login: "me" },
        { sha: "c3", login: "me" },
        { sha: "c4", login: "teammate" },
      ])
    );
    const r = runCli(sb, ["adopt"], { ghLogin: "me", eventsFile: events, compareFile: compare });
    assert.equal(r.status, 0);
    assert.equal(readState(sb).totals.commits, 3); // teammate's c4 excluded
  });

  test("a huge push is capped so a merge sweep can't gorge the dog", () => {
    // Public-style payload: one listed commit but distinct_size 500. The
    // inline path extrapolates then clamps to MAX_COMMITS_PER_PUSH.
    const events = writeJson(sb, "events.json", [
      pushEvent("e1", "2026-07-05T10:00:00Z", ["a1"], 500),
    ]);
    const r = runCli(sb, ["adopt"], { ghLogin: "me", eventsFile: events });
    assert.equal(r.status, 0);
    assert.equal(readState(sb).totals.commits, 25); // MAX_COMMITS_PER_PUSH
  });

  test("slim closed PR counts only when the API confirms a merge", () => {
    const events = writeJson(sb, "events.json", [
      slimClosedPrEvent("e1", "2026-07-05T10:00:00Z", 42),
    ]);
    const merged = runCli(sb, ["adopt"], {
      ghLogin: "me",
      eventsFile: events,
      pullMergedAt: "2026-07-05T10:05:00Z",
    });
    assert.equal(readState(sb).totals.prsMerged, 1);
    merged; // (silence unused)

    // Fresh sandbox: same event, but the PR was closed unmerged.
    const sb2 = createSandbox();
    try {
      const ev2 = writeJson(sb2, "events.json", [slimClosedPrEvent("e1", "2026-07-05T10:00:00Z", 42)]);
      runCli(sb2, ["adopt"], { ghLogin: "me", eventsFile: ev2 }); // no pullMergedAt
      assert.equal(readState(sb2).totals.prsMerged, 0);
    } finally {
      sb2.cleanup();
    }
  });
});

describe("post-adoption commands", () => {
  function adoptWithHistory() {
    const events = writeJson(sb, "events.json", [
      pushEvent("e1", "2026-07-05T10:00:00Z", ["a1", "a2"]),
      reviewEvent("e2", "2026-07-06T13:00:00Z"),
    ]);
    return runCli(sb, ["adopt"], { ghLogin: "me", eventsFile: events });
  }

  test("status renders the dog, meters and lifetime stats", () => {
    adoptWithHistory();
    const r = runCli(sb, ["status"]);
    assert.equal(r.status, 0);
    assert.match(r.text, /Byte the/);
    assert.match(r.text, /food/);
    assert.match(r.text, /joy/);
    assert.match(r.text, /lifetime/);
  });

  test("statusline emits a single dog line", () => {
    adoptWithHistory();
    const r = runCli(sb, ["statusline"]);
    assert.equal(r.status, 0);
    const lines = r.text.trim().split("\n");
    assert.equal(lines.length, 1);
    assert.match(lines[0], /🐶/);
  });

  test("journal shows diary entries for recorded days", () => {
    adoptWithHistory();
    const r = runCli(sb, ["journal"]);
    assert.equal(r.status, 0);
    assert.match(r.text, /journal/);
    assert.ok(r.text.includes("2026-07-05") || r.text.includes("2026-07-06"));
  });
});

describe("feed — forced refresh from all sources", () => {
  test("counts fresh Claude tokens and does not double-count on re-run", () => {
    runCli(sb, ["adopt"]); // no gh
    writeClaudeSession(sb, 60_000, Date.now());
    const r1 = runCli(sb, ["feed"]);
    assert.equal(r1.status, 0);
    const after1 = readState(sb);
    assert.equal(after1.totals.claudeTokens, 60_000);

    // No new transcript → a second feed adds nothing.
    const r2 = runCli(sb, ["feed"]);
    assert.equal(r2.status, 0);
    assert.equal(readState(sb).totals.claudeTokens, 60_000);
  });

  test("picks up local unpushed commits via the git scan", () => {
    // Adopt inside the sandbox repo so it becomes a known repo.
    runCli(sb, ["adopt"], { cwd: sb.repo, gitRepo: sb.repo });
    const log = writeGitLog(sb, [
      { sha: "local1", iso: "2026-07-06T09:00:00Z" },
      { sha: "local2", iso: "2026-07-06T10:00:00Z" },
    ]);
    const r = runCli(sb, ["feed"], {
      cwd: sb.repo,
      gitRepo: sb.repo,
      gitEmail: "me@example.com",
      gitLogFile: log,
    });
    assert.equal(r.status, 0);
    assert.equal(readState(sb).totals.commits, 2);
  });
});

describe("state integrity", () => {
  test("repeated invocations keep the state file valid JSON", () => {
    runCli(sb, ["adopt"]);
    for (const cmd of ["status", "statusline", "journal", "feed", "status"]) {
      const r = runCli(sb, [cmd]);
      assert.equal(r.status, 0, `${cmd} exited non-zero`);
    }
    const s = readState(sb); // throws if not valid JSON
    assert.equal(s.version, 1);
    assert.equal(s.name, "Byte");
  });
});
