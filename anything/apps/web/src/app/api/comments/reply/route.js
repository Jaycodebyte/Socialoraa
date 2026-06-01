import { generateJsonWithOpenRouter } from "../../ai/openrouter";

const extractMentionedNames = (text) => {
  const ignored = new Set([
    "i",
    "me",
    "my",
    "you",
    "your",
    "for",
    "reason",
    "greater",
    "really",
    "definitely",
    "getting",
    "noticed",
    "thanks",
    "comment",
    "on",
    "fire",
    "cool",
    "nice",
    "best",
    "good",
    "great",
    "amazing",
    "cricket",
  ]);

  const words =
    String(text || "").match(/\b[A-Za-z][A-Za-z]{2,}\b/g)?.filter((word) => {
      const lower = word.toLowerCase();
      return !ignored.has(lower) && lower.length <= 24;
    }) || [];

  return [...new Set(words)];
};

export async function POST(request) {
  try {
    const body = await request.json();
    const commentText = String(body.commentText || "").trim();
    const postContext = String(body.postContext || "the creator's recent social media post").trim();
    const brandStyle = String(body.brandStyle || "Professional").trim();

    if (!commentText) {
      return Response.json({ error: "Comment text is required." }, { status: 400 });
    }

    const fallback = {
      reply: `Thanks for commenting. Really appreciate you sharing this, and I am glad the post connected with you.`,
    };
    const mentionedNames = extractMentionedNames(commentText);

    const result = await generateJsonWithOpenRouter({
      fallback,
      system:
        "You write natural social media comment replies for a creator. The user's comment is the source of truth. Keep replies short, human, safe, and specific to the comment.",
      prompt: `Write one creator-style reply.

Comment:
${commentText}

Post context:
${postContext}

Brand style:
${brandStyle}

Rules:
- Reply to the exact comment first. Do not replace a name from the comment with a different name from the post context.
- If the comment mentions a person, repeat or acknowledge that same person.
- If the comment asks a question, answer directly.
- If it is positive, acknowledge warmly.
- If it is critical, stay calm and helpful.
- If it is spam, abusive, or meaningless, keep it brief and neutral.
- Do not mention AI.
${mentionedNames.length ? `- The comment mentions: ${mentionedNames.join(", ")}. Do not change these names.` : ""}

Return this exact JSON shape:
{
  "reply": "Reply text"
}`,
    });

    let reply = String(result.reply || fallback.reply);
    const lowerReply = reply.toLowerCase();
    const missingName = mentionedNames.find(
      (name) => !lowerReply.includes(name.toLowerCase()),
    );

    if (missingName) {
      reply = `${missingName} is definitely getting noticed. Thanks for the comment!`;
    }

    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to generate reply." },
      { status: 400 },
    );
  }
}
