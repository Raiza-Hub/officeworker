import { describe, expect, test } from "bun:test";
import { AlertCircle, Pencil } from "lucide-react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BillingNotice,
  billingNoticeForError,
} from "../components/agent/billing-notice";

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (predicate(node)) return node;
  const children = node.props.children as ReactNode;
  return children ? findElement(children, predicate) : null;
}

describe("billingNoticeForError", () => {
  test("maps billing error codes and ignores unrelated values", () => {
    expect(
      billingNoticeForError({ code: "WALLET_EMPTY", context: "start" }),
    ).toEqual({
      code: "WALLET_EMPTY",
      message: "You’re out of credits. Add credits to start a chat.",
      actionLabel: "Add credits",
      href: "/billing",
    });
    expect(
      billingNoticeForError({ code: "INSUFFICIENT_CREDITS" }),
    ).toEqual({
      code: "INSUFFICIENT_CREDITS",
      message:
        "You don’t have enough credits to complete this request. Add more credits to continue.",
      actionLabel: "Add credits",
      href: "/billing",
    });
    expect(
      billingNoticeForError({ code: "PLAN_UPGRADE_REQUIRED" }),
    ).toEqual({
      code: "PLAN_UPGRADE_REQUIRED",
      message:
        "This action requires the Pro plan. Upgrade to Pro to continue.",
      actionLabel: "Upgrade plan",
      href: "/billing",
    });
    expect(billingNoticeForError({ code: "OTHER" })).toBeNull();
    expect(billingNoticeForError(null)).toBeNull();
  });
});

describe("BillingNotice", () => {
  test("renders message, action link, and dismiss button with matching text size", () => {
    const notice = billingNoticeForError({
      code: "WALLET_EMPTY",
      context: "continue",
    });
    if (!notice) throw new Error("Expected WALLET_EMPTY notice");

    let dismissed = false;
    const html = renderToStaticMarkup(
      BillingNotice({
        notice,
        onDismiss: () => {
          dismissed = true;
        },
      }),
    );

    expect(html.includes('role="alert"')).toBe(true);
    expect(html.includes(notice.message)).toBe(true);
    expect(html.includes('href="/billing"')).toBe(true);
    expect(html.includes("text-[12.5px]")).toBe(true);
    expect(html.includes('aria-label="Dismiss billing notice"')).toBe(true);

    const tree = BillingNotice({
      notice,
      onDismiss: () => {
        dismissed = true;
      },
    });
    const dismissButton = findElement(
      tree,
      (el) =>
        el.type === "button" &&
        el.props["aria-label"] === "Dismiss billing notice",
    );
    if (!dismissButton) throw new Error("Expected dismiss button element");
    (dismissButton.props.onClick as () => void)();
    expect(dismissed).toBe(true);
  });

  test("omits dismiss button when onDismiss is not provided", () => {
    const notice = billingNoticeForError({ code: "INSUFFICIENT_CREDITS" });
    if (!notice) throw new Error("Expected INSUFFICIENT_CREDITS notice");

    const html = renderToStaticMarkup(BillingNotice({ notice }));
    expect(html.includes('aria-label="Dismiss billing notice"')).toBe(false);
  });

  test("edit banner displays editing message", () => {
    const html = renderToStaticMarkup(
      BillingNotice({ notice: { code: "EDITING", message: "Editing message" } }),
    );
    expect(html.includes("Editing message")).toBe(true);
  });

  test("edit banner uses pencil icon instead of alert icon", () => {
    const tree = BillingNotice({
      notice: { code: "EDITING", message: "Editing message" },
    });
    expect(findElement(tree, (element) => element.type === Pencil) !== null).toBe(
      true,
    );
    expect(findElement(tree, (element) => element.type === AlertCircle) === null).toBe(
      true,
    );
  });

  test("edit banner X cancels editing", () => {
    let dismissed = false;
    const tree = BillingNotice({
      notice: { code: "EDITING", message: "Editing message" },
      onDismiss: () => {
        dismissed = true;
      },
      dismissLabel: "Cancel editing",
    });
    const dismissButton = findElement(
      tree,
      (element) =>
        element.type === "button" &&
        element.props["aria-label"] === "Cancel editing",
    );
    if (!dismissButton) throw new Error("Expected cancel edit button element");

    (dismissButton.props.onClick as () => void)();
    expect(dismissed).toBe(true);
  });
});
