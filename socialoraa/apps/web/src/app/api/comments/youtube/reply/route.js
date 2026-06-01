const refreshGoogleAccessToken = async (refreshToken) => {
  if (!refreshToken) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    return null;
  }

  return {
    accessToken: data.access_token,
    tokenExpiresAt: new Date(
      Date.now() + Number(data.expires_in || 3600) * 1000,
    ).toISOString(),
  };
};

const insertYouTubeReply = async ({ commentId, replyText, accessToken }) => {
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/comments");
  endpoint.searchParams.set("part", "snippet");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        parentId: commentId,
        textOriginal: replyText,
      },
    }),
  });

  const data = await response.json();
  return { response, data };
};

const isInvalidTokenError = (data) => {
  const message = data?.error?.message || "";
  const status = data?.error?.status || "";
  return (
    /invalid authentication credentials|invalid credential|access token/i.test(message) ||
    status === "UNAUTHENTICATED"
  );
};

export async function POST(request) {
  try {
    const body = await request.json();
    const commentId = String(body.commentId || "").trim();
    const replyText = String(body.replyText || "").trim();
    let accessToken = String(body.accessToken || "").trim();
    const refreshToken = String(body.refreshToken || "").trim();
    const tokenExpiresAt = String(body.tokenExpiresAt || "").trim();

    if (!commentId) {
      return Response.json({ error: "Comment ID is required." }, { status: 400 });
    }

    if (!replyText) {
      return Response.json({ error: "Reply text is required." }, { status: 400 });
    }

    const isExpired =
      tokenExpiresAt && Date.parse(tokenExpiresAt) < Date.now() + 60 * 1000;

    if (isExpired && refreshToken) {
      const refreshed = await refreshGoogleAccessToken(refreshToken);
      if (refreshed?.accessToken) {
        accessToken = refreshed.accessToken;
      }
    }

    if (!accessToken) {
      return Response.json(
        {
          error:
            "YouTube access is missing. Reconnect YouTube in Settings and approve comment reply permission.",
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    let refreshedToken = null;
    let { response, data } = await insertYouTubeReply({
      commentId,
      replyText,
      accessToken,
    });

    if (!response.ok && isInvalidTokenError(data) && refreshToken) {
      refreshedToken = await refreshGoogleAccessToken(refreshToken);

      if (refreshedToken?.accessToken) {
        ({ response, data } = await insertYouTubeReply({
          commentId,
          replyText,
          accessToken: refreshedToken.accessToken,
        }));
      }
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        "YouTube rejected the reply. Make sure the connected account owns the channel and has youtube.force-ssl permission.";
      const invalidToken = isInvalidTokenError(data);
      return Response.json(
        {
          error: invalidToken
            ? "YouTube access expired or is invalid. Reconnect YouTube in Settings, then enable Auto Reply again."
            : message,
          details: data?.error,
          needsReconnect: invalidToken,
        },
        { status: invalidToken ? 401 : response.status },
      );
    }

    return Response.json({
      replyId: data.id,
      status: "sent",
      accessToken: refreshedToken?.accessToken || null,
      tokenExpiresAt: refreshedToken?.tokenExpiresAt || null,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to send YouTube reply." },
      { status: 400 },
    );
  }
}
