import { describe, expect, test } from "bun:test";
import * as bunTest from "bun:test";
import {
  hasRevealedPreviewImageUrl,
  markRevealedPreviewImageUrl,
  releaseRevealedPreviewImageUrl,
} from "../lib/file-thumbnail-store";

const { beforeEach } = bunTest as unknown as {
  beforeEach: (fn: () => void) => void;
};

describe("revealed preview image url store", () => {
  beforeEach(() => {
    for (let index = 0; index < 256; index += 1) {
      releaseRevealedPreviewImageUrl(`seed:${index}`);
    }
  });

  test("release removes a reveal only after every owner releases it", () => {
    markRevealedPreviewImageUrl("shared");
    markRevealedPreviewImageUrl("shared");
    releaseRevealedPreviewImageUrl("shared");
    expect(hasRevealedPreviewImageUrl("shared")).toBe(true);
    releaseRevealedPreviewImageUrl("shared");
    expect(hasRevealedPreviewImageUrl("shared")).toBe(false);
  });

  test("the store stays bounded to the most recent reveals", () => {
    for (let index = 0; index < 300; index += 1) {
      markRevealedPreviewImageUrl(`url:${index}`);
    }
    expect(hasRevealedPreviewImageUrl("url:0")).toBe(false);
    expect(hasRevealedPreviewImageUrl("url:299")).toBe(true);
  });
});
