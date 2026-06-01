import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const safeExtension = (file) => {
  const fromName = extname(file.name || "").toLowerCase();
  if (/^\.[a-z0-9]+$/.test(fromName)) return fromName;

  if (file.type === "video/mp4") return ".mp4";
  if (file.type === "video/webm") return ".webm";
  if (file.type === "video/quicktime") return ".mov";
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";

  return ".bin";
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Attach a media file first." }, { status: 400 });
    }

    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      return Response.json(
        { error: "Only image and video files can be scheduled." },
        { status: 400 },
      );
    }

    const uploadDir = join(process.cwd(), "public", "uploads", "scheduled");
    await mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}${safeExtension(file)}`;
    await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

    const url = new URL(request.url);
    return Response.json({
      url: `${url.origin}/uploads/scheduled/${filename}`,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not upload media." },
      { status: 400 },
    );
  }
}
