import React, { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Instagram,
  Linkedin,
  Facebook,
  Youtube,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
  Image,
  ImagePlus,
  Upload,
  Video,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { useUserPersistentState } from "@/utils/usePersistentState";
import { clearSchedulerDraft, readSchedulerDraft } from "@/utils/schedulerDraft";
import supabase from "@/utils/supabase";
import {
  listPlatformConnections,
  removePlatformConnection,
  updatePlatformConnectionTokens,
} from "@/utils/platformConnections";
import { uploadScheduledMedia } from "@/utils/mediaStorage";
import {
  deleteContent,
  getContentText,
  listContent,
  saveContent,
  updateContent,
} from "@/utils/contentStore";

const platformIcons = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
};

const platformLabels = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

const dateKey = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
};

const formatScheduleDate = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

const thumbnailRatios = {
  "16:9": { width: 1280, height: 720, label: "16:9" },
  "9:16": { width: 720, height: 1280, label: "9:16" },
};

const loadVideoMetadata = (video) =>
  new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("Could not read video metadata."));
  });

const seekVideo = (video, time) =>
  new Promise((resolve, reject) => {
    video.onseeked = resolve;
    video.onerror = () => reject(new Error("Could not read a thumbnail frame."));
    video.currentTime = time;
  });

const scoreFrame = (context, width, height) => {
  const { data } = context.getImageData(0, 0, width, height);
  let brightness = 0;
  let contrast = 0;

  for (let index = 0; index < data.length; index += 16) {
    const luminance =
      data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    brightness += luminance;
  }

  const samples = data.length / 16;
  const average = brightness / samples;

  for (let index = 0; index < data.length; index += 16) {
    const luminance =
      data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    contrast += Math.abs(luminance - average);
  }

  const balancedLight = 255 - Math.abs(128 - average);
  return balancedLight + contrast / samples;
};

const canvasToBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));

const drawCroppedMedia = (context, source, sourceWidth, sourceHeight, targetWidth, targetHeight) => {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let croppedWidth = sourceWidth;
  let croppedHeight = sourceHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    croppedWidth = sourceHeight * targetRatio;
    sourceX = (sourceWidth - croppedWidth) / 2;
  } else {
    croppedHeight = sourceWidth / targetRatio;
    sourceY = (sourceHeight - croppedHeight) / 2;
  }

  context.drawImage(
    source,
    sourceX,
    sourceY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
};

const buildThumbnailFile = async (canvas, file, ratio, source) => {
  const ratioConfig = thumbnailRatios[ratio] || thumbnailRatios["9:16"];
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error("Could not create a thumbnail.");

  const thumbnailFile = new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "") || "media"}-${ratioConfig.label}-thumbnail.jpg`,
    { type: "image/jpeg" },
  );

  return {
    file: thumbnailFile,
    metadata: {
      name: thumbnailFile.name,
      type: thumbnailFile.type,
      size: thumbnailFile.size,
      previewUrl: URL.createObjectURL(blob),
      ratio,
      source,
      attachedAt: new Date().toISOString(),
    },
  };
};

const generateThumbnailFromImage = async (file, ratio = "9:16") => {
  const ratioConfig = thumbnailRatios[ratio] || thumbnailRatios["9:16"];
  const objectUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.src = objectUrl;

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not read image for thumbnail."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = ratioConfig.width;
    canvas.height = ratioConfig.height;
    const context = canvas.getContext("2d");
    drawCroppedMedia(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      ratioConfig.width,
      ratioConfig.height,
    );

    return buildThumbnailFile(canvas, file, ratio, "auto");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const generateThumbnailFromVideo = async (file, ratio = "9:16") => {
  const ratioConfig = thumbnailRatios[ratio] || thumbnailRatios["9:16"];
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await loadVideoMetadata(video);

    const canvas = document.createElement("canvas");
    canvas.width = ratioConfig.width;
    canvas.height = ratioConfig.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const candidates = [0.12, 0.25, 0.38, 0.52, 0.68, 0.82].map((position) =>
      Math.min(duration - 0.1, Math.max(0, duration * position)),
    );

    let bestFrame = null;
    let bestScore = -Infinity;

    for (const time of candidates) {
      await seekVideo(video, time);

      drawCroppedMedia(
        context,
        video,
        video.videoWidth,
        video.videoHeight,
        ratioConfig.width,
        ratioConfig.height,
      );

      const score = scoreFrame(context, ratioConfig.width, ratioConfig.height);
      if (score > bestScore) {
        bestScore = score;
        bestFrame = context.getImageData(0, 0, ratioConfig.width, ratioConfig.height);
      }
    }

    if (bestFrame) {
      context.putImageData(bestFrame, 0, 0);
    }

    return buildThumbnailFile(canvas, file, ratio, "auto");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const generateThumbnailFromMedia = async (file, ratio = "9:16") => {
  if (file?.type?.startsWith("image/")) {
    return generateThumbnailFromImage(file, ratio);
  }

  if (file?.type?.startsWith("video/")) {
    return generateThumbnailFromVideo(file, ratio);
  }

  return null;
};

const isQueuedOrFailed = (item) =>
  item.status === "scheduled" || item.status === "publish_failed";

const getScheduleStatusLabel = (item) =>
  item.status === "publish_failed" ? "Failed" : "Scheduled";

const ScheduledPost = ({
  title,
  time,
  platform: PlatformIcon,
  status,
  error,
  media,
  onDraft,
  onDelete,
}) => {
  const thumbnailUrl = media?.thumbnail?.publicUrl || media?.thumbnail?.previewUrl;

  return (
  <div className="group flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="h-12 w-12 rounded-xl border border-white/10 object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-blue-500/30 transition-all">
          <PlatformIcon
            size={24}
            className="text-gray-400 group-hover:text-blue-400 transition-all"
          />
        </div>
      )}
      <div className="min-w-0">
        <h4 className="truncate text-sm font-bold">{title}</h4>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{time}</span>
          <span>•</span>
          {media?.type && (
            <>
              <span>{media.type.startsWith("video/") ? "Video" : "Image"}</span>
              <span>•</span>
            </>
          )}
          <span
            className={`font-semibold ${
              status === "Failed"
                ? "text-red-400"
                : status === "Draft"
                  ? "text-orange-400"
                  : "text-blue-400"
            }`}
          >
            {status}
          </span>
        </div>
        {error && (
          <p className="mt-2 line-clamp-2 text-xs text-red-300">{error}</p>
        )}
      </div>
    </div>
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onDraft}
        title="Move to drafts"
        className="p-2 text-gray-600 hover:text-orange-300 rounded-lg transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      <button
        onClick={onDelete}
        title="Delete schedule"
        className="p-2 text-gray-600 hover:text-red-300 rounded-lg transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
  );
};

export default function Scheduler() {
  const { data: user } = useUser();
  const userStateKey = user?.id || user?.email || "guest";
  const [selectedDateValue, setSelectedDateValue] = useUserPersistentState(
    userStateKey,
    "scheduler:selected-date",
    new Date().toISOString(),
  );
  const selectedDate = new Date(selectedDateValue);
  const setSelectedDate = (value) => setSelectedDateValue(new Date(value).toISOString());
  const [title, setTitle] = useUserPersistentState(userStateKey, "scheduler:title", "");
  const [postBody, setPostBody] = useUserPersistentState(userStateKey, "scheduler:body", "");
  const [contentType, setContentType] = useUserPersistentState(userStateKey, "scheduler:content-type", "text");
  const [media, setMedia] = useUserPersistentState(userStateKey, "scheduler:media", null);
  const [mediaFile, setMediaFile] = useState(null);
  const [thumbnail, setThumbnail] = useUserPersistentState(userStateKey, "scheduler:thumbnail", null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailRatio, setThumbnailRatio] = useUserPersistentState(
    userStateKey,
    "scheduler:thumbnail-ratio",
    "",
  );
  const [platform, setPlatform] = useUserPersistentState(userStateKey, "scheduler:platform", "linkedin");
  const [time, setTime] = useUserPersistentState(userStateKey, "scheduler:time", "10:00");
  const [showAll, setShowAll] = useUserPersistentState(userStateKey, "scheduler:show-all", false);
  const [draftNotice, setDraftNotice] = useUserPersistentState(userStateKey, "scheduler:draft-notice", "");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (platform === "youtube" && contentType !== "video") {
      setContentType("video");
    }
  }, [contentType, platform, setContentType]);

  useEffect(() => {
    if (media?.type?.startsWith("video/") && contentType !== "video") {
      setContentType("video");
    }
  }, [contentType, media, setContentType]);

  useEffect(() => {
    const applyDraft = (draft) => {
      if (!draft?.content && !draft?.title) return;

      setTitle(draft.title || draft.topic || "Generated post");
      setPostBody(draft.content || "");
      setPlatform(draft.platform || "linkedin");
      setDraftNotice("Loaded latest generated post from Post Generator");
    };

    const applyLatestDraft = () => applyDraft(readSchedulerDraft());
    applyLatestDraft();

    const frameId = window.requestAnimationFrame(applyLatestDraft);

    const onDraftUpdated = (event) => applyDraft(event.detail);
    window.addEventListener("scheduler-draft-updated", onDraftUpdated);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scheduler-draft-updated", onDraftUpdated);
    };
  }, [setDraftNotice, setPlatform, setPostBody, setTitle, userStateKey]);

  const { data: content = [] } = useQuery({
    queryKey: ["scheduler-content", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listContent(user.id),
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["platform-connections", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listPlatformConnections(user.id),
  });

  const youtubeConnection = connections.find((item) => item.platform === "youtube");
  const selectedConnection = connections.find((item) => item.platform === platform);

  const getYouTubeAuth = async () => {
    if (youtubeConnection?.access_token) {
      return {
        accessToken: youtubeConnection.access_token,
        refreshToken: youtubeConnection.refresh_token || "",
        tokenExpiresAt: youtubeConnection.token_expires_at || "",
      };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      accessToken: session?.provider_token || "",
      refreshToken: session?.provider_refresh_token || "",
      tokenExpiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : "",
    };
  };

  const scheduledPosts = content
    .filter(isQueuedOrFailed)
    .sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

  const selectedDatePosts = scheduledPosts.filter(
    (item) => item.scheduled_at && dateKey(item.scheduled_at) === dateKey(selectedDate),
  );

  const visiblePosts = showAll ? scheduledPosts : scheduledPosts.slice(0, 6);

  const postsThisWeek = scheduledPosts.filter((item) => {
    if (!item.scheduled_at) return false;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const scheduledAt = new Date(item.scheduled_at);
    return scheduledAt >= start && scheduledAt < end;
  }).length;

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      if (scheduledAt < new Date()) {
        throw new Error("Choose a future date and time.");
      }

      const storedMedia =
        mediaFile && (contentType === "image" || contentType === "video")
          ? await uploadScheduledMedia(user.id, mediaFile)
          : null;
      const effectiveThumbnail = await getEffectiveThumbnail();
      const storedThumbnail = effectiveThumbnail?.file
        ? await uploadScheduledMedia(user.id, effectiveThumbnail.file)
        : null;

      const scheduleTitle =
        title.trim() ||
        media?.name?.replace(/\.[^.]+$/, "") ||
        (platform === "youtube" ? "Scheduled YouTube video" : "Scheduled post");

      return saveContent(user.id, {
        title: scheduleTitle,
        type: "post",
        platform,
        generatedText:
          postBody.trim() || `${title}\n\nDraft this post in your brand voice before publishing.`,
        media: {
          ...(storedMedia
            ? {
                ...media,
                preferredRatio: thumbnailRatio || null,
                storageBucket: storedMedia.storageBucket,
                storagePath: storedMedia.storagePath,
                publicUrl: storedMedia.publicUrl,
              }
            : media
              ? { ...media, preferredRatio: thumbnailRatio || null }
              : {}),
          ...(effectiveThumbnail?.metadata
            ? {
                thumbnail: storedThumbnail
                  ? {
                      ...effectiveThumbnail.metadata,
                      storageBucket: storedThumbnail.storageBucket,
                      storagePath: storedThumbnail.storagePath,
                      publicUrl: storedThumbnail.publicUrl,
                    }
                  : effectiveThumbnail.metadata,
              }
            : {}),
        },
        status: "scheduled",
        scheduledAt: scheduledAt.toISOString(),
      });
    },
    onSuccess: () => {
      setTitle("");
      setPostBody("");
      setMedia(null);
      setMediaFile(null);
      setThumbnail(null);
      setThumbnailFile(null);
      setThumbnailRatio("");
      setContentType("text");
      setDraftNotice("");
      clearSchedulerDraft();
      queryClient.invalidateQueries({ queryKey: ["scheduler-content", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content", user?.id] });
      toast.success("Post scheduled");
    },
    onError: (error) => toast.error(error.message || "Could not schedule post"),
  });

  const publishYouTubeMutation = useMutation({
    mutationFn: async () => {
      if (platform !== "youtube") throw new Error("Choose YouTube as the platform first.");
      if (contentType !== "video") throw new Error("Switch to Video mode before publishing.");
      if (!mediaFile) {
        throw new Error(
          "Attach the video again before publishing. Browser preview files cannot be restored after refresh.",
        );
      }

      const auth = await getYouTubeAuth();
      if (!auth.accessToken) {
        throw new Error(
          "YouTube upload permission is missing. Reconnect YouTube from Settings, then try again.",
        );
      }

      const formData = new FormData();
      formData.append("file", mediaFile);
      formData.append("accessToken", auth.accessToken);
      formData.append("refreshToken", auth.refreshToken);
      formData.append("tokenExpiresAt", auth.tokenExpiresAt);
      formData.append("title", title);
      formData.append("body", postBody);
      const effectiveThumbnail = await getEffectiveThumbnail();
      if (effectiveThumbnail?.file) {
        formData.append("thumbnail", effectiveThumbnail.file);
      }

      const response = await fetch("/api/publish/youtube", {
        method: "POST",
        body: formData,
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw Object.assign(
          new Error(
            data?.error ||
              `Could not upload video to YouTube. Server returned ${response.status}.`,
          ),
          {
            needsReconnect: Boolean(data?.needsReconnect),
          },
        );
      }

      return { ...data, effectiveThumbnail };
    },
    onSuccess: async (data) => {
      if (data.accessToken && youtubeConnection?.id) {
        await updatePlatformConnectionTokens(user.id, youtubeConnection.id, {
          accessToken: data.accessToken,
          tokenExpiresAt: data.tokenExpiresAt,
        });
      }

      await saveContent(user.id, {
        title: title || "Published YouTube video",
        type: "video",
        platform: "youtube",
        generatedText: `${postBody || title}\n\nYouTube URL: ${data.url || ""}`,
        media: {
          ...media,
          preferredRatio: thumbnailRatio || null,
          ...(data.effectiveThumbnail?.metadata
            ? { thumbnail: data.effectiveThumbnail.metadata }
            : {}),
          youtubeVideoId: data.videoId,
          youtubeUrl: data.url,
          youtubeThumbnailSet: data.thumbnailSet || false,
        },
        status: "published",
      });

      queryClient.invalidateQueries({ queryKey: ["scheduler-content", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content", user?.id] });
      if (data.thumbnailWarning) {
        toast.warning(data.thumbnailWarning);
      }
      toast.success("Video uploaded to YouTube");
    },
    onError: async (error) => {
      if (error.needsReconnect && youtubeConnection?.id) {
        await removePlatformConnection(user.id, youtubeConnection.id);
        queryClient.invalidateQueries({ queryKey: ["platform-connections", user?.id] });
        toast.error(
          "The saved YouTube connection was invalid, so it was cleared. Reconnect YouTube in Settings and try again.",
        );
        return;
      }

      toast.error(error.message || "Could not publish to YouTube");
    },
  });

  const publishSocialMutation = useMutation({
    mutationFn: async () => {
      if (platform === "youtube") {
        throw new Error("Use the YouTube publish button for YouTube videos.");
      }

      if (!selectedConnection?.access_token || !selectedConnection?.external_account_id) {
        throw new Error(
          `${platformLabels[platform] || platform} is not fully connected. Reconnect it from Settings, then try again.`,
        );
      }

      if (platform === "instagram" && contentType === "text") {
        throw new Error("Instagram publishing needs an image or video.");
      }

      const storedMedia =
        mediaFile && (contentType === "image" || contentType === "video")
          ? await uploadScheduledMedia(user.id, mediaFile)
          : null;
      const publishedMedia = storedMedia
        ? {
            ...media,
            storageBucket: storedMedia.storageBucket,
            storagePath: storedMedia.storagePath,
            publicUrl: storedMedia.publicUrl,
          }
        : media;

      if (
        platform === "instagram" &&
        !(
          publishedMedia?.publicUrl &&
          (publishedMedia?.type?.startsWith("image/") ||
            publishedMedia?.type?.startsWith("video/"))
        )
      ) {
        throw new Error("Instagram needs a stored public image or video URL.");
      }

      const response = await fetch("/api/publish/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          accessToken: selectedConnection.access_token,
          accountId: selectedConnection.external_account_id,
          title,
          body: postBody,
          mediaUrl: publishedMedia?.publicUrl || "",
          mediaType: publishedMedia?.type || "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw Object.assign(
          new Error(
            data?.error ||
              `Could not publish to ${platformLabels[platform] || platform}. Server returned ${response.status}.`,
          ),
          {
            needsReconnect: Boolean(data?.needsReconnect),
          },
        );
      }

      return { ...data, publishedMedia };
    },
    onSuccess: async (data) => {
      const label = platformLabels[platform] || platform;

      await saveContent(user.id, {
        title: title || `Published ${label} post`,
        type: contentType === "video" ? "video" : "post",
        platform,
        generatedText: `${postBody || title}${data.url ? `\n\n${label} URL: ${data.url}` : ""}`,
        media: {
          ...(data.publishedMedia || {}),
          preferredRatio: thumbnailRatio || data.publishedMedia?.preferredRatio || null,
          [`${platform}PostId`]: data.platformPostId,
          [`${platform}Url`]: data.url,
        },
        status: "published",
      });

      queryClient.invalidateQueries({ queryKey: ["scheduler-content", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content", user?.id] });
      toast.success(`Published to ${label}`);
    },
    onError: async (error) => {
      if (error.needsReconnect && selectedConnection?.id) {
        await removePlatformConnection(user.id, selectedConnection.id);
        queryClient.invalidateQueries({ queryKey: ["platform-connections", user?.id] });
        toast.error(
          `${platformLabels[platform] || platform} access expired or is invalid, so it was cleared. Reconnect it in Settings and try again.`,
        );
        return;
      }

      toast.error(error.message || `Could not publish to ${platformLabels[platform] || platform}`);
    },
  });

  const markDraftMutation = useMutation({
    mutationFn: (id) => updateContent(user.id, id, { status: "draft", scheduledAt: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduler-content", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content", user?.id] });
      toast.success("Moved back to drafts");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteContent(user.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduler-content", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content", user?.id] });
      toast.success("Scheduled post deleted");
    },
    onError: () => toast.error("Could not delete scheduled post"),
  });

  const handleSchedule = () => {
    if (!title.trim() && !media?.name) {
      toast.error("Add a post title first");
      return;
    }
    if (!user?.id) {
      toast.error("Please sign in before scheduling posts");
      return;
    }
    if (platform === "youtube" && contentType !== "video") {
      toast.error("YouTube posts need Video mode and a video file.");
      setContentType("video");
      return;
    }
    if (platform === "instagram" && contentType === "text") {
      toast.error("Instagram schedules need Image or Video mode.");
      return;
    }
    if ((contentType === "image" || contentType === "video") && !media?.name) {
      toast.error(`Attach a ${contentType} before scheduling`);
      return;
    }
    if ((contentType === "image" || contentType === "video") && !thumbnailRatio) {
      toast.error("Choose 16:9 or 9:16 for this media post.");
      return;
    }
    scheduleMutation.mutate();
  };

  const getEffectiveThumbnail = async () => {
    if (thumbnailFile && thumbnail?.source !== "auto") {
      return { file: thumbnailFile, metadata: thumbnail };
    }

    if (!mediaFile?.type?.startsWith("image/") && !mediaFile?.type?.startsWith("video/")) {
      return thumbnail ? { file: thumbnailFile, metadata: thumbnail } : null;
    }

    if (!thumbnailRatio) {
      throw new Error("Choose 16:9 or 9:16 for this media post.");
    }

    if (thumbnailFile && thumbnail?.ratio === thumbnailRatio) {
      return { file: thumbnailFile, metadata: thumbnail };
    }

    toast.message("Creating an attention-grabbing thumbnail from your media...");
    const generated = await generateThumbnailFromMedia(mediaFile, thumbnailRatio);
    setThumbnailFile(generated.file);
    setThumbnail(generated.metadata);
    toast.success(
      mediaFile.type.startsWith("video/")
        ? "Best video frame selected as thumbnail"
        : "Image thumbnail prepared for this platform",
    );
    return generated;
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setMediaFile(file);
    setMedia({
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: objectUrl,
      preferredRatio: thumbnailRatio || null,
      attachedAt: new Date().toISOString(),
    });
    toast.success("Media attached");

    if (
      (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
      thumbnailRatio &&
      thumbnail?.source !== "manual"
    ) {
      try {
        const generated = await generateThumbnailFromMedia(file, thumbnailRatio);
        setThumbnailFile(generated.file);
        setThumbnail(generated.metadata);
        toast.success(
          file.type.startsWith("video/")
            ? "Best video frame selected as thumbnail"
            : "Image thumbnail prepared for this platform",
        );
      } catch (error) {
        toast.error(error.message || "Could not create a thumbnail from this media.");
      }
    }
  };

  const handleThumbnailUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the thumbnail");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setThumbnailFile(file);
    setThumbnail({
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: objectUrl,
      ratio: thumbnailRatio || null,
      source: "manual",
      attachedAt: new Date().toISOString(),
    });
    toast.success("Thumbnail attached");
  };

  const handleThumbnailRatioChange = async (ratio) => {
    setThumbnailRatio(ratio);

    if (thumbnail?.source === "manual") {
      setThumbnail({ ...thumbnail, ratio });
      return;
    }

    setMedia((current) => (current ? { ...current, preferredRatio: ratio } : current));

    if (!mediaFile?.type?.startsWith("image/") && !mediaFile?.type?.startsWith("video/")) {
      return;
    }

    try {
      const generated = await generateThumbnailFromMedia(mediaFile, ratio);
      setThumbnailFile(generated.file);
      setThumbnail(generated.metadata);
      toast.success(`${ratio} thumbnail prepared for ${platform}`);
    } catch (error) {
      toast.error(error.message || "Could not create a thumbnail from this media.");
    }
  };

  const platformHint =
    platform === "youtube"
      ? "YouTube scheduling expects a video upload plus title/description."
      : platform === "instagram"
        ? "Instagram works best with an image, carousel, reel, or short video."
        : platform === "linkedin"
          ? "LinkedIn can publish text-only posts or professional image posts."
          : "Facebook supports text, image, and video posts.";

  const firstDayOfMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0,
  ).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDayOfMonth }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="space-y-8 pb-24 sm:space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Content Scheduler 📅
          </h1>
          <p className="text-gray-500 mt-1">
            Plan and manage your upcoming social media posts.
          </p>
        </div>
        <button
          onClick={handleSchedule}
          disabled={scheduleMutation.isPending}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} /> New Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Calendar View (Mock) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold">
                {selectedDate.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1),
                    )
                  }
                  className="p-2 hover:bg-white/5 rounded-lg border border-white/5"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() =>
                    setSelectedDate(
                      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1),
                    )
                  }
                  className="p-2 hover:bg-white/5 rounded-lg border border-white/5"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-7 gap-1 sm:gap-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-bold text-gray-500 uppercase tracking-widest"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-4">
              {calendarCells.map((day, i) => {
                if (!day) {
                  return <div key={`blank-${i}`} className="aspect-square" />;
                }

                const dayDate = new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  day,
                );
                const dayPosts = scheduledPosts.filter(
                  (item) => item.scheduled_at && dateKey(item.scheduled_at) === dateKey(dayDate),
                );
                const hasPost = dayPosts.length > 0;
                const isSelected = selectedDate.toDateString() === dayDate.toDateString();

                return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(dayDate)}
                  className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-transparent text-xs font-medium transition-all hover:border-blue-500/30 hover:bg-blue-500/5 sm:rounded-xl sm:text-sm ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "bg-white/5 text-gray-400"
                  }`}
                >
                  {day}
                  {hasPost && (
                    <div className="mt-1 flex items-center gap-1">
                      <div className="w-1 h-1 bg-blue-400 rounded-full" />
                      <span className="text-[10px] opacity-70">{dayPosts.length}</span>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="mb-5 text-xl font-bold">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </h3>
            <div className="space-y-4">
              {selectedDatePosts.length ? (
                selectedDatePosts.map((item) => (
                  <ScheduledPost
                    key={item.id}
                    title={item.title}
                    time={formatScheduleDate(item.scheduled_at)}
                    platform={platformIcons[item.platform] || Linkedin}
                    status={getScheduleStatusLabel(item)}
                    error={item.publish_error}
                    media={item.media}
                    onDraft={() => markDraftMutation.mutate(item.id)}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/5 bg-black/20 p-5 text-sm text-gray-500">
                  No posts scheduled for this day.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-blue-600/20 bg-blue-600/10 p-5 sm:rounded-3xl sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl">
                <CalendarIcon size={24} className="text-white" />
              </div>
              <div>
                <h4 className="font-bold">Sync Google Calendar</h4>
                <p className="text-sm text-gray-400">
                  Import your events to avoid scheduling conflicts.
                </p>
              </div>
            </div>
            <button className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold hover:bg-white/10 md:w-auto">
              Connect
            </button>
          </div>
        </div>

        {/* Upcoming List */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="text-xl font-bold mb-6">Schedule a Post</h3>
            <div className="space-y-4">
              {draftNotice && (
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300">
                  {draftNotice}
                </div>
              )}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Post title"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-blue-500"
              />
              <textarea
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
                placeholder="Post content or notes"
                className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs font-bold min-[420px]:grid-cols-3">
                {[
                  ["text", FileText, "Text"],
                  ["image", Image, "Image"],
                  ["video", Video, "Video"],
                ].map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (platform === "youtube" && value !== "video") {
                        toast.error("YouTube schedules must use Video mode");
                        setContentType("video");
                        return;
                      }
                      setContentType(value);
                      if (value === "text") {
                        setMedia(null);
                        setMediaFile(null);
                        if (thumbnail?.source === "auto") {
                          setThumbnail(null);
                          setThumbnailFile(null);
                        }
                      }
                    }}
                    disabled={platform === "youtube" && value !== "video"}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition-all ${
                      contentType === value
                        ? "bg-blue-600 text-white"
                        : platform === "youtube" && value !== "video"
                          ? "cursor-not-allowed text-gray-600"
                          : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
              {platform === "youtube" && contentType !== "video" && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-200">
                  YouTube publishing needs a video file. Switch this schedule to Video before publishing.
                </div>
              )}
              {contentType !== "text" && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4">
                  {media?.name ? (
                    <div className="space-y-3">
                      {media.previewUrl && media.type?.startsWith("image/") && (
                        <img
                          src={media.previewUrl}
                          alt={media.name}
                          className="max-h-40 w-full rounded-xl object-cover"
                        />
                      )}
                      {media.previewUrl && media.type?.startsWith("video/") && (
                        <video
                          src={media.previewUrl}
                          controls
                          className="max-h-44 w-full rounded-xl bg-black object-contain"
                        />
                      )}
                      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="truncate text-gray-300">{media.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMedia(null);
                            setMediaFile(null);
                            if (thumbnail?.source === "auto") {
                              setThumbnail(null);
                              setThumbnailFile(null);
                            }
                          }}
                          className="text-red-300 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center gap-3 py-6 text-center text-gray-400 hover:text-white">
                      <input
                        type="file"
                        className="hidden"
                        accept={contentType === "image" ? "image/*" : "video/*"}
                        onChange={handleMediaUpload}
                      />
                      <Upload size={24} />
                      <span className="text-sm font-bold">
                        Attach {contentType === "image" ? "image" : "video"}
                      </span>
                    </label>
                  )}
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
                    <ImagePlus size={16} className="text-blue-300" />
                    Thumbnail
                  </div>
                  {thumbnail?.name && (
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnail(null);
                        setThumbnailFile(null);
                      }}
                      className="text-sm text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1 text-xs font-bold">
                  {Object.keys(thumbnailRatios).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => handleThumbnailRatioChange(ratio)}
                      className={`rounded-lg px-3 py-2 transition-all ${
                        thumbnailRatio === ratio
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
                <p className="mb-4 text-xs text-gray-500">
                  This ratio is saved with image and video posts for every platform.
                </p>
                {thumbnail?.name ? (
                  <div className="space-y-3">
                    {thumbnail.previewUrl && (
                      <img
                        src={thumbnail.previewUrl}
                        alt={thumbnail.name}
                        className={`w-full rounded-xl object-cover ${
                          thumbnail.ratio === "9:16" ? "aspect-[9/16]" : "aspect-video"
                        }`}
                      />
                    )}
                    <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="truncate">{thumbnail.name}</span>
                      <span className="shrink-0 text-xs text-blue-200">
                        {thumbnail.source === "auto" ? "Auto" : "Manual"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 py-5 text-center ${
                      thumbnailRatio
                        ? "cursor-pointer text-gray-400 hover:border-blue-500/30 hover:text-white"
                        : "cursor-not-allowed text-gray-600"
                    }`}
                  >
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      disabled={!thumbnailRatio}
                      onChange={handleThumbnailUpload}
                    />
                    <Upload size={22} />
                    <span className="text-sm font-bold">
                      {thumbnailRatio
                        ? "Add thumbnail image"
                        : "Choose thumbnail ratio first"}
                    </span>
                  </label>
                )}
                {(contentType === "image" || contentType === "video") &&
                  !thumbnail?.name &&
                  thumbnailRatio && (
                  <p className="mt-3 text-xs text-gray-500">
                    If you skip upload, Socialoraa will prepare the best thumbnail automatically.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 px-4 py-3 text-xs text-blue-200">
                {platformHint}
                <span className="mt-1 block text-blue-100/70">
                  Scheduled items publish while this app is open and you are signed in. LinkedIn also requires a connected account with posting permission.
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={platform}
                  onChange={(event) => {
                    const nextPlatform = event.target.value;
                    setPlatform(nextPlatform);
                    if (nextPlatform === "youtube") {
                      setContentType("video");
                    }
                  }}
                  className="rounded-2xl border border-white/10 bg-[#0A0B14] px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                </select>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSchedule}
                disabled={scheduleMutation.isPending}
                className="w-full rounded-2xl bg-blue-600 py-3 font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Schedule for {selectedDate.toLocaleDateString()}
              </button>
              {platform === "youtube" && contentType === "video" && (
                <button
                  onClick={() => publishYouTubeMutation.mutate()}
                  disabled={publishYouTubeMutation.isPending || !mediaFile}
                  className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 py-3 font-bold text-red-100 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishYouTubeMutation.isPending
                    ? "Uploading to YouTube..."
                    : "Publish to YouTube now"}
                </button>
              )}
              {platform !== "youtube" && (
                <button
                  onClick={() => publishSocialMutation.mutate()}
                  disabled={
                    publishSocialMutation.isPending ||
                    (platform === "instagram" && contentType === "text")
                  }
                  className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-3 font-bold text-emerald-100 hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishSocialMutation.isPending
                    ? `Publishing to ${platformLabels[platform] || platform}...`
                    : `Publish to ${platformLabels[platform] || platform} now`}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="text-xl font-bold mb-6">Upcoming Posts</h3>
            <div className="space-y-4">
              {scheduledPosts.length ? (
                visiblePosts.map((item) => (
                  <ScheduledPost
                    key={item.id}
                    title={item.title}
                    time={
                      item.scheduled_at
                        ? formatScheduleDate(item.scheduled_at)
                        : "Unscheduled"
                    }
                    platform={platformIcons[item.platform] || Linkedin}
                    status={getScheduleStatusLabel(item)}
                    error={item.publish_error}
                    media={item.media}
                    onDraft={() => markDraftMutation.mutate(item.id)}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Choose a date and schedule your first post.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowAll((value) => !value)}
              className="w-full mt-10 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm border border-white/10 transition-all"
            >
              {showAll ? "Show Less" : "See All Posts"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="text-xl font-bold mb-4">Quick Stats</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-sm">Posts this week</span>
                <span className="font-bold text-lg">{postsThisWeek}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-sm">Best time to post</span>
                <span className="font-bold text-blue-400">06:00 PM</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-2/3" />
              </div>
              <p className="text-xs text-gray-500">
                You've completed 65% of your weekly goal!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Twitter({ size, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}
