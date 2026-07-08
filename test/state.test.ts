import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// state.ts captures os.homedir() at import time, so HOME must be set to a
// sandbox BEFORE the module loads. We therefore require() it lazily rather
// than using a top-level import (which the compiler would hoist).
let home: string;
let state: typeof import("../src/state");

before(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "woof-state-"));
  process.env.HOME = home;
  state = require("../src/state");
});

after(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("dayKey", () => {
  test("formats as zero-padded YYYY-MM-DD", () => {
    assert.equal(state.dayKey(new Date(2026, 0, 5, 10, 0, 0)), "2026-01-05");
    assert.equal(state.dayKey(new Date(2026, 11, 31, 23, 0, 0)), "2026-12-31");
  });
});

describe("ensureDay", () => {
  test("creates a zeroed bucket then returns the same reference", () => {
    const s = state.newState("Byte", "me", new Date("2026-06-01T12:00:00Z"));
    const a = state.ensureDay(s, "2026-06-02");
    assert.deepEqual(a, { commits: 0, prsMerged: 0, reviews: 0, claudeTokens: 0 });
    a.commits = 4;
    assert.equal(state.ensureDay(s, "2026-06-02").commits, 4);
  });
});

describe("newState", () => {
  test("has sane starting values", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const s = state.newState("Byte", "me", now);
    assert.equal(s.version, 1);
    assert.equal(s.name, "Byte");
    assert.equal(s.githubLogin, "me");
    assert.equal(s.hunger, 80);
    assert.equal(s.happiness, 75);
    assert.equal(s.xp, 0);
    assert.equal(s.waiting, false);
    assert.equal(s.hatchedAt, now.toISOString());
    assert.deepEqual(s.totals, { commits: 0, prsMerged: 0, reviews: 0, claudeTokens: 0 });
  });
});

describe("save / load round-trip", () => {
  test("loadState returns null before anything is saved", () => {
    // This runs before the first saveState in this file, so the sandbox
    // still has no state file.
    assert.equal(state.loadState(), null);
  });

  test("saves and reloads an equivalent object", () => {
    const s = state.newState("Rex", "me", new Date("2026-06-01T12:00:00Z"));
    s.xp = 123;
    s.hunger = 42;
    state.saveState(s);
    const loaded = state.loadState();
    assert.ok(loaded);
    assert.equal(loaded!.name, "Rex");
    assert.equal(loaded!.xp, 123);
    assert.equal(loaded!.hunger, 42);
  });

  test("writes atomically, leaving no .tmp behind", () => {
    const s = state.newState("Byte", "me", new Date("2026-06-01T12:00:00Z"));
    state.saveState(s);
    const dir = path.join(home, ".woof");
    assert.ok(fs.existsSync(path.join(dir, "state.json")));
    assert.ok(!fs.existsSync(path.join(dir, "state.json.tmp")));
  });
});

describe("saveState trimming (keeps the file small)", () => {
  test("caps seenShas, seenEventIds and dailyLog", () => {
    const s = state.newState("Byte", "me", new Date("2026-06-01T12:00:00Z"));
    s.seenShas = Array.from({ length: 2500 }, (_, i) => `sha${i}`);
    s.seenEventIds = Array.from({ length: 1200 }, (_, i) => `ev${i}`);
    for (let i = 0; i < 70; i++) {
      const d = new Date(2026, 0, 1 + i);
      state.ensureDay(s, state.dayKey(d)).commits = 1;
    }
    state.saveState(s);
    const loaded = state.loadState()!;
    assert.equal(loaded.seenShas.length, 2000);
    assert.equal(loaded.seenEventIds.length, 1000);
    assert.equal(Object.keys(loaded.dailyLog).length, 60);
    // The most-recent shas/ids survive (slice(-N) keeps the tail).
    assert.equal(loaded.seenShas[loaded.seenShas.length - 1], "sha2499");
    assert.equal(loaded.seenEventIds[loaded.seenEventIds.length - 1], "ev1199");
  });
});
