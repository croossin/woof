import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { newState, PetState } from "../src/state";
import {
  stageFor,
  nextStage,
  tick,
  applyFeeds,
  moodFor,
  isAsleep,
  STAGES,
  FeedEvent,
} from "../src/sim";

const T0 = new Date("2026-06-01T12:00:00Z");
function base(): PetState {
  return newState("Byte", "me", T0);
}
function hoursLater(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}
function daysLater(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

describe("stageFor / nextStage", () => {
  test("maps xp to the right stage at and around each boundary", () => {
    assert.equal(stageFor(0).name, "puppy");
    assert.equal(stageFor(299).name, "puppy");
    assert.equal(stageFor(300).name, "good dog");
    assert.equal(stageFor(1499).name, "good dog");
    assert.equal(stageFor(1500).name, "best friend");
    assert.equal(stageFor(4999).name, "best friend");
    assert.equal(stageFor(5000).name, "old faithful");
    assert.equal(stageFor(50_000).name, "old faithful");
  });

  test("nextStage points to the upcoming stage, null when maxed", () => {
    assert.equal(nextStage(0)?.name, "good dog");
    assert.equal(nextStage(299)?.name, "good dog");
    assert.equal(nextStage(300)?.name, "best friend");
    assert.equal(nextStage(1500)?.name, "old faithful");
    assert.equal(nextStage(5000), null);
    assert.equal(nextStage(9999), null);
  });

  test("stage thresholds are strictly increasing", () => {
    for (let i = 1; i < STAGES.length; i++) {
      assert.ok(STAGES[i].minXp > STAGES[i - 1].minXp);
    }
  });
});

describe("isAsleep", () => {
  test("wrap-around window (23:00–07:00)", () => {
    const s = base(); // sleepStart 23, sleepEnd 7
    const at = (h: number) => isAsleep(s, new Date(2026, 5, 1, h, 0, 0));
    assert.equal(at(23), true);
    assert.equal(at(0), true);
    assert.equal(at(3), true);
    assert.equal(at(6), true);
    assert.equal(at(7), false);
    assert.equal(at(12), false);
    assert.equal(at(22), false);
  });

  test("non-wrap window (01:00–05:00)", () => {
    const s = base();
    s.sleepStart = 1;
    s.sleepEnd = 5;
    const at = (h: number) => isAsleep(s, new Date(2026, 5, 1, h, 0, 0));
    assert.equal(at(0), false);
    assert.equal(at(1), true);
    assert.equal(at(4), true);
    assert.equal(at(5), false);
    assert.equal(at(12), false);
  });
});

describe("tick (time-based decay)", () => {
  test("decays hunger and happiness over elapsed hours", () => {
    const s = base();
    s.hunger = 80;
    s.happiness = 75;
    s.lastTick = T0.toISOString();
    tick(s, hoursLater(T0, 10));
    // 10h > 1h → effective = 10 * 0.84 = 8.4
    assert.ok(Math.abs(s.hunger - (80 - 8.4 * 2.0)) < 1e-6);
    assert.ok(Math.abs(s.happiness - (75 - 8.4 * 1.2)) < 1e-6);
    assert.equal(s.lastTick, hoursLater(T0, 10).toISOString());
  });

  test("clamps meters at zero, never negative", () => {
    const s = base();
    s.hunger = 5;
    s.happiness = 5;
    s.lastTick = T0.toISOString();
    tick(s, hoursLater(T0, 100));
    assert.equal(s.hunger, 0);
    assert.equal(s.happiness, 0);
  });

  test("no decay while waiting by the door", () => {
    const s = base();
    s.hunger = 40;
    s.happiness = 40;
    s.waiting = true;
    s.lastTick = T0.toISOString();
    tick(s, hoursLater(T0, 48));
    assert.equal(s.hunger, 40);
    assert.equal(s.happiness, 40);
  });

  test("enters 'waiting' after long idle, flooring meters at 10", () => {
    const s = base();
    s.hunger = 80;
    s.happiness = 80;
    const now = daysLater(T0, 15); // > 14 day threshold
    s.lastTick = T0.toISOString();
    s.lastActivity = T0.toISOString();
    tick(s, now);
    assert.equal(s.waiting, true);
    assert.equal(s.hunger, 10);
    assert.equal(s.happiness, 10);
  });

  test("short elapsed time (<=1h) decays without the sleep discount", () => {
    const s = base();
    s.hunger = 50;
    s.lastTick = T0.toISOString();
    tick(s, hoursLater(T0, 1));
    assert.ok(Math.abs(s.hunger - (50 - 1 * 2.0)) < 1e-6);
  });
});

describe("applyFeeds", () => {
  test("empty feed list changes nothing and does not touch lastActivity", () => {
    const s = base();
    const before = JSON.stringify(s);
    applyFeeds(s, [], hoursLater(T0, 1));
    assert.equal(JSON.stringify(s), before);
  });

  test("commits raise hunger, xp, totals and the daily log (with caps)", () => {
    const s = base();
    s.hunger = 50;
    s.happiness = 50;
    const when = new Date("2026-06-02T09:00:00Z");
    applyFeeds(s, [{ kind: "commits", count: 3, when }], when);
    assert.equal(s.totals.commits, 3);
    assert.equal(s.xp, 15); // 3 * 5
    assert.equal(s.hunger, 50 + Math.min(30, 3 * 6)); // 68
    assert.equal(s.happiness, 50 + Math.min(6, 3 * 2)); // 56
    assert.equal(s.dailyLog["2026-06-02"].commits, 3);
    assert.equal(s.lastActivity, when.toISOString());
  });

  test("commit hunger bonus is capped at 30", () => {
    const s = base();
    s.hunger = 0;
    applyFeeds(s, [{ kind: "commits", count: 100, when: T0 }], T0);
    assert.equal(s.hunger, 30);
  });

  test("merged PR, review, and claude tokens each apply", () => {
    const s = base();
    s.xp = 0;
    applyFeeds(
      s,
      [
        { kind: "pr-merged", count: 1, when: T0 },
        { kind: "review", count: 1, when: T0 },
        { kind: "claude-tokens", count: 50_000, when: T0 },
      ],
      T0
    );
    assert.equal(s.totals.prsMerged, 1);
    assert.equal(s.totals.reviews, 1);
    assert.equal(s.totals.claudeTokens, 50_000);
    // xp = 25 (pr) + 10 (review) + floor(50000/10000)=5 → 40
    assert.equal(s.xp, 40);
  });

  test("meters clamp at 100", () => {
    const s = base();
    s.hunger = 95;
    s.happiness = 95;
    applyFeeds(s, [{ kind: "commits", count: 50, when: T0 }], T0);
    assert.equal(s.hunger, 100);
    assert.ok(s.happiness <= 100);
  });

  test("feeding wakes a waiting dog and adds a joy burst", () => {
    const s = base();
    s.waiting = true;
    s.hunger = 10;
    s.happiness = 10;
    applyFeeds(s, [{ kind: "commits", count: 1, when: T0 }], T0);
    assert.equal(s.waiting, false);
    // +25 wake burst, then +2 from the commit
    assert.equal(s.happiness, 37);
    assert.equal(s.hunger, 16); // 10 + min(30, 6)
  });

  test("feeds land in the correct per-day bucket", () => {
    const s = base();
    const d1 = new Date("2026-06-02T09:00:00Z");
    const d2 = new Date("2026-06-03T09:00:00Z");
    const feeds: FeedEvent[] = [
      { kind: "commits", count: 2, when: d1 },
      { kind: "commits", count: 1, when: d2 },
    ];
    applyFeeds(s, feeds, d2);
    assert.equal(s.dailyLog["2026-06-02"].commits, 2);
    assert.equal(s.dailyLog["2026-06-03"].commits, 1);
  });
});

describe("moodFor", () => {
  const awake = new Date(2026, 5, 1, 12, 0, 0); // local noon
  const asleep = new Date(2026, 5, 1, 2, 0, 0); // local 2am

  test("waiting takes priority over everything", () => {
    const s = base();
    s.waiting = true;
    assert.equal(moodFor(s, awake), "waiting");
  });

  test("sleepy during sleep hours", () => {
    const s = base();
    s.hunger = 90;
    s.happiness = 90;
    assert.equal(moodFor(s, asleep), "sleepy");
  });

  test("hungry when food is low (while awake)", () => {
    const s = base();
    s.hunger = 20;
    s.happiness = 80;
    assert.equal(moodFor(s, awake), "hungry");
  });

  test("lonely when joy is low but food is okay", () => {
    const s = base();
    s.hunger = 80;
    s.happiness = 20;
    assert.equal(moodFor(s, awake), "lonely");
  });

  test("thriving when both meters are high", () => {
    const s = base();
    s.hunger = 90;
    s.happiness = 90;
    assert.equal(moodFor(s, awake), "thriving");
  });

  test("content in the middle", () => {
    const s = base();
    s.hunger = 55;
    s.happiness = 55;
    assert.equal(moodFor(s, awake), "content");
  });
});
