const stripHtml = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

async function requestYouTube(endpoint) {
  const response = await fetch(endpoint, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to load YouTube data.");
  }

  return data;
}

async function fetchRecentChannelVideos(channelId, apiKey) {
  const channelEndpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelEndpoint.searchParams.set("part", "contentDetails");
  channelEndpoint.searchParams.set("id", channelId);
  channelEndpoint.searchParams.set("key", apiKey);

  const channelData = await requestYouTube(channelEndpoint);
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error("Unable to find recent uploads for this YouTube channel.");
  }

  const uploadsEndpoint = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  uploadsEndpoint.searchParams.set("part", "snippet,contentDetails");
  uploadsEndpoint.searchParams.set("playlistId", uploadsPlaylistId);
  uploadsEndpoint.searchParams.set("maxResults", "10");
  uploadsEndpoint.searchParams.set("key", apiKey);

  const uploadsData = await requestYouTube(uploadsEndpoint);
  return (uploadsData.items || [])
    .map((item) => ({
      id: String(item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || ""),
      title: String(item.snippet?.title || "YouTube video"),
    }))
    .filter((video) => video.id);
}

async function fetchCommentsForVideo(video, apiKey) {
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("videoId", video.id);
  endpoint.searchParams.set("order", "time");
  endpoint.searchParams.set("maxResults", "5");
  endpoint.searchParams.set("textFormat", "html");
  endpoint.searchParams.set("key", apiKey);

  try {
    const data = await requestYouTube(endpoint);
    return (data.items || []).map((item) => {
      const topComment = item.snippet?.topLevelComment?.snippet || {};

      return {
        id: String(item.snippet?.topLevelComment?.id || item.id || crypto.randomUUID()),
        author: String(topComment.authorDisplayName || "YouTube commenter"),
        text: stripHtml(topComment.textDisplay || topComment.textOriginal || ""),
        publishedAt: String(topComment.publishedAt || new Date().toISOString()),
        videoId: video.id,
        videoTitle: video.title,
      };
    });
  } catch {
    return [];
  }
}

export async function POST(request) {
  try {
    const { channelId } = await request.json();
    const cleanChannelId = String(channelId || "").trim();
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

    if (!cleanChannelId) {
      return Response.json({ error: "Connect YouTube in Settings first." }, { status: 400 });
    }

    if (!apiKey) {
      return Response.json({ error: "Add YOUTUBE_API_KEY to load real YouTube comments." }, { status: 400 });
    }

    const videos = await fetchRecentChannelVideos(cleanChannelId, apiKey);
    const commentGroups = await Promise.all(videos.map((video) => fetchCommentsForVideo(video, apiKey)));
    const comments = commentGroups
      .flat()
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 25);

    return Response.json({ comments });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load comments." },
      { status: 400 },
    );
  }
}
