import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { bar, renderStatusline, renderJournal, showStatus } from "../src/render";
import { newState, PetState, ensureDay } from "../src/state";
import { FACES } from "../src/sprites";

const T0 = new Date("2026-06-01T12:00:00Z");
const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

describe("bar", () => {
  test("full, empty, and half at width 10", () => {
    assert.equal(bar(100, 10), "▰".repeat(10));
    assert.equal(bar(0, 10), "▱".repeat(10));
    assert.equal(bar(50, 10), "▰".repeat(5) + "▱".repeat(5));
  });

  test("clamps out-of-range values", () => {
    assert.equal(bar(999, 10), "▰".repeat(10));
    assert.equal(bar(-50, 10), "▱".repeat(10));
  });

  test("respects a custom width", () => {
    assert.equal(bar(100, 5).length, 5);
    assert.equal(bar(0, 5), "▱".repeat(5));
  });
});

describe("renderStatusline", () => {
  test("is a single line with the dog, mood face, two meters and stage", () => {
    const s = newState("Byte", "me", T0);
    s.hunger = 80;
    s.happiness = 60;
    const line = renderStatusline(s, new Date(2026, 5, 1, 12, 0, 0));
    assert.ok(!line.includes("\n"));
    assert.ok(line.includes("🐶"));
    assert.ok(line.includes(FACES.thriving) || line.includes(FACES.content));
    assert.ok(line.includes("puppy"));
  });

  test("shows the waiting face when the dog is waiting", () => {
    const s = newState("Byte", "me", T0);
    s.waiting = true;
    const line = renderStatusline(s, new Date(2026, 5, 1, 12, 0, 0));
    assert.ok(line.includes(FACES.waiting));
  });
});

describe("renderJournal", () => {
  test("shows an empty-state message with no history", () => {
    const s = newState("Byte", "me", T0);
    const out = strip(renderJournal(s));
    assert.match(out, /empty/i);
  });

  test("lists the dog's name and recorded days", () => {
    const s = newState("Rex", "me", T0);
    ensureDay(s, "2026-06-02").commits = 5;
    ensureDay(s, "2026-06-03").prsMerged = 1;
    const out = strip(renderJournal(s));
    assert.match(out, /Rex's journal/);
    assert.ok(out.includes("2026-06-02"));
    assert.ok(out.includes("2026-06-03"));
  });
});

describe("showStatus animation controller", () => {
  const origWrite = process.stdout.write.bind(process.stdout);
  const origIsTTY = process.stdout.isTTY;

  afterEach(() => {
    (process.stdout as any).isTTY = origIsTTY;
    process.stdout.write = origWrite;
    delete process.env.WOOF_MAX_FRAMES;
  });

  function capture(): { chunks: string[]; restore: () => void } {
    const chunks: string[] = [];
    (process.stdout as any).isTTY = true;
    (process.stdout as any).write = (c: any) => {
      chunks.push(String(c));
      return true;
    };
    return { chunks, restore: () => (process.stdout.write = origWrite) };
  }

  function thrivingState(): PetState {
    const s = newState("Byte", "me", T0);
    s.hunger = 90;
    s.happiness = 90;
    return s;
  }

  test("loop mode stops at WOOF_MAX_FRAMES instead of hanging", async () => {
    process.env.WOOF_MAX_FRAMES = "3";
    const { chunks, restore } = capture();
    const noonAwake = new Date(2026, 5, 1, 12, 0, 0);
    await showStatus(thrivingState(), noonAwake, { loop: true });
    restore();
    const all = chunks.join("");
    assert.ok(all.includes("\x1b[?25l"), "should hide the cursor");
    assert.ok(all.includes("\x1b[?25h"), "should restore the cursor");
    // Multiple redraws → at least one cursor-up move.
    assert.match(all, /\x1b\[\d+A/);
  });

  test("non-TTY output prints a single static frame and returns", async () => {
    const chunks: string[] = [];
    (process.stdout as any).isTTY = false;
    (process.stdout as any).write = (c: any) => {
      chunks.push(String(c));
      return true;
    };
    await showStatus(thrivingState(), new Date(2026, 5, 1, 12, 0, 0), { loop: true });
    process.stdout.write = origWrite;
    const all = chunks.join("");
    assert.ok(!all.includes("\x1b[?25l"), "should not hide cursor when not a TTY");
    assert.match(strip(all), /Byte the puppy/);
  });

  test("one-shot mode (feed) plays the sequence and restores the cursor", async () => {
    const { chunks, restore } = capture();
    await showStatus(thrivingState(), new Date(2026, 5, 1, 12, 0, 0), { loop: false });
    restore();
    const all = chunks.join("");
    assert.ok(all.includes("\x1b[?25h"), "cursor restored after one-shot");
  });
});
