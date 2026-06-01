const GRAPH_VERSION = "v24.0";
const LINKEDIN_VERSION = "202605";

const textFromBody = (title, body) => {
  const value = String(body || "").trim();
  if (value) return value;
  return String(title || "").trim();
};

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

const isLinkedInInvalidToken = (response, data) => {
  const message = data?.message || data?.serviceErrorCode || "";
  return (
    response.status === 401 ||
    /invalid access token|expired token|token has expired|oauth/i.test(String(message))
  );
};

const getLinkedInPublishError = (response, data) => {
  const message = String(data?.message || data?.error_description || "").trim();
  if (/scope|permission|w_member_social|not enough permissions/i.test(message)) {
    return "LinkedIn posting permission is missing. Reconnect LinkedIn in Settings after confirming your LinkedIn app has w_member_social enabled.";
  }

  if (/invalid access token|expired token|token has expired|oauth/i.test(message)) {
    return "LinkedIn access expired or is invalid. Reconnect LinkedIn in Settings, then try again.";
  }

  return message || `LinkedIn rejected the post with status ${response.status}.`;
};

const publishFacebook = async ({ accessToken, accountId, title, body, mediaUrl, mediaType }) => {
  const message = textFromBody(title, body);
  if (!message && !mediaUrl) {
    throw new Error("Facebook post needs text or attached media.");
  }

  let endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/feed`;
  const payload = new URLSearchParams({ access_token: accessToken });

  if (mediaUrl && mediaType?.startsWith("image/")) {
    endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/photos`;
    payload.set("url", mediaUrl);
    if (message) payload.set("caption", message);
  } else if (mediaUrl && mediaType?.startsWith("video/")) {
    endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/videos`;
    payload.set("file_url", mediaUrl);
    payload.set("description", message);
    payload.set("title", String(title || "Scheduled video").slice(0, 255));
  } else {
    payload.set("message", message);
  }

  const response = await fetch(endpoint, { method: "POST", body: payload });
  const data = await getJson(response);
  if (!response.ok) {
    const invalidToken = isMetaInvalidToken(data);
    return {
      ok: false,
      status: response.status,
      needsReconnect: invalidToken,
      error: data?.error?.message || "Facebook rejected the post.",
      details: data?.error,
    };
  }

  return {
    ok: true,
    platformPostId: data.post_id || data.id,
    url: data.post_id ? `https://www.facebook.com/${data.post_id}` : null,
  };
};

const waitForInstagramContainer = async ({ accessToken, creationId }) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const endpoint = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${creationId}`);
    endpoint.searchParams.set("fields", "status_code,status");
    endpoint.searchParams.set("access_token", accessToken);
    const response = await fetch(endpoint);
    const data = await getJson(response);
    if (!response.ok) return data;
    if (data.status_code === "FINISHED") return data;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") return data;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return { status_code: "TIMEOUT", status: "Instagram media processing timed out." };
};

const publishInstagram = async ({ accessToken, accountId, title, body, mediaUrl, mediaType }) => {
  const caption = textFromBody(title, body);
  if (!mediaUrl || !(mediaType?.startsWith("image/") || mediaType?.startsWith("video/"))) {
    throw new Error("Instagram publishing needs an image or video URL.");
  }

  const createPayload = new URLSearchParams({
    access_token: accessToken,
    caption,
  });

  if (mediaType.startsWith("video/")) {
    createPayload.set("media_type", "REELS");
    createPayload.set("video_url", mediaUrl);
  } else {
    createPayload.set("image_url", mediaUrl);
  }

  const createResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/media`,
    { method: "POST", body: createPayload },
  );
  const createData = await getJson(createResponse);
  if (!createResponse.ok || !createData.id) {
    const invalidToken = isMetaInvalidToken(createData);
    return {
      ok: false,
      status: createResponse.status,
      needsReconnect: invalidToken,
      error: createData?.error?.message || "Instagram could not create the media container.",
      details: createData?.error,
    };
  }

  if (mediaType.startsWith("video/")) {
    const status = await waitForInstagramContainer({ accessToken, creationId: createData.id });
    if (status.status_code !== "FINISHED") {
      return {
        ok: false,
        status: 400,
        error: status.status || "Instagram video is still processing. Try again in a minute.",
        details: status,
      };
    }
  }

  const publishPayload = new URLSearchParams({
    access_token: accessToken,
    creation_id: createData.id,
  });
  const publishResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/media_publish`,
    { method: "POST", body: publishPayload },
  );
  const publishData = await getJson(publishResponse);
  if (!publishResponse.ok || !publishData.id) {
    const invalidToken = isMetaInvalidToken(publishData);
    return {
      ok: false,
      status: publishResponse.status,
      needsReconnect: invalidToken,
      error: publishData?.error?.message || "Instagram rejected the publish request.",
      details: publishData?.error,
    };
  }

  return {
    ok: true,
    platformPostId: publishData.id,
    url: `https://www.instagram.com/p/${publishData.id}/`,
  };
};

const publishLinkedIn = async ({ accessToken, accountId, title, body, mediaUrl }) => {
  const commentary = [textFromBody(title, body), mediaUrl ? `\n${mediaUrl}` : ""]
    .join("")
    .trim();
  if (!commentary) {
    throw new Error("LinkedIn post needs text.");
  }

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author: `urn:li:person:${accountId}`,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const data = await getJson(response);
  if (!response.ok) {
    const invalidToken = isLinkedInInvalidToken(response, data);
    return {
      ok: false,
      status: response.status,
      needsReconnect: invalidToken,
      error: getLinkedInPublishError(response, data),
      details: data,
    };
  }

  const postUrn = response.headers.get("x-restli-id") || data.id || "";
  return {
    ok: true,
    platformPostId: postUrn,
    url: postUrn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/` : null,
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const platform = String(body.platform || "").trim().toLowerCase();
    const accessToken = String(body.accessToken || "").trim();
    const accountId = String(body.accountId || "").trim();
    const mediaUrl = String(body.mediaUrl || "").trim();
    const mediaType = String(body.mediaType || "").trim();

    if (!["facebook", "instagram", "linkedin"].includes(platform)) {
      return Response.json({ error: "Unsupported social platform." }, { status: 400 });
    }

    if (!accessToken || !accountId) {
      return Response.json(
        {
          error: `${platform} connection is missing. Reconnect it in Settings.`,
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    const result =
      platform === "facebook"
        ? await publishFacebook({ ...body, accessToken, accountId, mediaUrl, mediaType })
        : platform === "instagram"
          ? await publishInstagram({ ...body, accessToken, accountId, mediaUrl, mediaType })
          : await publishLinkedIn({ ...body, accessToken, accountId, mediaUrl, mediaType });

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

    return Response.json({
      status: "published",
      platform,
      platformPostId: result.platformPostId,
      url: result.url,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to publish social post." },
      { status: 400 },
    );
  }
}
