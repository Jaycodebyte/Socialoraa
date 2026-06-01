import { searchWeb } from "../webSearch";

export async function POST(request) {
  try {
    const body = await request.json();
    const query = String(body.query || "").trim();
    const maxResults = Number(body.maxResults || 5);

    const result = await searchWeb(query, {
      maxResults: Number.isFinite(maxResults) ? Math.min(Math.max(maxResults, 1), 8) : 5,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to search the web." },
      { status: 400 },
    );
  }
}
