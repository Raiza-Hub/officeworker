import { describe, expect, test } from "bun:test";
import { visibleObjectUrl } from "../hooks/use-object-url";

describe("visibleObjectUrl", () => {
  test("returns null while showing the previous blob's url", () => {
    const previousBlob = new Blob(["previous"]);
    const nextBlob = new Blob(["next"]);
    expect(
      visibleObjectUrl({ blob: previousBlob, url: "blob:previous" }, nextBlob),
    ).toBeNull();
  });

  test("returns null when no blob is selected", () => {
    const blob = new Blob(["previous"]);
    expect(visibleObjectUrl({ blob, url: "blob:previous" }, null)).toBeNull();
  });

  test("returns the url bound to the current blob", () => {
    const blob = new Blob(["current"]);
    expect(visibleObjectUrl({ blob, url: "blob:current" }, blob)).toBe(
      "blob:current",
    );
  });
});
