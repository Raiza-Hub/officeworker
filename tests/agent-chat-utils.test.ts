import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  createOptimisticTempId,
  messageFromError,
} from "../components/agent/agent-chat-utils";

describe("agent chat utils", () => {
  test("messageFromError reads the message from a ConvexError", () => {
    expect(
      messageFromError(new ConvexError({ message: "No credits" }), "fallback"),
    ).toBe("No credits");
  });

  test("messageFromError uses the fallback for unknown values", () => {
    expect(messageFromError("bad value", "fallback")).toBe("fallback");
  });

  test("createOptimisticTempId returns a prefixed id", () => {
    expect(createOptimisticTempId().startsWith("optimistic-")).toBe(true);
  });
});
