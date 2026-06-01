import { generateJsonWithOpenRouter } from "../openrouter";

export async function POST(request) {
  try {
    const body = await request.json();
    const content = String(body.content || "").trim();

    if (!content) {
      return Response.json({ error: "Content is required" }, { status: 400 });
    }

    const fallback = {
      short: `${content.substring(0, 50)}... The future is here with Socialoraa. 🚀`,
      long: `${content}\n\nThis is just the tip of the iceberg. Socialoraa helps you automate the entire process, from ideation to scheduling. Don't let manual tasks slow you down in 2026. Join the revolution! 📈`,
      seo: `Learn how to master ${content.substring(0, 20)} using AI automation. Best guide for content creators and SaaS founders.`,
      hashtags:
        "#ContentWriter #AI #Socialoraa #Automation #Growth #Marketing2026",
    };

    const results = await generateJsonWithOpenRouter({
      fallback,
      system:
        "You are an expert content editor and SEO copywriter. Rewrite rough content into concise, useful, platform-safe marketing copy.",
      prompt: `Create descriptions and hashtags from this content:

${content}

Rules:
- Preserve the meaning of the original content.
- Do not add fake claims, numbers, offers, or links.
- Make the short version social-ready.
- Make the SEO version searchable but natural.
- Keep hashtags relevant to the actual content.

Return this exact JSON shape:
{
  "short": "Short social description",
  "long": "Long detailed description",
  "seo": "SEO-friendly description",
  "hashtags": "#TagOne #TagTwo #TagThree"
}`,
    });

    return Response.json({ results });
  } catch (error) {
    console.error("AI Description Error:", error);
    return Response.json(
      { error: "Failed to generate description" },
      { status: 500 },
    );
  }
}
