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

const replyMeta = async ({ platform, accessToken, commentId, replyText }) => {
  const endpoint = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/${
      platform === "instagram" ? "replies" : "comments"
    }`,
  );
  const body = new URLSearchParams({
    access_token: accessToken,
    message: replyText,
  });

  const response = await fetch(endpoint, { method: "POST", body });
  const data = await getJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      needsReconnect: isMetaInvalidToken(data),
      error: data?.error?.message || `${platform} rejected the comment reply.`,
      details: data?.error,
    };
  }

  return { ok: true, replyId: data.id || data.comment_id };
};

const replyLinkedIn = async ({ accessToken, accountId, commentId, replyText }) => {
  const encodedCommentUrn = encodeURIComponent(commentId);
  const response = await fetch(
    `https://api.linkedin.com/rest/socialActions/${encodedCommentUrn}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify({
        actor: `urn:li:person:${accountId}`,
        message: {
          text: replyText,
        },
      }),
    },
  );
  const data = await getJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      needsReconnect: response.status === 401 || response.status === 403,
      error: data?.message || "LinkedIn rejected the comment reply.",
      details: data,
    };
  }

  return {
    ok: true,
    replyId: response.headers.get("x-restli-id") || data.id || "",
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const platform = String(body.platform || "").trim().toLowerCase();
    const accessToken = String(body.accessToken || "").trim();
    const accountId = String(body.accountId || "").trim();
    const commentId = String(body.commentId || "").trim();
    const replyText = String(body.replyText || "").trim();

    if (!["instagram", "facebook", "linkedin"].includes(platform)) {
      return Response.json({ error: "Unsupported comment platform." }, { status: 400 });
    }

    if (!accessToken) {
      return Response.json(
        { error: `${platform} connection is missing. Reconnect it in Settings.`, needsReconnect: true },
        { status: 401 },
      );
    }

    if (platform === "linkedin" && !accountId) {
      return Response.json(
        { error: "LinkedIn account ID is missing. Reconnect LinkedIn in Settings.", needsReconnect: true },
        { status: 401 },
      );
    }

    if (!commentId) {
      return Response.json({ error: "Comment ID is required." }, { status: 400 });
    }

    if (!replyText) {
      return Response.json({ error: "Reply text is required." }, { status: 400 });
    }

    const result =
      platform === "linkedin"
        ? await replyLinkedIn({ accessToken, accountId, commentId, replyText })
        : await replyMeta({ platform, accessToken, commentId, replyText });

    if (!result.ok) {
      return Response.json(
        {
          error: result.error,
          details: result.details,
          needsReconnect: Boolean(result.needsReconnect),
        },
        { status: result.status || 400 },
      );
    }

    return Response.json({ replyId: result.replyId, status: "sent" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to send social reply." },
      { status: 400 },
    );
  }
}
