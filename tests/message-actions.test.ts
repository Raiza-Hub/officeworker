import { describe, expect, test } from "bun:test";
import * as bunTest from "bun:test";
import * as React from "react";

const { afterAll, afterEach, mock } = bunTest as unknown as {
  afterAll: (fn: () => void) => void;
  afterEach: (fn: () => void) => void;
  mock: {
    module: (path: string, factory: () => Record<string, unknown>) => void;
    restore: () => void;
  };
};

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const successMessages: string[] = [];
const errorMessages: string[] = [];

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    delete (globalThis as { navigator?: unknown }).navigator;
  }
  successMessages.length = 0;
  errorMessages.length = 0;
});

mock.module("sonner", () => ({
  toast: {
    success: (message: string) => {
      successMessages.push(message);
    },
    error: (message: string) => {
      errorMessages.push(message);
    },
  },
}));

mock.module("react", () => ({
  ...React,
  useEffect: () => {},
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => [
    typeof initial === "function" ? (initial as () => unknown)() : initial,
    () => {},
  ],
}));

const { MessageActions } = await import("../components/agent/message-actions");

afterAll(() => {
  mock.restore();
});

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  if (predicate(node)) return node;
  const children = node.props.children as React.ReactNode;
  return children ? findElement(children, predicate) : null;
}

describe("MessageActions", () => {
  test("copy action writes message text to clipboard", async () => {
    let copiedText = "";
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: async (text: string) => {
            copiedText = text;
          },
        },
      },
      configurable: true,
      writable: true,
    });

    const copyButton = findElement(
      MessageActions({ text: "message text" }),
      (element) =>
        element.type === "button" &&
        element.props["aria-label"] === "Copy message",
    );
    if (!copyButton) throw new Error("Expected copy button element");

    await (copyButton.props.onClick as () => void)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copiedText).toBe("message text");
  });

  test("copy action shows success toast", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: async () => undefined,
        },
      },
      configurable: true,
      writable: true,
    });

    const copyButton = findElement(
      MessageActions({ text: "message text" }),
      (element) =>
        element.type === "button" &&
        element.props["aria-label"] === "Copy message",
    );
    if (!copyButton) throw new Error("Expected copy button element");

    await (copyButton.props.onClick as () => void)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(successMessages).toEqual(["Copied to clipboard"]);
  });

  test("prompt actions use the prompt reveal group", () => {
    const actions = MessageActions({
      text: "message text",
      revealGroup: "prompt",
    }) as React.ReactElement<{ className?: string }>;
    const className = actions.props.className ?? "";
    expect(
      className.includes("group-hover/prompt:opacity-100") &&
        !className.includes("group-hover/message:opacity-100"),
    ).toBe(true);
  });

  test("edit action requests edit mode", () => {
    let editRequested = false;
    const editButton = findElement(
      MessageActions({
        text: "message text",
        onEdit: () => {
          editRequested = true;
        },
      }),
      (element) =>
        element.type === "button" &&
        element.props["aria-label"] === "Edit message",
    );
    if (!editButton) throw new Error("Expected edit button element");

    (editButton.props.onClick as () => void)();
    expect(editRequested).toBe(true);
  });
});
