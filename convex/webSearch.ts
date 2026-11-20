import { v } from "convex/values";
import { internalAction } from "./_generated/server";

type SearchHit = {
  title: string;
  url: string;
  excerpt: string;
};

const MAX_RESULT_CHARS = 6000;

// web_search: Parallel Search API (mode fixed to "fast" — ~700ms, built for
// interactive tool-calling loops). Natural-language objective + up to 3
// keyword queries → LLM-optimized excerpts.
export const searchAction = internalAction({
  args: {
    objective: v.string(),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args): Promise<string> => {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) {
      return "Web search is not configured (missing PARALLEL_API_KEY).";
    }

    const searchQueries = (args.keywords ?? []).slice(0, 3);
    let response: Response;
    try {
      response = await fetch("https://api.parallel.ai/v1/search", {
        method: "POST",
        headers: {
          "parallel-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objective: args.objective,
          ...(searchQueries.length > 0 ? { search_queries: searchQueries } : {}),
          mode: "fast",
        }),
      });
    } catch (error) {
      return `Web search request failed: ${error instanceof Error ? error.message : "network error"}`;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return `Web search failed (${response.status}): ${detail.slice(0, 300)}`;
    }

    const payload = (await response.json().catch(() => null)) as {
      results?: Array<{
        title?: string;
        url?: string;
        excerpts?: string[];
        publish_date?: string | null;
      }>;
    } | null;
    const results = payload?.results ?? [];
    if (results.length === 0) {
      return "No web results found for that objective. Try a different objective or keywords.";
    }

    const hits: SearchHit[] = results.map((result) => ({
      title: result.title ?? "(untitled)",
      url: result.url ?? "",
      excerpt: (result.excerpts ?? []).join(" "),
    }));

    let text = hits
      .map(
        (hit, index) =>
          `${index + 1}. ${hit.title}\n   ${hit.url}\n   ${hit.excerpt}`,
      )
      .join("\n\n");
    if (text.length > MAX_RESULT_CHARS) {
      text =
        text.slice(0, MAX_RESULT_CHARS) +
        "\n\n[Truncated — refine the objective or use narrower keywords for more focused results.]";
    }
    return text;
  },
});
