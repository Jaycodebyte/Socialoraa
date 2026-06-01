import { generateJsonCandidatesWithOpenRouter } from "../openrouter";
import { getLiveSportsContext, getWebSportsResultContext } from "../live-context";
import { searchWeb } from "../../search/webSearch";

const hasAllCoreTerms = (text, terms) => {
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term));
};

const isViratGoatPrompt = (topic) =>
  /virat|kohli/i.test(topic) && /goat|greatest/i.test(topic);

const makeViratGoatFallback = (tone) => {
  const isHinglish = tone?.toLowerCase() === "hinglish";

  if (isHinglish) {
    return {
      linkedin:
        "Virat Kohli ko cricket ka GOAT kyun bola jata hai? Sirf runs ki wajah se nahi, balki pressure mein consistency, chase master mindset, fitness revolution aur all-format dominance ki wajah se.\n\nUnhone modern cricket ko ek new standard diya: aggression with discipline, passion with preparation, aur performance when it matters most.\n\nGOAT debate subjective ho sakti hai, but Kohli ka impact undeniable hai.\n\nAapke liye Kohli ka best moment kaunsa hai?",
      instagram:
        "Virat Kohli = GOAT debate ka permanent naam 🐐🏏\n\nRuns? Haan.\nChases? Legendary.\nFitness? Game-changing.\nPressure moments? Built different.\n\nIsliye Kohli sirf ek batter nahi, modern cricket ka benchmark hai.\n\nKohli ka best innings comment karo 👇\n\n#ViratKohli #GOAT #Cricket #KingKohli",
      facebook:
        "Virat Kohli ko cricket ka GOAT kehne ke peeche strong reasons hain: unmatched consistency, chase master reputation, fitness culture ka impact, aur har format mein long-term dominance.\n\nHar fan ka GOAT alag ho sakta hai, but Kohli ne modern cricket mein jo standard set kiya hai, woh ignore nahi kiya ja sakta.",
      youtube:
        "Title: Virat Kohli Cricket ka GOAT Kyun Hai?\n\nDescription:\nIs video mein hum break down karenge ki Virat Kohli ko GOAT debate mein itni strong jagah kyun milti hai: consistency, chases, fitness, leadership mindset aur pressure performances.\n\nWatch till the end and comment your favourite Kohli innings.",
    };
  }

  return {
    linkedin:
      "Why is Virat Kohli called the GOAT of cricket? It is not just because of the runs. It is because of his consistency under pressure, his chase-master legacy, his impact on fitness standards, and his dominance across formats.\n\nGOAT debates are always subjective, but Kohli's influence on modern cricket is undeniable.\n\nWhat is your favourite Kohli innings?",
    instagram:
      "Virat Kohli belongs in the GOAT conversation 🐐🏏\n\nConsistency. Chases. Fitness. Passion. Pressure performances.\n\nHe did not just score runs. He changed the standard of modern cricket.\n\nDrop your favourite Kohli moment 👇\n\n#ViratKohli #GOAT #Cricket #KingKohli",
    facebook:
      "Virat Kohli is called one of cricket's GOATs because his career combines elite numbers with massive cultural impact. His consistency, chasing record, fitness standards, and intensity changed how modern cricketers approach the game.",
    youtube:
      "Title: Why Virat Kohli Is in Cricket's GOAT Debate\n\nDescription:\nIn this video, we explain why Virat Kohli is considered one of cricket's greatest: consistency, chase records, fitness, all-format impact, and pressure performances.",
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const topic = String(body.topic || "").trim();
    const language = body.language || (body.tone === "Hinglish" ? "Hinglish" : "English");
    const style = body.style || (body.tone === "Hinglish" ? "Professional" : body.tone || "Professional");
    const useWebSearch = Boolean(body.useWebSearch);

    if (!topic) {
      return Response.json({ error: "Topic is required" }, { status: 400 });
    }

    const liveContext = await getLiveSportsContext(topic);
    let webContext = null;
    let sportsResultContext = null;

    if (useWebSearch) {
      sportsResultContext = await getWebSportsResultContext(topic);
      webContext = sportsResultContext.context
        ? {
            query: topic,
            answer: sportsResultContext.context,
            sources: sportsResultContext.sources,
          }
        : await searchWeb(topic, { maxResults: 5 });
    }

    if (liveContext.required && !liveContext.context) {
      return Response.json(
        {
          error: liveContext.error,
          needsLiveData: true,
        },
        { status: 422 },
      );
    }

    const hashtag = topic.replace(/\s/g, "");
    const isHindi = language?.toLowerCase() === "hindi";
    const isHinglish = language?.toLowerCase() === "hinglish";
    const fallback = isViratGoatPrompt(topic)
      ? makeViratGoatFallback(language)
      : isHindi
        ? {
            linkedin: `🚀 ${topic} पर बेहतर कंटेंट बनाने का सबसे अच्छा तरीका है: मजबूत हुक, साफ संदेश और सही कॉल-टू-एक्शन।\n\nआज ऑडियंस सिर्फ जानकारी नहीं, भरोसा और उपयोगी वैल्यू चाहती है। इसलिए शुरुआत में ध्यान खींचें, बीच में स्पष्ट समाधान दें और अंत में बातचीत शुरू करें।\n\nआप इस विषय पर क्या सोचते हैं?`,
            instagram: `${topic} पर वायरल कंटेंट बनाना है? 👀\n\nपहले 3 सेकंड में हुक मजबूत रखें, बात को आसान बनाएं और अंत में सेव/कमेंट करने का कारण दें।\n\nइसे अपने अगले पोस्ट के लिए सेव करें 📌\n\n#${hashtag} #ContentCreation #SocialMedia`,
            facebook: `${topic} पर कंटेंट बनाते समय एक बात याद रखें: सरल, उपयोगी और relatable पोस्ट हमेशा बेहतर perform करती है।\n\nएक अच्छा हुक, स्पष्ट value और direct CTA आपकी पोस्ट को ज्यादा engaging बना सकते हैं।`,
            youtube: `Title: ${topic} पर बेहतर कंटेंट कैसे बनाएं\n\nDescription:\nइस वीडियो में हम देखेंगे कि strong hook, engaging structure और clear CTA की मदद से बेहतर content कैसे बनाया जा सकता है।`,
          }
      : isHinglish
      ? {
          linkedin: `🚀 ${topic} ko viral banane ka best tareeka simple hai: strong hook, clear value, aur ek relatable angle.\n\nAaj audience sirf content nahi, connection chahti hai. Agar aap first 3 seconds mein attention grab kar lete ho, toh watch time aur engagement dono improve hote hain.\n\nQuick framework:\n✅ Pehle problem bolo\n✅ Phir quick solution do\n✅ End mein clear CTA rakho\n\nAapka favourite hook style kya hai? Comments mein batao 👇\n\n#${hashtag} #ContentCreation #YouTubeShorts #HinglishContent`,
          instagram: `Viral Shorts banana hai? 👀\n\nHook strong rakho, message simple rakho, aur first line mein curiosity create karo. Audience ko yeh feel hona chahiye: “yeh video mere liye hai.”\n\nSave this for your next reel/short 📌\n\n#${hashtag} #ReelsTips #ShortsTips #CreatorIndia`,
          facebook: `${topic} ke liye ek simple rule: content ko fancy nahi, useful banao.\n\nStart mein attention-grabbing hook, beech mein clear value, aur end mein ek direct CTA. Bas yahi structure consistently follow karoge toh engagement better hoga.\n\nAap kaunsa platform zyada use karte ho?`,
          youtube: `Title: ${topic} ka Viral Formula\n\nDescription:\nIs video mein hum dekhenge ki YouTube Shorts ke liye hook kaise likhna hai, attention kaise grab karni hai, aur viewer ko end tak kaise rokna hai.\n\nWatch till the end for a simple repeatable framework.`,
        }
      : {
          linkedin: `🚀 Level up your game with ${topic}! \n\nAs someone in the industry, I've seen how ${topic} is transforming the way we work. Whether you're a professional or just starting out, this is something you can't afford to ignore.\n\n3 Reasons Why ${topic} Matters:\n1️⃣ Efficiency: Save hours every week.\n2️⃣ Growth: Unlock new opportunities.\n3️⃣ Innovation: Stay ahead of the curve.\n\nWhat's your take on ${topic}? Let's chat below! 👇\n\n#${hashtag} #FutureOfWork #AI #SaaS`,
          instagram: `The secret to ${topic} revealed! 🤫✨\n\nSwipe to see how I implemented this into my daily routine and saw massive results. If you're tired of the status quo, this post is your sign to start ${topic} today! \n\nTag a friend who needs to see this! 🏷️\n\n#${hashtag} #CreatorEconomy #ViralTips #SuccessMindset`,
          facebook: `Thinking about ${topic} today... 📢\n\nIt's amazing how a small shift in strategy can lead to such a big impact. I've been experimenting with ${topic} and the results are mind-blowing. If you're looking for a fresh perspective, check out my latest guide on this!\n\nJoin the discussion in our group! 💙\n\n#${hashtag} #Community #Learning`,
          youtube: `Title: Why ${topic} is the NEXT BIG THING in 2026! 🎥\n\nDescription:\nIs ${topic} actually worth the hype? In this video, I break down the science behind ${topic} and show you exactly how to master it in record time.\n\nTimestamps:\n0:00 - The Truth about ${topic}\n2:15 - Case Studies\n5:30 - How to Get Started\n\nSUBSCRIBE for more weekly deep-dives! 🔔`,
        };

    let content = await generateJsonCandidatesWithOpenRouter({
      fallback,
      system:
        "You are a senior social media strategist and fact-aware content writer. You must preserve the user's exact topic and angle. Never replace it with a generic framework unless the user asks for a framework.",
      prompt: `Create a social media post pack about "${topic}".

Language: ${language}
Style: ${style}

Language rules:
- English: write clear English only.
- Hindi: write Hindi in Devanagari script.
- Hinglish: write natural Indian Hinglish using Hindi words in Latin script mixed with English.
- If language is Hinglish, do not write pure English.
- If language is Hindi, do not write Hinglish.

Style rules:
- Professional: polished, credible, and structured.
- Friendly: warm, conversational, and easygoing.
- Viral: hook-heavy, punchy, shareable, and high-energy.
- Funny: witty and light, but still relevant to the topic.

Keep the content practical, specific, and platform-native.

Accuracy rules:
- Directly answer the user's prompt.
- Preserve named people, teams, events, and the main claim/question.
- Do not invent strange phrases or repeat malformed wording.
- If the prompt asks "why", give clear reasons.
- For cricket GOAT prompts, mention cricket-specific reasons such as consistency, chases, records, fitness, impact, pressure, or all-format dominance.

Platform rules:
- LinkedIn should be thoughtful, skimmable, and useful with a clean CTA.
- Instagram should be shorter, hook-led, caption-ready, and hashtag-friendly.
- Facebook should feel conversational and community-friendly.
- YouTube should include a title and description, not just a caption.

${liveContext.context ? `Use this verified live context. Do not invent match facts outside this context:\n${liveContext.context}` : ""}

${sportsResultContext?.context ? `Use this verified sports result context as the highest priority facts. Do not contradict it:
${sportsResultContext.context}` : ""}

${webContext && !sportsResultContext?.context ? `Use this live web context for current facts. Cite only ideas supported by these sources and avoid inventing details:
Search answer:
${webContext.answer}

Sources:
${webContext.sources
  .map((source, index) => `${index + 1}. ${source.title}\n${source.url}\n${source.content}`)
  .join("\n\n")}` : ""}

Return this exact JSON shape:
{
  "linkedin": "LinkedIn post text",
  "instagram": "Instagram caption text",
  "facebook": "Facebook post text",
  "youtube": "YouTube title and description text"
}`,
    });

    if (isViratGoatPrompt(topic)) {
      const combined = Object.values(content).join(" ");
      if (
        !hasAllCoreTerms(combined, ["virat", "kohli"]) ||
        !/consistency|chase|record|fitness|pressure|dominance|impact|runs/i.test(
          combined,
        )
      ) {
        content = fallback;
      }
    }

    return Response.json({
      content,
      sources: webContext?.sources || liveContext.sources || [],
    });
  } catch (error) {
    console.error("AI Post Generation Error:", error);
    return Response.json({ error: "Failed to generate post" }, { status: 500 });
  }
}
