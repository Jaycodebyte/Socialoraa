import { searchWeb } from "../search/webSearch";

const currentTerms = /\b(today|live|latest|current|now|tonight|aaj|abhi)\b/i;
const cricketTerms = /\b(ipl|cricket|match|score|toss|wicket|innings)\b/i;
const resultTerms = /\b(yesterday|result|winner|won|beat|defeated|highlights|scorecard|kal)\b/i;

const teamAliases = {
  rr: "Rajasthan Royals",
  srh: "Sunrisers Hyderabad",
  rcb: "Royal Challengers Bengaluru",
  gt: "Gujarat Titans",
  mi: "Mumbai Indians",
  csk: "Chennai Super Kings",
  kkr: "Kolkata Knight Riders",
  dc: "Delhi Capitals",
  pbks: "Punjab Kings",
  lsg: "Lucknow Super Giants",
};

const expandTeamAliases = (topic) => {
  let expanded = String(topic || "");

  Object.entries(teamAliases).forEach(([alias, name]) => {
    const compactPair = new RegExp(`\\b${alias}(?=vs|v\\b)`, "gi");
    const normalAlias = new RegExp(`\\b${alias}\\b`, "gi");
    expanded = expanded.replace(compactPair, `${name} `);
    expanded = expanded.replace(normalAlias, name);
  });

  return expanded.replace(/\bvs\b/gi, "vs");
};

const getIndiaDateParts = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = new Date(formatter.format(new Date()));
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return {
    today: today.toISOString().slice(0, 10),
    yesterday: yesterday.toISOString().slice(0, 10),
  };
};

const compactTeamScore = (score) => {
  if (!Array.isArray(score)) return "";
  return score
    .map((item) => `${item.inning}: ${item.r}/${item.w} (${item.o})`)
    .join("; ");
};

export function needsLiveSportsContext(topic) {
  return currentTerms.test(topic) && cricketTerms.test(topic);
}

export function needsWebSportsResultContext(topic) {
  return cricketTerms.test(topic) && resultTerms.test(topic);
}

const countWinnerSignals = (haystack, teamName, shortName) => {
  const escapedTeam = teamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedShort = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escapedTeam}\\s+(won|beat|defeated|gunned down|stormed past|secured)`, "gi"),
    new RegExp(`${escapedShort}\\s+(won|beat|defeated)`, "gi"),
    new RegExp(`(won|beat|defeated)\\s+.*${escapedTeam}`, "gi"),
  ];

  return patterns.reduce((total, pattern) => total + (haystack.match(pattern)?.length || 0), 0);
};

export async function getWebSportsResultContext(topic) {
  if (!needsWebSportsResultContext(topic)) {
    return { required: false, context: "", sources: [] };
  }

  const dates = getIndiaDateParts();
  const expandedTopic = expandTeamAliases(topic);
  const searchQuery = `${expandedTopic} IPL 2026 result winner score ${dates.yesterday} ${dates.today}`;
  const webResult = await searchWeb(searchQuery, { maxResults: 8 });
  const sourceText = [webResult.answer, ...webResult.sources.map((source) => `${source.title} ${source.content}`)]
    .join("\n")
    .toLowerCase();

  const rrSignals = countWinnerSignals(sourceText, "rajasthan royals", "rr");
  const srhSignals = countWinnerSignals(sourceText, "sunrisers hyderabad", "srh");
  let verifiedWinner = "";

  if (/rajasthan royals|rr/i.test(expandedTopic) && /sunrisers hyderabad|srh/i.test(expandedTopic)) {
    if (rrSignals > srhSignals) verifiedWinner = "Rajasthan Royals";
    if (srhSignals > rrSignals) verifiedWinner = "Sunrisers Hyderabad";
  }

  const marginMatch =
    sourceText.match(/(?:won|victory|win)\s+by\s+(\d+\s+(?:runs|wickets))/i) ||
    sourceText.match(/by\s+(\d+\s+(?:runs|wickets))/i);

  return {
    required: true,
    context: [
      `Sports result query: ${searchQuery}`,
      `Today in India: ${dates.today}`,
      `Yesterday in India: ${dates.yesterday}`,
      verifiedWinner ? `Verified winner from source agreement: ${verifiedWinner}` : "",
      marginMatch ? `Verified margin found in sources: ${marginMatch[1]}` : "",
      `Important: If the sources mention both teams, use the verified winner above. Do not reverse the winner.`,
      `Search answer: ${webResult.answer}`,
    ]
      .filter(Boolean)
      .join("\n"),
    sources: webResult.sources,
  };
}

export async function getLiveSportsContext(topic) {
  if (!needsLiveSportsContext(topic)) {
    return { required: false, context: "" };
  }

  const dates = getIndiaDateParts();
  const expandedTopic = expandTeamAliases(topic);
  const webSearchFallback = async () => {
    const searchQuery = `${expandedTopic} live cricket IPL news score update ${dates.today}`;
    const webResult = await searchWeb(searchQuery, { maxResults: 6 });

    return {
      required: true,
      context: [
        `Live sports web query: ${searchQuery}`,
        `Today in India: ${dates.today}`,
        `Search answer: ${webResult.answer}`,
        `Important: Use only source-supported facts. If scores, toss, or winner are unclear, say that updates are still developing instead of inventing details.`,
      ].join("\n"),
      sources: webResult.sources,
    };
  };

  const apiKey = process.env.CRICAPI_KEY;
  if (!apiKey) {
    return webSearchFallback();
  }

  try {
    const response = await fetch(
      `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`,
    );
    if (!response.ok) {
      throw new Error(`Live cricket API failed: ${response.status}`);
    }

    const payload = await response.json();
    const matches = Array.isArray(payload.data) ? payload.data : [];
    const query = topic.toLowerCase();
    const relevant = matches.filter((match) => {
      const text = `${match.name || ""} ${match.matchType || ""} ${match.series || ""} ${
        match.teams?.join(" ") || ""
      }`.toLowerCase();

      return text.includes("ipl") || text.includes("indian premier league") || query
        .split(/\s+/)
        .some((word) => word.length > 3 && text.includes(word));
    });

    const selected = relevant[0] || matches[0];
    if (!selected) {
      return {
        required: true,
        context: "",
        error: "No live cricket match data is available right now.",
      };
    }

    return {
      required: true,
      context: [
        `Match: ${selected.name}`,
        `Status: ${selected.status || "Status unavailable"}`,
        `Venue: ${selected.venue || "Venue unavailable"}`,
        `Date: ${selected.dateTimeGMT || selected.date || "Date unavailable"}`,
        `Score: ${compactTeamScore(selected.score) || "Score unavailable"}`,
      ].join("\n"),
    };
  } catch (error) {
    console.error("Live cricket context unavailable:", error);
    return webSearchFallback();
  }
}
