const parseTitleAndDescription = (title, body) => {
  const text = String(body || "");
  const titleMatch = text.match(/^title:\s*(.+)$/im);
  const descriptionMatch = text.match(/^description:\s*([\s\S]+)$/im);

  return {
    title: String(titleMatch?.[1] || title || "Untitled YouTube video").slice(0, 100),
    description: String(descriptionMatch?.[1] || body || "").slice(0, 5000),
  };
};

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

  if (!response.ok || !data.access_token) return null;

  return {
    accessToken: data.access_token,
    tokenExpiresAt: new Date(
      Date.now() + Number(data.expires_in || 3600) * 1000,
    ).toISOString(),
  };
};

const isInvalidTokenError = (data) => {
  const message = data?.error?.message || "";
  const status = data?.error?.status || "";
  return (
    /invalid authentication credentials|invalid credential|access token/i.test(message) ||
    status === "UNAUTHENTICATED"
  );
};

const uploadVideo = async ({ accessToken, file, metadata }) => {
  const boundary = `socialoraa-${crypto.randomUUID()}`;
  const metadataPart = JSON.stringify({
    snippet: {
      title: metadata.title,
      description: metadata.description,
      categoryId: "22",
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  });

  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const bodyParts = [
    new TextEncoder().encode(
      `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n${delimiter}Content-Type: ${file.type}\r\n\r\n`,
    ),
    new Uint8Array(await file.arrayBuffer()),
    new TextEncoder().encode(closeDelimiter),
  ];

  const totalLength = bodyParts.reduce((total, part) => total + part.byteLength, 0);
  const uploadBody = new Uint8Array(totalLength);
  let offset = 0;
  bodyParts.forEach((part) => {
    uploadBody.set(part, offset);
    offset += part.byteLength;
  });

  const endpoint = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet,status");
  endpoint.searchParams.set("uploadType", "multipart");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: uploadBody,
  });

  const data = await response.json();
  return { response, data };
};

const uploadThumbnail = async ({ accessToken, videoId, file }) => {
  if (!videoId || !(file instanceof File) || !file.type.startsWith("image/")) {
    return { ok: false, skipped: true };
  }

  const endpoint = new URL("https://www.googleapis.com/upload/youtube/v3/thumbnails/set");
  endpoint.searchParams.set("videoId", videoId);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type,
    },
    body: new Uint8Array(await file.arrayBuffer()),
  });

  const data = await response.json();
  return { ok: response.ok, data };
};

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let file = null;
    let mediaUrl = "";
    let accessToken = "";
    let refreshToken = "";
    let tokenExpiresAt = "";
    let title = "";
    let body = "";
    let thumbnailFile = null;
    let thumbnailUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      file = formData.get("file");
      accessToken = String(formData.get("accessToken") || "").trim();
      refreshToken = String(formData.get("refreshToken") || "").trim();
      tokenExpiresAt = String(formData.get("tokenExpiresAt") || "").trim();
      title = String(formData.get("title") || "").trim();
      body = String(formData.get("body") || "").trim();
      thumbnailFile = formData.get("thumbnail");
    } else {
      const json = await request.json();
      accessToken = String(json.accessToken || "").trim();
      refreshToken = String(json.refreshToken || "").trim();
      tokenExpiresAt = String(json.tokenExpiresAt || "").trim();
      title = String(json.title || "").trim();
      body = String(json.body || "").trim();
      mediaUrl = String(json.mediaUrl || "").trim();
      thumbnailUrl = String(json.thumbnailUrl || "").trim();
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
            "YouTube access token is missing. Reconnect YouTube in Settings with upload permissions.",
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    if (!(file instanceof File) && mediaUrl) {
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        return Response.json({ error: "Could not fetch the scheduled video file." }, { status: 400 });
      }
      const blob = await mediaResponse.blob();
      file = new File([blob], "scheduled-video.mp4", {
        type: blob.type || "video/mp4",
      });
    }

    if (!(file instanceof File) || !file.type.startsWith("video/")) {
      return Response.json(
        { error: "Attach a valid video file before publishing to YouTube." },
        { status: 400 },
      );
    }

    if (!(thumbnailFile instanceof File) && thumbnailUrl) {
      const thumbnailResponse = await fetch(thumbnailUrl);
      if (thumbnailResponse.ok) {
        const blob = await thumbnailResponse.blob();
        thumbnailFile = new File([blob], "thumbnail.jpg", {
          type: blob.type || "image/jpeg",
        });
      }
    }

    const metadata = parseTitleAndDescription(title, body);
    let refreshedToken = null;
    let { response, data } = await uploadVideo({
      accessToken,
      file,
      metadata,
    });

    if (!response.ok && isInvalidTokenError(data) && refreshToken) {
      refreshedToken = await refreshGoogleAccessToken(refreshToken);
      if (refreshedToken?.accessToken) {
        ({ response, data } = await uploadVideo({
          accessToken: refreshedToken.accessToken,
          file,
          metadata,
        }));
      }
    }

    if (!response.ok) {
      const invalidToken = isInvalidTokenError(data);
      return Response.json(
        {
          error: invalidToken
            ? "YouTube access expired or is invalid. Reconnect YouTube in Settings with upload permission, then try again."
            : data?.error?.message ||
              "YouTube rejected the upload. Check channel ownership, OAuth scopes, and API quota.",
          details: data?.error,
          needsReconnect: invalidToken,
        },
        { status: invalidToken ? 401 : response.status },
      );
    }

    const thumbnailResult = await uploadThumbnail({
      accessToken: refreshedToken?.accessToken || accessToken,
      videoId: data.id,
      file: thumbnailFile,
    });

    return Response.json({
      videoId: data.id,
      url: data.id ? `https://www.youtube.com/watch?v=${data.id}` : null,
      status: "published",
      thumbnailSet: Boolean(thumbnailResult.ok),
      thumbnailWarning:
        thumbnailFile instanceof File && !thumbnailResult.ok
          ? thumbnailResult.data?.error?.message || "Video uploaded, but YouTube did not accept the thumbnail."
          : null,
      accessToken: refreshedToken?.accessToken || null,
      tokenExpiresAt: refreshedToken?.tokenExpiresAt || null,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to upload YouTube video." },
      { status: 400 },
    );
  }
}
