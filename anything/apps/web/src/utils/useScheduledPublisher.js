import { useEffect, useRef } from "react";
import supabase from "@/utils/supabase";
import { listContent, updateContent } from "@/utils/contentStore";
import {
  listPlatformConnections,
  removePlatformConnection,
  updatePlatformConnectionTokens,
} from "@/utils/platformConnections";

const publishing = new Set();

export default function useScheduledPublisher(user) {
  const userId = user?.id;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const publishDuePosts = async () => {
      const [content, connections] = await Promise.all([
        listContent(userId),
        listPlatformConnections(userId),
      ]);
      const youtubeConnection = connections.find((item) => item.platform === "youtube");

      const now = Date.now();
      const duePosts = content.filter(
        (item) =>
          item.status === "scheduled" &&
          item.scheduled_at &&
          Date.parse(item.scheduled_at) <= now,
      );

      for (const item of duePosts) {
        if (publishing.has(item.id)) continue;
        publishing.add(item.id);

        try {
          const body =
            typeof item.generated_text === "string"
              ? item.generated_text
              : JSON.stringify(item.generated_text || "");

          if (item.platform === "youtube") {
            if (!item.media?.publicUrl || !item.media?.type?.startsWith("video/")) {
              throw new Error("Scheduled YouTube publishing needs a stored video file URL.");
            }

            const {
              data: { session },
            } = await supabase.auth.getSession();

            const auth = youtubeConnection?.access_token
              ? {
                  accessToken: youtubeConnection.access_token,
                  refreshToken: youtubeConnection.refresh_token || "",
                  tokenExpiresAt: youtubeConnection.token_expires_at || "",
                }
              : {
                  accessToken: session?.provider_token || "",
                  refreshToken: session?.provider_refresh_token || "",
                  tokenExpiresAt: session?.expires_at
                    ? new Date(session.expires_at * 1000).toISOString()
                    : "",
                };

            if (!auth.accessToken) {
              throw new Error("YouTube connection is missing. Reconnect it in Settings.");
            }

            const response = await fetch("/api/publish/youtube", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: auth.accessToken,
                refreshToken: auth.refreshToken,
                tokenExpiresAt: auth.tokenExpiresAt,
                mediaUrl: item.media.publicUrl,
                thumbnailUrl: item.media.thumbnail?.publicUrl || "",
                title: item.title,
                body,
              }),
            });
            const data = await response.json();

            if (!response.ok) {
              if (data.needsReconnect && youtubeConnection?.id) {
                await removePlatformConnection(userId, youtubeConnection.id);
              }
              throw new Error(data.error || "YouTube publish failed");
            }

            if (data.accessToken && youtubeConnection?.id) {
              await updatePlatformConnectionTokens(userId, youtubeConnection.id, {
                accessToken: data.accessToken,
                tokenExpiresAt: data.tokenExpiresAt,
              });
            }

            await updateContent(userId, item.id, {
              status: "published",
              published_at: new Date().toISOString(),
              media: {
                ...item.media,
                youtubeVideoId: data.videoId,
                youtubeUrl: data.url,
                youtubeThumbnailSet: data.thumbnailSet || false,
              },
            });
          } else {
            const connection = connections.find(
              (candidate) => candidate.platform === item.platform,
            );

            if (!connection?.access_token || !connection?.external_account_id) {
              throw new Error(`${item.platform} connection is missing. Reconnect it in Settings.`);
            }

            if (
              item.platform === "instagram" &&
              !(
                item.media?.publicUrl &&
                (item.media?.type?.startsWith("image/") ||
                  item.media?.type?.startsWith("video/"))
              )
            ) {
              throw new Error("Instagram publishing needs a stored image or video URL.");
            }

            const response = await fetch("/api/publish/social", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform: item.platform,
                accessToken: connection.access_token,
                accountId: connection.external_account_id,
                title: item.title,
                body,
                mediaUrl: item.media?.publicUrl || "",
                mediaType: item.media?.type || "",
              }),
            });
            const data = await response.json();

            if (!response.ok) {
              if (data.needsReconnect && connection.id) {
                await removePlatformConnection(userId, connection.id);
              }
              throw new Error(
                data.error ||
                  (data.needsReconnect
                    ? `${item.platform} access expired or is invalid. Reconnect it in Settings.`
                    : `${item.platform} publish failed`),
              );
            }

            await updateContent(userId, item.id, {
              status: "published",
              published_at: new Date().toISOString(),
              media: {
                ...item.media,
                [`${item.platform}PostId`]: data.platformPostId,
                [`${item.platform}Url`]: data.url,
              },
            });
          }
        } catch (error) {
          console.error("Scheduled publish failed:", {
            id: item.id,
            platform: item.platform,
            error,
          });
          await updateContent(userId, item.id, {
            status: "publish_failed",
            publish_error: error.message || `${item.platform} publish failed`,
          });
        } finally {
          publishing.delete(item.id);
        }
      }
    };

    publishDuePosts();
    timerRef.current = window.setInterval(publishDuePosts, 30000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [userId]);
}
