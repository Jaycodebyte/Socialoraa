const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1] || trimmed;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI response did not contain JSON.");
  }

  return JSON.parse(jsonText.slice(start, end + 1));
}

export async function generateJsonWithOpenRouter({ system, prompt, fallback }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  if (!apiKey) return fallback;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Socialoraa",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${system}\nReturn valid JSON only. Do not include markdown fences.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
        max_tokens: 1400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenRouter returned an empty response.");

    return extractJson(text);
  } catch (error) {
    console.error("OpenRouter generation fallback:", error);
    return fallback;
  }
}

export async function generateJsonCandidatesWithOpenRouter({
  system,
  prompt,
  fallback,
  attempts = 2,
}) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await generateJsonWithOpenRouter({
      system,
      prompt:
        index === 0
          ? prompt
          : `${prompt}\n\nThe previous response was not acceptable. Be more specific, factual, and directly answer the user's prompt.`,
      fallback: null,
    });

    if (result) return result;
  }

  return fallback;
}
