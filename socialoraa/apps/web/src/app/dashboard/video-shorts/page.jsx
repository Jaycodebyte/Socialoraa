import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Upload,
  Link as LinkIcon,
  Scissors,
  Play,
  Download,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  UserSquare2,
  Music2,
  ExternalLink,
  Gauge,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { useUserPersistentState } from "@/utils/usePersistentState";
import { useBackgroundTask } from "@/utils/backgroundTasks";
import { saveContent } from "@/utils/contentStore";
import { checkUsageLimit, recordUsage } from "@/utils/plans";

const StyleCard = ({ label, preview, detail, active, onClick, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-center transition-all sm:p-6 ${
      active
        ? "border-blue-500 bg-blue-500/10 text-blue-400"
        : "border-white/5 bg-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300"
    }`}
  >
    <Icon size={24} />
    {preview && (
      <span className="rounded-lg bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-normal text-white">
        {preview}
      </span>
    )}
    <span className="text-sm font-bold">{label}</span>
    {detail && <span className="text-[11px] font-medium text-gray-500">{detail}</span>}
  </button>
);

const GeneratingPreview = ({ count }) => (
  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:rounded-3xl sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <p className="font-bold text-blue-200">Generating shorts</p>
        <p className="text-xs text-blue-100/60">
          Framing, captions, music, and export are being prepared.
        </p>
      </div>
      <RefreshCcw size={18} className="animate-spin text-blue-300" />
    </div>
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-2">
      {Array.from({ length: Math.min(Math.max(Number(count) || 3, 1), 5) }).map((_, index) => (
        <div
          key={index}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="aspect-[9/16] rounded-xl border border-blue-300/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
            <div className="h-full w-full animate-pulse bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.22),transparent)]" />
          </div>
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-blue-200/20" />
          <div className="mt-2 h-2 w-1/2 animate-pulse rounded-full bg-white/10" />
          <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[video-shimmer_1.35s_infinite] bg-gradient-to-r from-transparent via-white/12 to-transparent" />
        </div>
      ))}
    </div>
  </div>
);

const PROCESSING_STAGES = [
  { at: 8, label: "Preparing source", detail: "Reading your video and settings." },
  { at: 22, label: "Analyzing timeline", detail: "Finding strong short-form moments." },
  { at: 42, label: "Framing clips", detail: "Optimizing vertical composition." },
  { at: 62, label: "Adding captions", detail: "Applying caption style and timing." },
  { at: 78, label: "Rendering exports", detail: "Creating polished 9:16 MP4 clips." },
  { at: 92, label: "Final quality pass", detail: "Sharpening, compressing, and packaging." },
];

const getProcessingStage = (progress) =>
  [...PROCESSING_STAGES].reverse().find((stage) => progress >= stage.at) ||
  PROCESSING_STAGES[0];

const ProcessingProgress = ({ progress, count, quality }) => {
  const stage = getProcessingStage(progress);
  const safeProgress = Math.min(Math.max(Math.round(progress), 0), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="relative overflow-hidden rounded-3xl border border-yellow-300/20 bg-[#090A12] p-5 shadow-2xl shadow-yellow-950/20 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-200/70 to-transparent" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-yellow-200">
            <Sparkles size={16} className="text-yellow-300" />
            Processing
          </div>
          <p className="text-xl font-black text-white">{stage.label}</p>
          <p className="mt-1 text-sm text-gray-400">{stage.detail}</p>
        </div>
        <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-right">
          <p className="text-2xl font-black tabular-nums text-yellow-200">{safeProgress}%</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-100/50">
            complete
          </p>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="rounded-full border-2 border-white bg-black p-1 shadow-inner shadow-black">
          <div className="relative h-7 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500"
              initial={{ width: "0%" }}
              animate={{ width: `${safeProgress}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
            >
              <div className="absolute inset-0 animate-[progress-stripes_0.9s_linear_infinite] bg-[linear-gradient(110deg,rgba(255,255,255,0.18)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0.18)_75%,transparent_75%,transparent)] bg-[length:28px_28px]" />
              <div className="absolute inset-y-0 right-0 w-8 bg-white/35 blur-md" />
            </motion.div>
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
          <span>{count} {count === 1 ? "short" : "shorts"} queued</span>
          <span className="capitalize">{quality} quality</span>
        </div>
      </div>
    </motion.div>
  );
};

const qualityNoticeMessage =
  "Sorry, video quality may not be perfect right now. We are working to enhance the Video to Shorts output quality. Please stay tuned.";

export default function VideoShorts() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const savedJobRef = useRef(null);
  const userStateKey = user?.id || user?.email || "guest";
  const [sourceType, setSourceType] = useUserPersistentState(userStateKey, "video-shorts:source-type", "upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [linkUrl, setLinkUrl] = useUserPersistentState(userStateKey, "video-shorts:link-url", "");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedStyle, setSelectedStyle] = useUserPersistentState(userStateKey, "video-shorts:style", "Viral Bold");
  const [generationMode, setGenerationMode] = useUserPersistentState(userStateKey, "video-shorts:generation-mode", "auto");
  const [clipCount, setClipCount] = useUserPersistentState(userStateKey, "video-shorts:clip-count", 3);
  const [manualStart, setManualStart] = useUserPersistentState(userStateKey, "video-shorts:manual-start", "00:00");
  const [manualEnd, setManualEnd] = useUserPersistentState(userStateKey, "video-shorts:manual-end", "00:30");
  const [frameFocus, setFrameFocus] = useUserPersistentState(userStateKey, "video-shorts:frame-focus", "auto");
  const [musicMode, setMusicMode] = useUserPersistentState(userStateKey, "video-shorts:music-mode", "none");
  const [musicMood, setMusicMood] = useUserPersistentState(userStateKey, "video-shorts:music-mood", "cinematic");
  const [musicVolume, setMusicVolume] = useUserPersistentState(userStateKey, "video-shorts:music-volume", 16);
  const [musicFile, setMusicFile] = useState(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState(null);
  const [renderQuality, setRenderQuality] = useUserPersistentState(
    userStateKey,
    "video-shorts:render-quality",
    "balanced",
  );
  const [result, setResult] = useUserPersistentState(userStateKey, "video-shorts:result", null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const { task: videoTask, runTask, clearTask } = useBackgroundTask("video-shorts");
  const processing = videoTask.status === "running";
  const displayResult = videoTask.result || result;
  const visibleClipCount = generationMode === "auto" ? clipCount : 1;

  useEffect(() => {
    if (!processing) {
      if (videoTask.status === "success") {
        setProcessingProgress(100);
        const timer = window.setTimeout(() => setProcessingProgress(0), 1400);
        return () => window.clearTimeout(timer);
      }
      if (videoTask.status === "error" || videoTask.status === "idle") {
        setProcessingProgress(0);
      }
      return;
    }

    setProcessingProgress((current) => Math.max(current, 8));
    const timer = window.setInterval(() => {
      setProcessingProgress((current) => {
        if (current >= 94) return current;
        const nextStep =
          current < 25 ? 4 :
          current < 55 ? 3 :
          current < 78 ? 2 :
          current < 90 ? 1 :
          0.35;
        return Math.min(current + nextStep, 94);
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [processing, videoTask.status]);

  const persistShortsResult = useCallback(
    async (shortsResult) => {
      if (!user?.id || !shortsResult?.clips?.length) return;

      const jobKey =
        shortsResult.jobId ||
        shortsResult.clips.map((clip) => `${clip.id}:${clip.exportUrl}`).join("|");
      if (savedJobRef.current === jobKey) return;
      savedJobRef.current = jobKey;

      await Promise.all(
        shortsResult.clips.map((clip, index) =>
          saveContent(user.id, {
            title: clip.title || `Short clip ${index + 1}`,
            type: "video",
            platform: "youtube",
            generatedText: `${clip.title || "Generated short"}\n${clip.startTime || ""} - ${
              clip.endTime || ""
            }\n${shortsResult.note || "Generated from Video to Shorts."}`,
            media: {
              type: "video/mp4",
              publicUrl: clip.exportUrl,
              exportUrl: clip.exportUrl,
              source: shortsResult.source,
              jobId: shortsResult.jobId,
              clipId: clip.id,
              startTime: clip.startTime,
              endTime: clip.endTime,
              captionStyle: clip.captionStyle,
              renderQuality: clip.renderQuality || shortsResult.renderQuality,
              generatedBy: "video-shorts",
            },
            status: "draft",
          }),
        ),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-content", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["analytics-content", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-work", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["scheduler-content", user.id] }),
      ]);
    },
    [queryClient, user?.id],
  );

  useEffect(() => {
    if (videoTask.status === "success" && videoTask.result) {
      setResult(videoTask.result);
      persistShortsResult(videoTask.result).catch((error) => {
        savedJobRef.current = null;
        toast.error(error.message || "Shorts were created but could not be saved to dashboard.");
      });
    }
  }, [persistShortsResult, setResult, videoTask.result, videoTask.status]);

  useEffect(() => {
    const showQualityNotice = () => {
      toast.message(qualityNoticeMessage, {
        duration: 7000,
      });
    };
    const timer = window.setInterval(showQualityNotice, 5 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (frameFocus === "speaker") {
      setFrameFocus("auto");
    }
  }, [frameFocus, setFrameFocus]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (musicPreviewUrl) URL.revokeObjectURL(musicPreviewUrl);
    };
  }, [musicPreviewUrl]);

  const onFileUpload = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const localPreview = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(localPreview);
      setVideoUrl(localPreview);
      setResult(null);
      clearTask();
      toast.success("Video ready for processing");
    },
    [clearTask, setPreviewUrl, setResult, setSelectedFile, setVideoUrl],
  );

  const handleConvert = async () => {
    if (sourceType === "upload" && !selectedFile) {
      return toast.error("Please upload a video first");
    }

    if (sourceType === "link" && !linkUrl.trim()) {
      return toast.error("Please paste a video link first");
    }

    const usage = checkUsageLimit(user, "videoShorts", clipCount);
    if (!usage.allowed) return toast.error(usage.message);

    setProcessingProgress(8);
    runTask(async () => {
      let response;
      if (sourceType === "upload" || musicFile) {
        const formData = new FormData();
        if (sourceType === "upload") {
          formData.append("file", selectedFile);
        } else {
          formData.append("videoUrl", linkUrl.trim());
        }
        formData.append("captionStyle", selectedStyle);
        formData.append("clipCount", String(clipCount));
        formData.append("generationMode", generationMode);
        formData.append("manualStart", manualStart);
        formData.append("manualEnd", manualEnd);
        formData.append("frameFocus", frameFocus);
        formData.append("musicMode", musicMode);
        formData.append("musicMood", musicMood);
        formData.append("musicVolume", String(musicVolume / 100));
        formData.append("renderQuality", renderQuality);
        if (musicFile) {
          formData.append("musicFile", musicFile);
        }
        response = await fetch("/api/video/shorts", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/video/shorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: linkUrl,
            captionStyle: selectedStyle,
            clipCount,
            generationMode,
            manualStart,
            manualEnd,
            frameFocus,
            musicMode,
            musicMood,
            musicVolume: musicVolume / 100,
            renderQuality,
          }),
        });
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create shorts");
      }
      setProcessingProgress(100);
      recordUsage(user, "videoShorts", data.clips?.length || clipCount);
      toast.success("Video converted to shorts!");
      return data;
    }, {
      message: "Creating shorts in the background...",
      successMessage: "Shorts ready",
    }).catch((error) => {
      const message =
        error instanceof TypeError && error.message === "Failed to fetch"
          ? "Cannot reach the video processor. Restart the SocialMedia dev server and try again."
          : error.message || "Could not create shorts";
      toast.error(message);
    });
  };

  const styles = [
    { label: "Minimalist", icon: CheckCircle2, preview: "Clean caption", detail: "White text" },
    { label: "Viral Bold", icon: Play, preview: "This is huge", detail: "Yellow active text" },
    { label: "Modern Box", icon: Scissors, preview: "Key moment", detail: "Boxed caption" },
    { label: "IG Reel Style", icon: FileVideo, preview: "Real talk", detail: "Reel style" },
  ];

  const focusModes = [
    { value: "auto", label: "Auto follow" },
    { value: "fit", label: "Full frame HQ" },
    { value: "center", label: "Center" },
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ];

  const musicMoods = [
    {
      value: "cinematic",
      label: "Cinematic",
      query: "cinematic inspiring background music",
    },
    {
      value: "energetic",
      label: "Energetic",
      query: "energetic upbeat vlog background music",
    },
    {
      value: "emotional",
      label: "Emotional",
      query: "emotional piano background music",
    },
    {
      value: "suspense",
      label: "Suspense",
      query: "suspense tension sound effect background music",
    },
  ];

  const selectedMusicMood =
    musicMoods.find((mood) => mood.value === musicMood) || musicMoods[0];
  const pixabayMusicUrl = `https://pixabay.com/music/search/${encodeURIComponent(
    selectedMusicMood.query,
  )}/`;

  const onMusicUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Choose an audio file for background music");
      return;
    }

    setMusicFile(file);
    setMusicPreviewUrl(URL.createObjectURL(file));
    setMusicMode("upload");
    setResult(null);
    clearTask();
    toast.success("Background music ready");
  };

  const qualityModes = [
    {
      value: "fast",
      label: "Fast",
      detail: "Quick draft",
    },
    {
      value: "balanced",
      label: "Balanced",
      detail: "HQ default",
    },
    {
      value: "premium",
      label: "Premium",
      detail: "Best quality",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Video to Shorts ✂️
        </h1>
        <p className="text-gray-500">
          Automatically trim and format your videos for vertical platforms.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-300" />
        <p>{qualityNoticeMessage}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
        <div className="space-y-8">
          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-bold text-lg">1. Add Video Source</h3>
              <div className="grid w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm font-bold sm:w-auto">
                <button
                  onClick={() => {
                    setSourceType("upload");
                    setResult(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition-all ${
                    sourceType === "upload" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Upload size={16} /> Upload
                </button>
                <button
                  onClick={() => {
                    setSourceType("link");
                    setResult(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 transition-all ${
                    sourceType === "link" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <LinkIcon size={16} /> Link
                </button>
              </div>
            </div>

            {sourceType === "upload" && !videoUrl ? (
              <label className="group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/10 p-8 transition-all hover:bg-white/5 sm:p-12">
                <input
                  type="file"
                  className="hidden"
                  accept="video/*"
                  onChange={onFileUpload}
                />
                <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="font-bold">Click to upload</p>
                  <p className="text-sm text-gray-500">MP4, MOV up to 50MB</p>
                </div>
              </label>
            ) : sourceType === "upload" ? (
              <div className="relative group rounded-2xl overflow-hidden bg-black/40 aspect-video flex items-center justify-center">
                <video
                  src={previewUrl || videoUrl}
                  className="w-full h-full object-contain"
                  controls
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoUrl(null);
                    setPreviewUrl(null);
                    setResult(null);
                    clearTask();
                  }}
                  className="absolute top-4 right-4 p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <label className="mb-3 block text-sm font-semibold text-gray-400">
                    Paste a long video link
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={linkUrl}
                      onChange={(event) => {
                        setLinkUrl(event.target.value);
                        setResult(null);
                        clearTask();
                      }}
                      placeholder="https://youtu.be/... or direct MP4 link"
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none transition-all focus:border-blue-500"
                    />
                    <button
                      onClick={() => linkUrl.trim() && toast.success("Link ready for processing")}
                      className="rounded-2xl bg-white/5 px-5 py-3 font-bold text-gray-300 hover:bg-white/10"
                    >
                      Use Link
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Supports public YouTube links and direct MP4/MOV/WebM video URLs.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg">2. Choose Cut Mode</h3>
            <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm font-bold">
              <button
                onClick={() => {
                  setGenerationMode("auto");
                  setResult(null);
                  clearTask();
                }}
                className={`rounded-xl px-4 py-3 transition-all ${
                  generationMode === "auto" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Auto shorts
              </button>
              <button
                onClick={() => {
                  setGenerationMode("manual");
                  setResult(null);
                  clearTask();
                }}
                className={`rounded-xl px-4 py-3 transition-all ${
                  generationMode === "manual" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                Manual cut
              </button>
            </div>

            {generationMode === "auto" ? (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-400">
                  Number of shorts
                </label>
                <select
                  value={clipCount}
                  onChange={(event) => {
                    setClipCount(Number(event.target.value));
                    setResult(null);
                    clearTask();
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-[#0A0B14] px-4 py-3 outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? "short" : "shorts"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-400">
                    Start time
                  </label>
                  <input
                    value={manualStart}
                    onChange={(event) => {
                      setManualStart(event.target.value);
                      setResult(null);
                      clearTask();
                    }}
                    placeholder="00:15"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-400">
                    End time
                  </label>
                  <input
                    value={manualEnd}
                    onChange={(event) => {
                      setManualEnd(event.target.value);
                      setResult(null);
                      clearTask();
                    }}
                    placeholder="01:00"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg">3. Frame the Character</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {focusModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setFrameFocus(mode.value);
                    setResult(null);
                    clearTask();
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                    frameFocus === mode.value
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-white/5 bg-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  <UserSquare2 size={16} />
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Auto follow samples the clip and frames the strongest speaking subject. Use Full frame HQ when you want the whole scene visible.
            </p>
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg">4. Choose Caption Style</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {styles.map((style) => (
                <StyleCard
                  key={style.label}
                  label={style.label}
                  preview={style.preview}
                  detail={style.detail}
                  icon={style.icon}
                  active={selectedStyle === style.label}
                  onClick={() => {
                    setSelectedStyle(style.label);
                    setResult(null);
                    clearTask();
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg">5. Add Background Music</h3>
            <div className="grid grid-cols-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm font-bold min-[420px]:grid-cols-3">
              {[
                ["none", "None"],
                ["suggest", "Suggest"],
                ["upload", "Upload"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                      setMusicMode(value);
                      setResult(null);
                      clearTask();
                    }}
                  className={`rounded-xl px-3 py-2 transition-all ${
                    musicMode === value
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {musicMode !== "none" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {musicMoods.map((mood) => (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => {
                        setMusicMood(mood.value);
                        setResult(null);
                        clearTask();
                      }}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                        musicMood === mood.value
                          ? "border-blue-500 bg-blue-500/10 text-blue-300"
                          : "border-white/5 bg-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300"
                      }`}
                    >
                      <Music2 size={16} />
                      {mood.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-300">
                      Music volume
                    </span>
                    <span className="text-sm font-bold text-blue-300">
                      {musicVolume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="32"
                    value={musicVolume}
                    onChange={(event) => {
                      setMusicVolume(Number(event.target.value));
                      setResult(null);
                      clearTask();
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {musicMode === "suggest" && (
              <a
                href={pixabayMusicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-200 hover:bg-blue-500/20"
              >
                Find free {selectedMusicMood.label.toLowerCase()} music on Pixabay
                <ExternalLink size={16} />
              </a>
            )}

            {musicMode === "upload" && (
              <div className="space-y-4">
                {musicFile ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-gray-300">
                        {musicFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMusicFile(null);
                          setMusicPreviewUrl(null);
                          setResult(null);
                          clearTask();
                        }}
                        className="text-sm text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                    {musicPreviewUrl && <audio src={musicPreviewUrl} controls className="w-full" />}
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 py-6 text-center text-gray-400 hover:border-blue-500/30 hover:text-white">
                    <input
                      type="file"
                      className="hidden"
                      accept="audio/*"
                      onChange={onMusicUpload}
                    />
                    <Music2 size={24} />
                    <span className="text-sm font-bold">Upload MP3, WAV, or M4A</span>
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg">6. Export Quality</h3>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
              {qualityModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setRenderQuality(mode.value);
                    setResult(null);
                    clearTask();
                  }}
                  className={`rounded-2xl border px-3 py-4 text-center transition-all ${
                    renderQuality === mode.value
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-white/5 bg-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  <Gauge size={18} className="mx-auto mb-2" />
                  <span className="block text-sm font-bold">{mode.label}</span>
                  <span className="mt-1 block text-[11px]">{mode.detail}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Balanced now uses HQ sharpening, color correction, and slower compression. Premium uses the highest quality render and may take longer.
            </p>
          </div>
        </div>

        <div className="space-y-8 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <div>
              <h3 className="font-bold text-lg mb-6">7. Process & Export</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2
                    size={20}
                    className={(sourceType === "upload" ? selectedFile : linkUrl.trim()) ? "text-blue-500" : "text-gray-600"}
                  />
                  <span className={(sourceType === "upload" ? selectedFile : linkUrl.trim()) ? "text-white" : "text-gray-600"}>
                    {sourceType === "upload" ? "Video Uploaded" : "Video Link Added"}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2 size={20} className="text-blue-500" />
                  <span className="text-white">
                    {generationMode === "auto" ? `${clipCount} auto ${clipCount === 1 ? "short" : "shorts"}` : `${manualStart} - ${manualEnd}`}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2 size={20} className="text-blue-500" />
                  <span className="text-white">Captions: {selectedStyle}</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2 size={20} className="text-blue-500" />
                  <span className="text-white">
                    Frame: {focusModes.find((mode) => mode.value === frameFocus)?.label || "Auto follow"}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <CheckCircle2
                    size={20}
                    className={musicMode === "upload" && !musicFile ? "text-gray-600" : "text-blue-500"}
                  />
                  <span className={musicMode === "upload" && !musicFile ? "text-gray-600" : "text-white"}>
                    Music: {musicMode === "none"
                      ? "None"
                      : musicMode === "upload"
                        ? musicFile?.name || "Upload needed"
                        : `${selectedMusicMood.label} suggestion`}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <AlertCircle size={20} className="text-orange-400" />
                  <span className="text-gray-400 text-sm">
                    Output: {qualityModes.find((mode) => mode.value === renderQuality)?.label || "Balanced"} 9:16 vertical
                  </span>
                </div>
              </div>
            </div>

          <div className="mt-8 space-y-4">
              <button
                onClick={handleConvert}
                disabled={
                  processing ||
                  (sourceType === "upload" ? !selectedFile : !linkUrl.trim()) ||
                  (musicMode === "upload" && !musicFile)
                }
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 text-base font-bold shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-50 sm:text-lg"
              >
                {processing ? (
                  <RefreshCcw className="animate-spin" />
                ) : (
                  <Scissors size={20} />
                )}
                {processing ? "Creating shorts..." : "Create Shorts"}
              </button>

            </div>
          </div>

          {processing && (
            <ProcessingProgress
              progress={processingProgress}
              count={visibleClipCount}
              quality={renderQuality}
            />
          )}

          {displayResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:rounded-3xl sm:p-6"
            >
              <p className="text-emerald-400 font-bold mb-4">
                Export Ready!
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {displayResult.clips?.map((clip) => (
                  <div key={clip.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <video src={clip.exportUrl} controls className="aspect-[9/16] max-h-80 w-full rounded-xl bg-black object-contain" />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold">{clip.title}</p>
                        <p className="text-xs text-gray-500">
                          {clip.startTime} - {clip.endTime} · {clip.captionStyle}
                        </p>
                      </div>
                      <a
                        href={clip.exportUrl}
                        download
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700"
                      >
                        <Download size={16} /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {processing && !displayResult && (
            <GeneratingPreview count={visibleClipCount} />
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes video-shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes progress-stripes {
          100% {
            background-position: 28px 0;
          }
        }
      `}</style>
    </div>
  );
}
