"use client";

import { useQueries } from "convex-helpers/react/cache";
import { useEffect, useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type MessagePage = FunctionReturnType<typeof api.chat.listThreadMessagesPage>;
export type CachedThreadMessage = MessagePage["page"][number];

/** Loads stable cursor pages through Convex Helpers' five-minute query cache. */
export function useCachedThreadMessages({
  threadId,
  cacheScope,
}: {
  threadId: string;
  cacheScope: string | undefined;
}) {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const queries = useMemo(
    () =>
      cacheScope
        ? Object.fromEntries(
            cursors.map((cursor, index) => [
              `page${index}`,
              {
                query: api.chat.listThreadMessagesPage,
                args: { threadId, cacheScope, cursor },
              },
            ]),
          )
        : {},
    [cacheScope, cursors, threadId],
  );
  const pages = useQueries(queries);
  const pageCount = cursors.length;
  const lastPage = pages[`page${pageCount - 1}`] as
    | MessagePage
    | Error
    | undefined;

  useEffect(() => {
    if (
      !lastPage ||
      lastPage instanceof Error ||
      lastPage.isDone ||
      !lastPage.continueCursor ||
      cursors.includes(lastPage.continueCursor)
    ) {
      return;
    }
    const nextCursor = lastPage.continueCursor;
    const timer = window.setTimeout(() => {
      setCursors((current) =>
        current.includes(nextCursor) ? current : [...current, nextCursor],
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cursors, lastPage]);

  const messages = useMemo(() => {
    const accumulated: CachedThreadMessage[] = [];
    for (let index = 0; index < pageCount; index += 1) {
      const page = pages[`page${index}`] as MessagePage | Error | undefined;
      if (page instanceof Error) throw page;
      if (page) accumulated.push(...page.page);
    }
    return accumulated;
  }, [pageCount, pages]);

  return { messages, isLoading: pages.page0 === undefined };
}
