import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const secondsFromTimestamp = (value) => {
  const parts = String(value || "0").split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(value) || 0;
};

function getSkinScore(r, g, b) {
  const brightness = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel - minChannel;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const rgbSkin =
    r > 70 &&
    g > 35 &&
    b > 38 &&
    saturation > 15 &&
    g < b * 2.05 &&
    r > g * 1.04 &&
    r > b * 1.12 &&
    r - g > 8 &&
    r - b < 165;
  const ycbcrSkin = cr >= 135 && cr <= 180 && cb >= 78 && cb <= 138;
  const greenPlant = g > r * 1.08 && g > b * 1.15;
  const brightLight = brightness > 220 && saturation < 70;

  if (greenPlant || brightLight || brightness < 24 || brightness > 248) return 0;
  if (rgbSkin && ycbcrSkin) return 1;
  if (ycbcrSkin && b > 34 && g < b * 2.15 && r > b * 1.08 && r - b < 175 && saturation > 20) {
    return 0.72;
  }
  return 0;
}

function scorePixelForSubject(r, g, b, motion = 0, edge = 0) {
  const brightness = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel - minChannel;
  const skinScore = getSkinScore(r, g, b);
  const brightLight = brightness > 220 && saturation < 80;
  const usableDetail = brightness > 28 && brightness < 245;

  if (!usableDetail || brightLight) return 0;
  if (skinScore > 0) {
    return 14 * skinScore + Math.min(edge / 120, 2.2) + Math.min(motion / 55, 2.5);
  }
  if (motion > 45 && saturation > 25 && brightness < 210) {
    return Math.min(motion / 42, 2.6) + Math.min(edge / 220, 1.1);
  }
  return 0;
}

function buildSubjectColumnScores(frames, width, height) {
  const skinScores = Array.from({ length: width }, () => 0);
  const nearbyMotionScores = Array.from({ length: width }, () => 0);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const previousFrame = frames[frameIndex - 1];

    for (let y = 5; y < height - 5; y += 2) {
      const yRatio = y / height;
      const verticalWeight =
        yRatio < 0.16 || yRatio > 0.9
          ? 0.35
          : 1 + Math.max(0, 0.55 - Math.abs(yRatio - 0.42));

      for (let x = 3; x < width - 3; x += 2) {
        const xRatio = x / width;
        if (yRatio < 0.2 && xRatio > 0.72) continue;

        const index = (y * width + x) * 3;
        const r = frame[index];
        const g = frame[index + 1];
        const b = frame[index + 2];
        const left = index - 6;
        const up = index - width * 6;
        const edge =
          Math.abs(r - frame[left]) +
          Math.abs(g - frame[left + 1]) +
          Math.abs(b - frame[left + 2]) +
          Math.abs(r - frame[up]) +
          Math.abs(g - frame[up + 1]) +
          Math.abs(b - frame[up + 2]);
        const motion = previousFrame
          ? Math.abs(r - previousFrame[index]) +
            Math.abs(g - previousFrame[index + 1]) +
            Math.abs(b - previousFrame[index + 2])
          : 0;
        const skinScore = getSkinScore(r, g, b);
        const speakerScore = scorePixelForSubject(r, g, b, motion, edge) * verticalWeight;

        if (skinScore > 0) skinScores[x] += speakerScore * (1.8 + skinScore);
        else if (motion > 45) nearbyMotionScores[x] += speakerScore;
      }
    }
  }

  const smoothedSkinScores = skinScores.map((score, index) => {
    let smoothed = 0;
    let samples = 0;
    for (let offset = -4; offset <= 4; offset += 1) {
      const value = skinScores[index + offset];
      if (Number.isFinite(value)) {
        smoothed += value;
        samples += 1;
      }
    }
    return samples ? smoothed / samples : score;
  });

  const maxSkinScore = Math.max(...smoothedSkinScores, 0);
  if (maxSkinScore <= 0) return smoothedSkinScores;

  return smoothedSkinScores.map((skinScore, index) => {
    let nearbySkin = 0;
    for (let offset = -12; offset <= 12; offset += 1) {
      nearbySkin = Math.max(nearbySkin, smoothedSkinScores[index + offset] || 0);
    }
    const motionSupport =
      nearbySkin >= maxSkinScore * 0.18
        ? Math.min(nearbyMotionScores[index] || 0, nearbySkin * 0.55)
        : 0;
    return skinScore * 3.5 + motionSupport;
  });
}

function getBestSubjectCrop(columnScores, cropWidth) {
  const width = columnScores.length;
  const maxStart = Math.max(width - cropWidth, 0);
  let bestStart = 0;
  let bestScore = -Infinity;
  const maxColumnScore = Math.max(...columnScores, 0);
  const strongThreshold = maxColumnScore * 0.38;
  let weightedX = 0;
  let weightedScore = 0;

  for (let start = 0; start <= maxStart; start += 1) {
    let windowScore = 0;
    for (let x = start; x < start + cropWidth; x += 1) {
      const centerBias = 1 - Math.abs(x - (start + cropWidth / 2)) / Math.max(cropWidth, 1);
      windowScore += (columnScores[x] || 0) * (0.72 + centerBias * 0.28);
    }
    if (windowScore > bestScore) {
      bestScore = windowScore;
      bestStart = start;
    }
  }

  columnScores.forEach((score, x) => {
    if (score >= strongThreshold) {
      weightedX += x * score;
      weightedScore += score;
    }
  });

  const subjectCenter = weightedScore > 0 ? weightedX / weightedScore : bestStart + cropWidth / 2;
  const subjectStart = Math.round(clampNumber(subjectCenter - cropWidth * 0.5, 0, maxStart));
  const totalScore = columnScores.reduce((sum, score) => sum + score, 0);

  return {
    ratio: maxStart > 0 ? clampNumber(subjectStart / maxStart, 0, 1) : 0.5,
    confidence: totalScore > 0 ? bestScore / Math.max(totalScore, 1) : 0,
    maxColumnScore,
  };
}

function smoothTrack(samples, windowSize = 5) {
  return samples.map((sample, index) => {
    let ratio = 0;
    let confidence = 0;
    let count = 0;
    for (let offset = -windowSize; offset <= windowSize; offset += 1) {
      const nearby = samples[index + offset];
      if (!nearby) continue;
      const weight = 1 / (Math.abs(offset) + 1);
      ratio += nearby.ratio * weight;
      confidence += nearby.confidence * weight;
      count += weight;
    }
    return {
      ...sample,
      ratio: count ? ratio / count : sample.ratio,
      confidence: count ? confidence / count : sample.confidence,
    };
  });
}

function buildCropExpression(samples) {
  const keyframes = samples
    .filter((sample) => sample.confidence >= 0.1 && sample.maxColumnScore >= 2.5)
    .map((sample) => ({
      time: Number(sample.time.toFixed(2)),
      ratio: Number(clampNumber(sample.ratio, 0, 1).toFixed(3)),
    }));

  if (!keyframes.length) return "";
  if (keyframes.length === 1) return `(iw-ow)*${keyframes[0].ratio}`;

  let expression = `(iw-ow)*${keyframes.at(-1).ratio}`;
  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    const progress = `(t-${current.time})/${Math.max(next.time - current.time, 0.01).toFixed(2)}`;
    const interpolated = `(iw-ow)*(${current.ratio}+(${next.ratio}-${current.ratio})*${progress})`;
    expression = `if(lt(t\\,${next.time})\\,${interpolated}\\,${expression})`;
  }

  return expression;
}

export async function trackSpeakerCrop(ffmpegPath, sourceFile, clip) {
  const width = 240;
  const height = 135;
  const fps = 3;
  const frameSize = width * height * 3;
  const clipDuration = Math.max(
    secondsFromTimestamp(clip.duration),
    secondsFromTimestamp(clip.endTime) - secondsFromTimestamp(clip.startTime),
    3,
  );

  const { stdout } = await execFileAsync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      clip.startTime,
      "-i",
      sourceFile,
      "-t",
      String(Math.min(clipDuration, 45)),
      "-vf",
      `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: frameSize * fps * Math.min(Math.ceil(clipDuration), 45) + frameSize,
      timeout: 1000 * 45,
      windowsHide: true,
    },
  );

  const frameCount = Math.floor(stdout.length / frameSize);
  const frames = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    frames.push(stdout.subarray(frameIndex * frameSize, (frameIndex + 1) * frameSize));
  }

  const cropWidth = Math.floor((height * 9) / 16);
  const samples = frames.map((frame, index) => {
    const start = Math.max(index - 1, 0);
    const end = Math.min(index + 2, frames.length);
    const crop = getBestSubjectCrop(
      buildSubjectColumnScores(frames.slice(start, end), width, height),
      cropWidth,
    );
    return {
      time: index / fps,
      ...crop,
    };
  });
  const smoothed = smoothTrack(samples);
  const confident = smoothed.filter((sample) => sample.confidence >= 0.1 && sample.maxColumnScore >= 2.5);

  if (!confident.length) {
    return {
      mode: "center",
      confidence: 0,
      cropXRatio: 0.5,
    };
  }

  const averageRatio =
    confident.reduce((sum, sample) => sum + sample.ratio, 0) / confident.length;
  const averageConfidence =
    confident.reduce((sum, sample) => sum + sample.confidence, 0) / confident.length;

  return {
    mode: "subject",
    cropXRatio: clampNumber(averageRatio, 0, 1),
    cropXExpression: buildCropExpression(smoothed),
    confidence: Number(averageConfidence.toFixed(3)),
    trackingSamples: confident.length,
  };
}
