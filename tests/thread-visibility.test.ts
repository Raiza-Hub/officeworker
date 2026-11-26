import { describe, expect, test } from "bun:test";
import { visibleThreadResults } from "../components/agent/thread-helpers";

const results = [
  { id: "before-user", order: 0, stepOrder: 0 },
  { id: "before-assistant", order: 0, stepOrder: 0 },
  { id: "edited-user", order: 1, stepOrder: 0 },
  { id: "edited-assistant", order: 1, stepOrder: 0 },
  { id: "edited-step", order: 1, stepOrder: 1 },
  { id: "later-user", order: 2, stepOrder: 0 },
];

describe("visibleThreadResults", () => {
  test("hides the edited turn and later turns while editing", () => {
    expect(visibleThreadResults(results, { order: 1 }).map((m) => m.id)).toEqual([
      "before-user",
      "before-assistant",
    ]);
  });

  test("shows all turns when not editing", () => {
    expect(visibleThreadResults(results, null)).toEqual(results);
  });
});
