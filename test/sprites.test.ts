import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  petFrames,
  renderGrid,
  MOOD_SEQUENCE,
  FACES,
  debugGrids,
  BOX_GRID,
  boxFrames,
  BOX_SEQUENCE,
} from "../src/sprites";
import { Mood } from "../src/sim";

const MOODS: Mood[] = ["thriving", "content", "hungry", "lonely", "sleepy", "waiting"];
const STAGE_NAMES = ["puppy", "good dog", "best friend", "old faithful"];

describe("FACES", () => {
  test("every mood has a face", () => {
    for (const m of MOODS) assert.ok(FACES[m], `missing face for ${m}`);
  });
});

describe("petFrames", () => {
  test("returns at least one frame for every stage/mood combo", () => {
    for (const stage of STAGE_NAMES) {
      for (const m of MOODS) {
        const frames = petFrames(stage, m);
        assert.ok(frames.length >= 1, `${stage}/${m} had no frames`);
      }
    }
  });

  test("all frames for a given stage/mood share the same height", () => {
    for (const stage of STAGE_NAMES) {
      for (const m of MOODS) {
        const frames = petFrames(stage, m);
        const heights = new Set(frames.map((f) => f.length));
        assert.equal(heights.size, 1, `${stage}/${m} has ragged frame heights`);
      }
    }
  });

  test("every mood animates with at least two frames", () => {
    for (const m of MOODS) {
      assert.ok(petFrames("good dog", m).length >= 2, `${m} should animate`);
    }
  });

  test("the sleeping dog shows a drifting 'z' bubble", () => {
    const frames = petFrames("good dog", "sleepy");
    assert.equal(frames.length, 2);
    // The two frames differ (the z moves), so the animation isn't frozen.
    assert.notEqual(frames[0].join("\n"), frames[1].join("\n"));
  });

  test("unknown stage falls back to the puppy sprite", () => {
    const unknown = petFrames("labradoodle", "content");
    const puppy = petFrames("puppy", "content");
    assert.equal(unknown[0].length, puppy[0].length);
  });
});

describe("MOOD_SEQUENCE integrity", () => {
  test("every sequence index refers to an existing frame", () => {
    // This is the guard against the animation loop indexing a missing frame.
    for (const m of MOODS) {
      const frames = petFrames("good dog", m);
      for (const idx of MOOD_SEQUENCE[m]) {
        assert.ok(idx >= 0 && idx < frames.length, `${m}: index ${idx} out of range`);
      }
    }
  });

  test("every mood has a sequence starting on the resting frame", () => {
    for (const m of MOODS) {
      assert.ok(MOOD_SEQUENCE[m].length >= 1);
      assert.equal(MOOD_SEQUENCE[m][0], 0);
    }
  });
});

describe("renderGrid", () => {
  test("collapses two pixel rows into one terminal line", () => {
    const out = renderGrid(["ab", "cd", "ef"], "");
    assert.equal(out.length, 2); // 3 rows → ceil(3/2)
  });

  test("emits ANSI resets and honors the indent", () => {
    const out = renderGrid(["oo"], ">>");
    assert.ok(out[0].startsWith(">>"));
    assert.ok(out[0].includes("\x1b[0m"));
  });

  test("transparent pixels render as spaces", () => {
    const out = renderGrid([".."], "");
    // strip ANSI; nothing was drawn, so only spaces remain
    assert.equal(out[0].replace(/\x1b\[[0-9;]*m/g, ""), "  ");
  });
});

describe("debugGrids", () => {
  test("covers every stage and mood", () => {
    const grids = debugGrids();
    assert.ok(grids.length > 0);
    for (const stage of STAGE_NAMES) {
      assert.ok(grids.some((g) => g.label.startsWith(stage)), `no debug grid for ${stage}`);
    }
  });

  test("old faithful has a greyed muzzle (grey pixels present)", () => {
    const grids = debugGrids().filter((g) => g.label.startsWith("old faithful"));
    assert.ok(grids.length > 0);
    assert.ok(
      grids.some((g) => g.grid.some((row) => row.includes("g"))),
      "expected grey ('g') pixels in old faithful"
    );
  });
});

describe("BOX_GRID", () => {
  test("is a non-empty rectangle of rows", () => {
    assert.ok(BOX_GRID.length > 0);
    assert.ok(BOX_GRID.every((r) => typeof r === "string" && r.length > 0));
  });
});

describe("boxFrames (adoption animation)", () => {
  test("has three frames with the eyes in different positions", () => {
    const frames = boxFrames();
    assert.equal(frames.length, 3);
    const raw = frames.map((f) => f.join("\n"));
    assert.equal(new Set(raw).size, 3, "all three eye positions should differ");
  });

  test("every frame is the same height", () => {
    const heights = new Set(boxFrames().map((f) => f.length));
    assert.equal(heights.size, 1);
  });

  test("BOX_SEQUENCE only references existing frames", () => {
    for (const idx of BOX_SEQUENCE) assert.ok(idx >= 0 && idx < 3);
  });
});
