import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { journalLine, recentJournal } from "../src/journal";
import { newState, ensureDay, DailyActivity } from "../src/state";

const empty: DailyActivity = { commits: 0, prsMerged: 0, reviews: 0, claudeTokens: 0 };
const day = (over: Partial<DailyActivity>): DailyActivity => ({ ...empty, ...over });

describe("journalLine", () => {
  test("is deterministic for the same input", () => {
    const a = journalLine("2026-06-02", day({ commits: 3 }), "Byte");
    const b = journalLine("2026-06-02", day({ commits: 3 }), "Byte");
    assert.equal(a, b);
  });

  test("a merged-PR day is distinct from a quiet day", () => {
    const pr = journalLine("2026-06-02", day({ prsMerged: 1 }), "Byte");
    const quiet = journalLine("2026-06-02", empty, "Byte");
    assert.notEqual(pr, quiet);
    assert.ok(pr.length > 0 && quiet.length > 0);
  });

  test("a big day mentions the commit count", () => {
    const line = journalLine("2026-06-02", day({ commits: 14 }), "Byte");
    assert.ok(line.includes("14"));
  });

  test("uses the dog's name", () => {
    const line = journalLine("2026-06-02", day({ prsMerged: 1 }), "Pixel");
    assert.ok(line.includes("Pixel"));
  });

  test("distinct activity shapes yield distinct lines", () => {
    const seen = new Set([
      journalLine("2026-06-02", day({ prsMerged: 1 }), "Byte"),
      journalLine("2026-06-02", day({ reviews: 2 }), "Byte"),
      journalLine("2026-06-02", day({ commits: 14 }), "Byte"),
      journalLine("2026-06-02", day({ commits: 1 }), "Byte"),
      journalLine("2026-06-02", day({ claudeTokens: 50_000 }), "Byte"),
      journalLine("2026-06-02", empty, "Byte"),
    ]);
    // Six different activity shapes should not all collapse to one message.
    assert.ok(seen.size >= 4);
  });
});

describe("recentJournal", () => {
  test("returns entries in chronological order, capped to the window", () => {
    const s = newState("Byte", "me", new Date("2026-06-01T12:00:00Z"));
    for (const d of ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"]) {
      ensureDay(s, d).commits = 1;
    }
    const entries = recentJournal(s, 3);
    assert.equal(entries.length, 3);
    assert.deepEqual(
      entries.map((e) => e.day),
      ["2026-06-02", "2026-06-03", "2026-06-04"]
    );
  });

  test("empty when there is no history", () => {
    const s = newState("Byte", "me", new Date("2026-06-01T12:00:00Z"));
    assert.equal(recentJournal(s).length, 0);
  });
});
