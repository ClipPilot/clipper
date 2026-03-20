import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
}

export const webSearchTool = createTool({
  id: "web-search",
  description:
    "Search the web for UGC trends, script styles, vocabulary, and content formats relevant to a target audience or video style",
  inputSchema: z.object({
    query: z.string().describe("Search query for finding relevant trends, styles, or formats"),
    maxResults: z.number().optional().default(5).describe("Maximum number of results to return"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      }),
    ),
  }),
  execute: async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { results: [] };
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults ?? 5,
        search_depth: "basic",
      }),
    });

    if (!response.ok) {
      console.error(`[web-search] Tavily API error: ${response.status}`);
      return { results: [] };
    }

    const data = (await response.json()) as TavilyResponse;

    return {
      results: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  },
});
