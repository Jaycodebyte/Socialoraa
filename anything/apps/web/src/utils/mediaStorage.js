import supabase from "@/utils/supabase";

const BUCKET = "scheduled-media";

const uploadWithEndpoint = async (file, endpoint) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error("Upload failed: file is too large.");
    }
    throw new Error("Upload failed. Please try again.");
  }

  const data = await response.json();
  if (!data?.url) {
    throw new Error("Upload failed: storage did not return a media URL.");
  }

  return {
    storageBucket: endpoint.includes("/api/media/upload")
      ? "local-scheduled-media"
      : "create-upload",
    storagePath: data.url,
    publicUrl: data.url,
    mimeType: data.mimeType || file.type || null,
  };
};

const uploadWithFallback = async (file) => {
  try {
    return await uploadWithEndpoint(file, "/api/media/upload");
  } catch (localError) {
    try {
      return await uploadWithEndpoint(file, "/_create/api/upload/");
    } catch {
      throw localError;
    }
  }
};

export async function uploadScheduledMedia(userId, file) {
  if (!userId) throw new Error("Please sign in before uploading media.");
  if (!file) return null;

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  let uploadResult = null;
  try {
    uploadResult = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
  } catch {
    return uploadWithFallback(file);
  }

  if (uploadResult.error) {
    return uploadWithFallback(file);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    storageBucket: BUCKET,
    storagePath: path,
    publicUrl: data.publicUrl,
  };
}
