import { generateJsonWithOpenRouter } from "../openrouter";
import { searchWeb } from "../../search/webSearch";

const parseDurationSeconds = (value) => {
  const raw = String(value || "60").trim().toLowerCase();
  const number = Number.parseFloat(raw);

  if (!Number.isFinite(number) || number <= 0) return 60;
  if (raw.includes("hour")) return Math.min(Math.round(number * 3600), 3600);
  if (raw.includes("min")) return Math.min(Math.round(number * 60), 3600);
  return Math.min(Math.round(number), 3600);
};

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const getDurationGuidance = (seconds) => {
  if (seconds <= 60) {
    return {
      words: "90-150 words",
      structure:
        "short-form structure: 1 hook, 1 quick setup, 3-4 punchy beats, 1 fast CTA",
    };
  }

  if (seconds <= 300) {
    return {
      words: "650-850 words",
      structure:
        "5-minute structure: strong opening, clear setup, 4-6 story or teaching beats, emotional midpoint, payoff, CTA",
    };
  }

  return {
    words: "detailed long-form outline with enough narration for the selected duration",
    structure:
      "long-form structure: chaptered sections with timestamps, deeper examples, transitions, retention hooks, recap, CTA",
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = String(body.topic || "").trim();
    const language = body.language || "English";
    const style = body.style || "Professional";
    const useWebSearch = Boolean(body.useWebSearch);
    const durationSeconds = parseDurationSeconds(body.durationSeconds);
    const durationGuidance = getDurationGuidance(durationSeconds);

    if (!topic) {
      return Response.json({ error: "Topic is required" }, { status: 400 });
    }

    const webContext = useWebSearch ? await searchWeb(topic, { maxResults: 5 }) : null;

    const fallback = {
      title: `${topic}: Short-Form Video Script`,
      hook: `Here is the one thing most people miss about ${topic}.`,
      intro: `In this short video, we will break down ${topic} in a simple, useful way so viewers understand the idea fast.`,
      main: `1. Start with the real problem behind ${topic}.\n2. Explain the key insight in plain language.\n3. Give one practical example viewers can remember.\n4. End with a clear takeaway they can apply today.`,
      outro: `That is the simple way to think about ${topic}.`,
      cta: `Follow for more practical breakdowns and comment what topic you want next.`,
      thumbnails: [
        `${topic} Explained Fast`,
        `The Truth About ${topic}`,
        `${topic}: What Nobody Tells You`,
      ],
    };

    const script = await generateJsonWithOpenRouter({
      fallback,
      system:
        "You are a senior short-form video scriptwriter. Write scripts that are specific, natural, retention-focused, and easy to perform on camera.",
      prompt: `Create a video script about "${topic}".

Language: ${language}
Style: ${style}
Target duration: ${formatDuration(durationSeconds)}
Target script length: ${durationGuidance.words}
Required structure: ${durationGuidance.structure}

Language rules:
- English: write clear English only.
- Hindi: write Hindi in Devanagari script.
- Hinglish: write natural Indian Hinglish using Hindi words in Latin script mixed with English.
- If language is Hinglish, do not write pure English.
- If language is Hindi, do not write Hinglish.

Rules:
- Keep the hook strong but truthful.
- Do not invent facts, names, or statistics.
- Make the main section useful, not generic filler.
- Write for Reels, Shorts, and YouTube Shorts.
- Match the selected target duration. A 30-second script must be tight. A 5-minute script must have enough story/detail for about 5 minutes. A long-form script must be chaptered and detailed.
- For scripts longer than 3 minutes, include timestamp-style section labels inside the main body.
- Do not make a 5-minute or 30-minute script as short as a Shorts script.
${webContext ? `- Use the live web context below for current facts and do not invent unsupported details.

Live web context:
Search answer:
${webContext.answer}

Sources:
${webContext.sources
  .map((source, index) => `${index + 1}. ${source.title}\n${source.url}\n${source.content}`)
  .join("\n\n")}` : ""}

Return this exact JSON shape:
{
  "title": "Video title",
  "hook": "0-3 second hook",
  "intro": "Intro narration",
  "main": "Main script body with steps",
  "outro": "Closing narration",
  "cta": "Call to action",
  "thumbnails": ["Thumbnail idea 1", "Thumbnail idea 2", "Thumbnail idea 3"]
}`,
    });

    return Response.json({ script, sources: webContext?.sources || [] });
  } catch (error) {
    console.error("AI Script Error:", error);
    return Response.json(
      { error: "Failed to generate script" },
      { status: 500 },
    );
  }
}
