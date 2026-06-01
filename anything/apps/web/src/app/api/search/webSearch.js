const normalizeResult = (result) => ({
  title: String(result.title || result.url || "Web result"),
  url: String(result.url || ""),
  content: String(result.content || result.snippet || "").slice(0, 700),
  score: typeof result.score === "number" ? result.score : null,
});

export async function searchWeb(query, options = {}) {
  const cleanQuery = String(query || "").trim();
  const apiKey = process.env.TAVILY_API_KEY || process.env.WEB_SEARCH_API_KEY;

  if (!cleanQuery) {
    throw new Error("Search query is required.");
  }

  if (!apiKey) {
    throw new Error("Add TAVILY_API_KEY or WEB_SEARCH_API_KEY to enable live web search.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: cleanQuery,
      search_depth: options.depth || "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: options.maxResults || 5,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Live web search failed.");
  }

  return {
    query: cleanQuery,
    answer: String(data.answer || ""),
    sources: (data.results || []).map(normalizeResult).filter((item) => item.url),
  };
}
