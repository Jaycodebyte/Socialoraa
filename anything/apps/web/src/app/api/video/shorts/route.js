import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { trackSpeakerCrop } from "./faceTracker";

const execFileAsync = promisify(execFile);

function timestamp(totalSeconds) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function secondsFromTimestamp(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(value, 0) : 0;
  }

  const clean = String(value || "").trim();
  if (!clean) return 0;

  if (/^\d+(\.\d+)?$/.test(clean)) {
    return Math.max(Number(clean), 0);
  }

  const parts = clean.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;

  if (parts.length === 2) {
    return Math.max(parts[0] * 60 + parts[1], 0);
  }

  if (parts.length === 3) {
    return Math.max(parts[0] * 3600 + parts[1] * 60 + parts[2], 0);
  }

  return 0;
}

function getToolError(error, fallback) {
  const details = [error?.stderr, error?.stdout, error?.message]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    details.find((line) => line.startsWith("ERROR:")) ||
    details.find((line) => /Invalid argument|Error while|Failed to|No such filter|Cannot find|Option not found|Unable to parse|Error initializing/i.test(line)) ||
    details.find((line) => /private|unavailable|sign in|copyright|blocked|restricted|not available/i.test(line)) ||
    details.at(-1) ||
    fallback
  );
}

async function findCommand(command, envName) {
  if (process.env[envName]) return process.env[envName];

  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  try {
    const { stdout } = await execFileAsync(lookupCommand, [command], { windowsHide: true });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || "";
  } catch {
    return "";
  }
}

async function downloadVideo(videoUrl, targetFile) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Unable to download uploaded video. Server returned ${response.status}.`);
  }

  await writeFile(targetFile, Buffer.from(await response.arrayBuffer()));
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

function validateSourceLink(sourceUrl) {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Paste a valid video URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Video link must start with http:// or https://.");
  }

  const directVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url.pathname);
  const isYouTube = /(^|\.)youtube\.com$/i.test(url.hostname) || /^youtu\.be$/i.test(url.hostname);
  if (!directVideo && !isYouTube) {
    throw new Error("Use a public YouTube link or a direct MP4/MOV/WebM video URL.");
  }

  if (isYouTube && !/^[a-zA-Z0-9_-]{11}$/.test(getYouTubeVideoId(sourceUrl))) {
    throw new Error("This YouTube link looks incomplete. Open the video and copy the full Share link.");
  }

  return { directVideo };
}

async function downloadWithYtDlp(sourceUrl, workDir, ytDlpPath, nodePath) {
  const outputTemplate = path.join(workDir, "source.%(ext)s");
  const nodeDir = nodePath ? path.dirname(nodePath) : "";
  const env = {
    ...process.env,
    PATH: nodeDir ? `${nodeDir}${path.delimiter}${process.env.PATH || ""}` : process.env.PATH,
  };
  const jsRuntimeArgs = nodePath ? ["--js-runtimes", `node:${nodePath}`] : [];

  try {
    await execFileAsync(
      ytDlpPath,
      [
        "--no-playlist",
        ...jsRuntimeArgs,
        "--extractor-args",
        "youtube:player_client=android,web",
        "-f",
        "bv*+ba/b[ext=mp4]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        outputTemplate,
        sourceUrl,
      ],
      { env, maxBuffer: 1024 * 1024 * 8, timeout: 1000 * 60 * 2, windowsHide: true },
    );
  } catch (error) {
    const details = getToolError(error, "Check that the link is public and accessible.");
    if (details.toLowerCase().includes("javascript runtime")) {
      throw new Error("YouTube download needs a JavaScript runtime. Restart the dev server so SocialMedia can detect Node, then try again.");
    }
    throw new Error(
      `Could not download this YouTube link. Make sure the video is public and not age-restricted, private, members-only, live-only, region-blocked, or removed. Try the full youtube.com/watch URL, or upload the video file directly. Details: ${details}`,
    );
  }

  const files = await readdir(workDir);
  const sourceFile = files.find((file) => file.startsWith("source."));
  if (!sourceFile) {
    throw new Error("The downloader finished but no source video file was created.");
  }

  return path.join(workDir, sourceFile);
}

async function getVideoDuration(ffmpegPath, sourceFile) {
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        sourceFile,
      ],
      { windowsHide: true },
    );

    const duration = Number(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 180;
  } catch {
    return 180;
  }
}

async function getVideoDimensions(ffmpegPath, sourceFile) {
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0:s=x",
        sourceFile,
      ],
      { windowsHide: true },
    );

    const [width, height] = stdout.trim().split("x").map(Number);
    return {
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function hasAudioStream(ffmpegPath, sourceFile) {
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        sourceFile,
      ],
      { windowsHide: true },
    );

    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

function buildClips(count, totalDuration) {
  const safeTotal = Number(totalDuration);
  if (!Number.isFinite(safeTotal) || safeTotal < 3) {
    throw new Error("Video must be at least 3 seconds long.");
  }

  const requestedCount = clampNumber(Math.floor(Number(count) || 3), 1, 5);
  const usefulCount = Math.min(requestedCount, Math.max(1, Math.floor(safeTotal / 3)));
  const clipDuration = clampNumber(
    Math.floor(safeTotal / Math.min(usefulCount + 1, 4)),
    Math.min(3, safeTotal),
    Math.min(45, safeTotal),
  );
  const maxStart = Math.max(safeTotal - clipDuration, 0);
  const starts =
    usefulCount === 1
      ? [Math.floor(maxStart * 0.18)]
      : Array.from({ length: usefulCount }, (_, index) =>
          Math.floor((maxStart * index) / Math.max(usefulCount - 1, 1)),
        );
  const titles = ["Hook clip", "Key insight clip", "Best moment clip", "Story beat clip", "Quote clip"];

  return starts.map((start, index) => ({
    id: `clip_${index + 1}`,
    title: titles[index],
    startTime: timestamp(start),
    endTime: timestamp(Math.min(start + clipDuration, safeTotal)),
    duration: timestamp(clipDuration),
    cropFocus: "auto",
    renderStatus: "ready",
  }));
}

function buildManualClip(startInput, endInput, totalDuration) {
  const start = secondsFromTimestamp(startInput);
  const requestedEnd = secondsFromTimestamp(endInput);
  const safeTotal = Number(totalDuration);

  if (!Number.isFinite(safeTotal) || safeTotal < 3) {
    throw new Error("Video must be at least 3 seconds long.");
  }

  if (start >= safeTotal) {
    throw new Error("Manual start time is outside the video duration.");
  }

  if (requestedEnd <= start) {
    throw new Error("Manual end time must be after the start time.");
  }

  const end = Math.min(requestedEnd, safeTotal);
  const duration = end - start;

  if (duration < 3) {
    throw new Error("Manual clip must be at least 3 seconds long.");
  }

  return [
    {
      id: "manual_clip_1",
      title: "Manual cut",
      startTime: timestamp(start),
      endTime: timestamp(end),
      duration: timestamp(duration),
      cropFocus: "auto",
      renderStatus: "ready",
    },
  ];
}

function normalizeFrameFocus(value) {
  return ["auto", "fit", "speaker", "center", "left", "right"].includes(value)
    ? value
    : "auto";
}

function applyFrameFocus(clips, frameFocus) {
  const focus = normalizeFrameFocus(frameFocus);
  return clips.map((clip) => ({ ...clip, cropFocus: focus }));
}

async function analyzeClipFocus(ffmpegPath, sourceFile, clip) {
  try {
    return await trackSpeakerCrop(ffmpegPath, sourceFile, clip);
  } catch {
    return "center";
  }
}

async function applySmartFrameFocus(ffmpegPath, sourceFile, clips, frameFocus, dimensions = {}) {
  const focus = normalizeFrameFocus(frameFocus);
  if (focus !== "auto") {
    return applyFrameFocus(clips, focus);
  }

  const aspectRatio =
    dimensions.width && dimensions.height ? dimensions.width / dimensions.height : 0;
  if (aspectRatio > 0 && aspectRatio <= 0.75) {
    return applyFrameFocus(clips, "fit").map((clip) => ({
      ...clip,
      autoFramed: true,
      autoFrameReason: "portrait_source",
    }));
  }

  const analyzed = [];
  for (const clip of clips) {
    const focusResult = await analyzeClipFocus(ffmpegPath, sourceFile, clip);
    analyzed.push({
      ...clip,
      cropFocus:
        typeof focusResult === "object" && focusResult.mode
          ? focusResult.mode
          : focusResult,
      cropXRatio:
        typeof focusResult === "object" ? focusResult.cropXRatio : undefined,
      cropXExpression:
        typeof focusResult === "object" ? focusResult.cropXExpression : undefined,
      autoFrameConfidence:
        typeof focusResult === "object" ? focusResult.confidence : undefined,
      trackingSamples:
        typeof focusResult === "object" ? focusResult.trackingSamples : undefined,
      autoFramed: true,
    });
  }
  return analyzed;
}

function getRenderSettings(renderQuality) {
  if (renderQuality === "fast") {
    return {
      preset: "faster",
      crf: "18",
      maxrate: "14M",
      bufsize: "28M",
      sharpen: "hqdn3d=0.8:0.7:4:3,unsharp=5:5:0.55:3:3:0.16",
      color: "eq=contrast=1.08:saturation=1.12:brightness=0.012",
    };
  }

  if (renderQuality === "premium") {
    return {
      preset: "veryslow",
      crf: "14",
      maxrate: "28M",
      bufsize: "56M",
      sharpen: "hqdn3d=1.1:1.0:6:5,unsharp=5:5:0.9:5:5:0.22",
      color: "eq=contrast=1.12:saturation=1.18:brightness=0.018",
    };
  }

  return {
    preset: "slow",
    crf: "16",
    maxrate: "20M",
    bufsize: "40M",
    sharpen: "hqdn3d=0.95:0.85:5:4,unsharp=5:5:0.72:3:3:0.18",
    color: "eq=contrast=1.1:saturation=1.15:brightness=0.015",
  };
}

function getCropFilter(focus, settings, cropXRatio, cropXExpression) {
  const xByFocus = {
    left: "(iw-ow)*0.08",
    center: "(iw-ow)/2",
    right: "(iw-ow)*0.92",
    speaker: "(iw-ow)/2",
  };
  const numericCropRatio = Number(cropXRatio);
  const x = cropXExpression
    ? cropXExpression
    : Number.isFinite(numericCropRatio)
    ? `(iw-ow)*${clampNumber(numericCropRatio, 0, 1).toFixed(3)}`
    : xByFocus[focus] || xByFocus.speaker;

  return [
    "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos",
    `crop=1080:1920:${x}:max(0\\,(ih-oh)*0.38)`,
    settings.sharpen,
    settings.color,
    "format=yuv420p",
  ].join(",");
}

function getFitFrameGraph(settings, captionFilter) {
  return [
    "[0:v]split=2[bgsrc][fgsrc]",
    "[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920:(iw-ow)/2:(ih-oh)/2,boxblur=22:2,eq=contrast=1.04:saturation=1.1:brightness=-0.015[bg]",
    `[fgsrc]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0,${settings.sharpen},${settings.color},format=yuva420p[fg]`,
    `[bg][fg]overlay=0:0,format=yuv420p,${captionFilter}[v]`,
  ].join(";");
}

function getVideoGraph(clip, settings, captionFilter) {
  if (clip.cropFocus === "fit") {
    return getFitFrameGraph(settings, captionFilter);
  }

  return `[0:v]${getCropFilter(clip.cropFocus, settings, clip.cropXRatio, clip.cropXExpression)},${captionFilter}[v]`;
}

function escapeDrawText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\r?\n/g, " ");
}

function escapeDrawTextPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:");
}

function getCaptionFontOption() {
  const candidates =
    process.platform === "win32"
      ? [
          "C:/Windows/Fonts/Nirmala.ttc",
          "C:/Windows/Fonts/arial.ttf",
          "C:/Windows/Fonts/segoeui.ttf",
        ]
      : [
          "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
          "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ];

  const fontFile = candidates.find((candidate) => existsSync(candidate));
  return fontFile ? `fontfile='${escapeDrawTextPath(fontFile)}'` : "";
}

function cleanCaptionText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 120);
}

async function extractAudioForCaption(ffmpegPath, sourceFile, clip, targetFile) {
  const durationSeconds = Math.max(secondsFromTimestamp(clip.endTime) - secondsFromTimestamp(clip.startTime), 3);
  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-ss",
      clip.startTime,
      "-i",
      sourceFile,
      "-t",
      String(Math.min(durationSeconds, 45)),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      targetFile,
    ],
    { maxBuffer: 1024 * 1024 * 4, timeout: 1000 * 45, windowsHide: true },
  );
}

async function transcribeCaptionText(ffmpegPath, sourceFile, clip, workDir) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return "";

  const audioFile = path.join(workDir, `${clip.id}-caption.mp3`);
  try {
    await extractAudioForCaption(ffmpegPath, sourceFile, clip, audioFile);
    const audioBuffer = await readFile(audioFile);
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "caption.mp3");
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "json");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) return "";

    const data = await response.json();
    return cleanCaptionText(data?.text);
  } catch {
    return "";
  }
}

function getCaptionFilter(clip, captionStyle) {
  const captionText = cleanCaptionText(clip.captionText);
  if (!captionText) return "null";

  const isViral = captionStyle === "Viral Bold";
  const safeText = escapeDrawText(isViral ? captionText.toUpperCase() : captionText);
  const fontOption = getCaptionFontOption();
  const base = [
    fontOption,
    `text='${safeText}'`,
    "x=(w-text_w)/2",
    "y=h-360",
    "fontsize=56",
    "line_spacing=10",
  ].filter(Boolean);

  if (captionStyle === "Minimalist") {
    return `drawtext=${[
      ...base,
      "fontcolor=white",
      "borderw=4",
      "bordercolor=black@0.85",
    ].join(":")}`;
  }

  if (captionStyle === "Modern Box") {
    return `drawtext=${[
      ...base,
      "fontcolor=white",
      "box=1",
      "boxcolor=black@0.58",
      "boxborderw=26",
    ].join(":")}`;
  }

  if (captionStyle === "IG Reel Style") {
    return `drawtext=${[
      ...base,
      "fontsize=50",
      "fontcolor=white",
      "borderw=3",
      "bordercolor=black@0.75",
      "box=1",
      "boxcolor=black@0.28",
      "boxborderw=18",
    ].join(":")}`;
  }

  return `drawtext=${[
    ...base,
    "fontcolor=0xFFE45E",
    "borderw=5",
    "bordercolor=black@0.9",
    "shadowcolor=black@0.6",
    "shadowx=3",
    "shadowy=3",
  ].join(":")}`;
}

function buildMusicFilter(durationSeconds, musicVolume, sourceHasAudio) {
  const safeVolume = Math.min(Math.max(Number(musicVolume) || 0.16, 0.04), 0.4);
  const fadeOutStart = Math.max((Number(durationSeconds) || 30) - 1.2, 0);
  const musicFilter = `[1:a]volume=${safeVolume.toFixed(2)},afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=1.2[music]`;

  if (!sourceHasAudio) {
    return `${musicFilter};[music]anull[a]`;
  }

  return `[0:a]volume=1.0[voice];${musicFilter};[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]`;
}

async function renderClip(ffmpegPath, sourceFile, targetFile, clip, captionStyle, options = {}) {
  const durationParts = clip.duration.split(":").map(Number);
  const durationSeconds = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
  const sourceHasAudio = await hasAudioStream(ffmpegPath, sourceFile);
  const renderSettings = getRenderSettings(options.renderQuality);
  const commonOutputArgs = [
    "-c:v",
    "libx264",
    "-preset",
    renderSettings.preset,
    "-crf",
    renderSettings.crf,
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-pix_fmt",
    "yuv420p",
    "-maxrate",
    renderSettings.maxrate,
    "-bufsize",
    renderSettings.bufsize,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    targetFile,
  ];

  const buildArgs = (videoGraph) => {
    const durationArg = String(Math.max(durationSeconds || 30, 10));
    const musicFile = options.musicFile || "";
    return musicFile
      ? [
        "-y",
        "-ss",
        clip.startTime,
        "-i",
        sourceFile,
        "-stream_loop",
        "-1",
        "-i",
        musicFile,
        "-t",
        durationArg,
        "-filter_complex",
        `${videoGraph};${buildMusicFilter(durationSeconds, options.musicVolume, sourceHasAudio)}`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        ...commonOutputArgs,
      ]
      : [
          "-y",
          "-ss",
          clip.startTime,
          "-i",
          sourceFile,
          "-t",
          durationArg,
          "-filter_complex",
          videoGraph,
          "-map",
          "[v]",
          ...(sourceHasAudio ? ["-map", "0:a?"] : ["-an"]),
          ...commonOutputArgs,
        ];
  };

  const runRender = async (renderClipInput) => {
    const videoGraph = getVideoGraph(
      renderClipInput,
      renderSettings,
      getCaptionFilter(renderClipInput, captionStyle),
    );
    await execFileAsync(
      ffmpegPath,
      buildArgs(videoGraph),
      { maxBuffer: 1024 * 1024 * 8, timeout: 1000 * 60 * 3, windowsHide: true },
    );
  };

  try {
    await runRender(clip);
  } catch (error) {
    if (clip.cropXExpression) {
      try {
        await runRender({ ...clip, cropXExpression: undefined });
        return;
      } catch (fallbackError) {
        throw new Error(
          `FFmpeg could not render ${clip.title}. ${getToolError(
            fallbackError,
            "Check the video duration and format.",
          )}`,
        );
      }
    }

    throw new Error(`FFmpeg could not render ${clip.title}. ${getToolError(error, "Check the video duration and format.")}`);
  }
}

export async function POST(request) {
  const jobId = randomUUID();
  const workDir = path.join(process.cwd(), ".media-work", jobId);
  const exportDir = path.join(process.cwd(), "public", "exports", jobId);

  try {
    const ffmpegPath = await findCommand("ffmpeg", "FFMPEG_PATH");
    if (!ffmpegPath) {
      return Response.json({ error: "FFmpeg is required for real shorts rendering. Add FFMPEG_PATH to .env." }, { status: 400 });
    }

    await mkdir(workDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });

    let source = "";
    let sourceFile = path.join(workDir, "source.mp4");
    let captionStyle = "Viral Bold";
    let clipCount = 3;
    let generationMode = "auto";
    let manualStart = "00:00";
    let manualEnd = "00:30";
    let frameFocus = "auto";
    let musicFile = "";
    let musicMode = "none";
    let musicMood = "cinematic";
    let musicVolume = 0.16;
    let renderQuality = "balanced";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const uploadedMusic = formData.get("musicFile");
      const sourceUrl = String(formData.get("videoUrl") || "").trim();
      captionStyle = String(formData.get("captionStyle") || "Viral Bold");
      clipCount = Number(formData.get("clipCount") || 3);
      generationMode = String(formData.get("generationMode") || "auto");
      manualStart = String(formData.get("manualStart") || "00:00");
      manualEnd = String(formData.get("manualEnd") || "00:30");
      frameFocus = String(formData.get("frameFocus") || "auto");
      musicMode = String(formData.get("musicMode") || "none");
      musicMood = String(formData.get("musicMood") || "cinematic");
      musicVolume = Number(formData.get("musicVolume") || 0.16);
      renderQuality = String(formData.get("renderQuality") || "balanced");

      if ((!file || typeof file.arrayBuffer !== "function") && !sourceUrl) {
        return Response.json({ error: "Choose a video file first." }, { status: 400 });
      }

      if (file && typeof file.arrayBuffer === "function") {
        source = file.name || "Uploaded video";
        await writeFile(sourceFile, Buffer.from(await file.arrayBuffer()));
      } else {
        source = sourceUrl;
        const { directVideo } = validateSourceLink(sourceUrl);
        if (directVideo) {
          await downloadVideo(sourceUrl, sourceFile);
        } else {
          const ytDlpPath = await findCommand("yt-dlp", "YT_DLP_PATH");
          if (!ytDlpPath) {
            return Response.json({ error: "Link mode needs yt-dlp installed. Add YT_DLP_PATH to .env." }, { status: 400 });
          }
          const nodePath = await findCommand("node", "NODE_PATH");
          sourceFile = await downloadWithYtDlp(sourceUrl, workDir, ytDlpPath, nodePath);
        }
      }

      if (uploadedMusic && typeof uploadedMusic.arrayBuffer === "function") {
        if (!String(uploadedMusic.type || "").startsWith("audio/")) {
          return Response.json({ error: "Background music must be an audio file." }, { status: 400 });
        }
        const extension = uploadedMusic.name?.includes(".")
          ? uploadedMusic.name.split(".").pop()
          : "mp3";
        musicFile = path.join(workDir, `music.${extension}`);
        await writeFile(musicFile, Buffer.from(await uploadedMusic.arrayBuffer()));
        musicMode = "upload";
      }
    } else {
      const body = await request.json();
      const sourceUrl = String(body.videoUrl || body.sourceUrl || "").trim();
      captionStyle = String(body.captionStyle || "Viral Bold");
      clipCount = Number(body.clipCount || 3);
      generationMode = String(body.generationMode || "auto");
      manualStart = String(body.manualStart || "00:00");
      manualEnd = String(body.manualEnd || "00:30");
      frameFocus = String(body.frameFocus || "auto");
      musicMode = String(body.musicMode || "none");
      musicMood = String(body.musicMood || "cinematic");
      musicVolume = Number(body.musicVolume || 0.16);
      renderQuality = String(body.renderQuality || "balanced");

      if (!sourceUrl) {
        return Response.json({ error: "Paste a video link first." }, { status: 400 });
      }

      source = sourceUrl;
      const { directVideo } = validateSourceLink(sourceUrl);
      if (directVideo) {
        await downloadVideo(sourceUrl, sourceFile);
      } else {
        const ytDlpPath = await findCommand("yt-dlp", "YT_DLP_PATH");
        if (!ytDlpPath) {
          return Response.json({ error: "Link mode needs yt-dlp installed. Add YT_DLP_PATH to .env." }, { status: 400 });
        }
        const nodePath = await findCommand("node", "NODE_PATH");
        sourceFile = await downloadWithYtDlp(sourceUrl, workDir, ytDlpPath, nodePath);
      }
    }

    const [duration, dimensions] = await Promise.all([
      getVideoDuration(ffmpegPath, sourceFile),
      getVideoDimensions(ffmpegPath, sourceFile),
    ]);
    const clips = await applySmartFrameFocus(
      ffmpegPath,
      sourceFile,
      generationMode === "manual"
        ? buildManualClip(manualStart, manualEnd, duration)
        : buildClips(clipCount, duration),
      frameFocus,
      dimensions,
    );
    const rendered = [];

    for (const clip of clips) {
      const fileName = `${clip.id}.mp4`;
      const targetFile = path.join(exportDir, fileName);
      const captionText = await transcribeCaptionText(ffmpegPath, sourceFile, clip, workDir);
      const renderableClip = { ...clip, captionText };
      await renderClip(ffmpegPath, sourceFile, targetFile, renderableClip, captionStyle, {
        musicFile,
        musicVolume,
        renderQuality,
      });
      rendered.push({
        ...clip,
        captionStyle,
        captionEnabled: Boolean(captionText),
        musicMode,
        musicMood,
        hasBackgroundMusic: Boolean(musicFile),
        renderQuality,
        exportUrl: `/exports/${jobId}/${fileName}`,
      });
    }

    return Response.json({
      source,
      clips: rendered,
      jobId,
      music: {
        mode: musicFile ? "upload" : musicMode,
        mood: musicMood,
        mixed: Boolean(musicFile),
      },
      renderQuality,
      captionEngine: process.env.GROQ_API_KEY ? "groq-whisper" : "disabled",
      note: process.env.GROQ_API_KEY
        ? "Rendered high-quality 9:16 MP4 shorts with speaker-focused framing and transcript captions when speech is detected."
        : "Rendered high-quality 9:16 MP4 shorts with speaker-focused framing. Add GROQ_API_KEY to enable transcript captions.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create shorts." },
      { status: 400 },
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
