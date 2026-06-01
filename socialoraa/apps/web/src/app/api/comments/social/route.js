const GRAPH_VERSION = "v24.0";
const LINKEDIN_VERSION = "202605";

const getJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const isMetaInvalidToken = (data) => {
  const code = data?.error?.code;
  const message = data?.error?.message || "";
  return code === 190 || /token|session|permission/i.test(message);
};

const fetchMetaComments = async ({ platform, accessToken, targets }) => {
  const groups = await Promise.all(
    targets.map(async (target) => {
      const endpoint = new URL(
        `https://graph.facebook.com/${GRAPH_VERSION}/${target.postId}/comments`,
      );
      endpoint.searchParams.set(
        "fields",
        platform === "instagram"
          ? "id,text,username,timestamp"
          : "id,message,from,created_time",
      );
      endpoint.searchParams.set("limit", "10");
      endpoint.searchParams.set("access_token", accessToken);

      const response = await fetch(endpoint);
      const data = await getJson(response);

      if (!response.ok) {
        return {
          error: data?.error?.message || `Could not load ${platform} comments.`,
          needsReconnect: isMetaInvalidToken(data),
          comments: [],
        };
      }

      return {
        comments: (data.data || []).map((comment) => ({
          id: String(comment.id),
          platform,
          author:
            platform === "instagram"
              ? String(comment.username || "Instagram user")
              : String(comment.from?.name || "Facebook user"),
          text: String(comment.text || comment.message || ""),
          publishedAt: String(
            comment.timestamp || comment.created_time || new Date().toISOString(),
          ),
          postId: target.postId,
          postTitle: target.title,
        })),
      };
    }),
  );

  const failed = groups.find((group) => group.needsReconnect);
  if (failed) return failed;

  return { comments: groups.flatMap((group) => group.comments || []) };
};

const fetchLinkedInComments = async ({ accessToken, targets }) => {
  const groups = await Promise.all(
    targets.map(async (target) => {
      const encodedUrn = encodeURIComponent(target.postId);
      const response = await fetch(
        `https://api.linkedin.com/rest/socialActions/${encodedUrn}/comments?q=comments&sort=RELEVANCE`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "Linkedin-Version": LINKEDIN_VERSION,
          },
        },
      );
      const data = await getJson(response);

      if (!response.ok) {
        return {
          error: data?.message || "Could not load LinkedIn comments.",
          needsReconnect: response.status === 401 || response.status === 403,
          comments: [],
        };
      }

      return {
        comments: (data.elements || []).map((comment) => ({
          id: String(comment.$URN || comment.id || ""),
          platform: "linkedin",
          author: "LinkedIn member",
          text: String(comment.message?.text || comment.text?.text || ""),
          publishedAt: comment.created?.time
            ? new Date(comment.created.time).toISOString()
            : new Date().toISOString(),
          postId: target.postId,
          postTitle: target.title,
        })),
      };
    }),
  );

  const failed = groups.find((group) => group.needsReconnect);
  if (failed) return failed;

  return { comments: groups.flatMap((group) => group.comments || []).filter((comment) => comment.id) };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const platform = String(body.platform || "").trim().toLowerCase();
    const accessToken = String(body.accessToken || "").trim();
    const targets = Array.isArray(body.targets)
      ? body.targets
          .map((target) => ({
            postId: String(target.postId || "").trim(),
            title: String(target.title || "Published post"),
          }))
          .filter((target) => target.postId)
      : [];

    if (!["instagram", "facebook", "linkedin"].includes(platform)) {
      return Response.json({ error: "Unsupported comment platform." }, { status: 400 });
    }

    if (!accessToken) {
      return Response.json(
        { error: `${platform} connection is missing. Reconnect it in Settings.`, needsReconnect: true },
        { status: 401 },
      );
    }

    if (!targets.length) {
      return Response.json({ comments: [] });
    }

    const result =
      platform === "linkedin"
        ? await fetchLinkedInComments({ accessToken, targets })
        : await fetchMetaComments({ platform, accessToken, targets });

    if (result.needsReconnect || result.error) {
      return Response.json(
        { error: result.error, needsReconnect: Boolean(result.needsReconnect) },
        { status: result.needsReconnect ? 401 : 400 },
      );
    }

    return Response.json({
      comments: result.comments
        .filter((comment) => comment.text)
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .slice(0, 25),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load social comments." },
      { status: 400 },
    );
  }
}
