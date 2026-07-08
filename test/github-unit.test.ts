import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fetchGithubEvents } from "../src/collectors/github";
import { newState } from "../src/state";

describe("fetchGithubEvents", () => {
  test("returns nothing (and does not shell out) when there is no login", async () => {
    const s = newState("Byte", null, new Date("2026-06-01T12:00:00Z"));
    const feeds = await fetchGithubEvents(s);
    assert.deepEqual(feeds, []);
  });
});
