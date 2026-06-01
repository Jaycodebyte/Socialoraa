import supabase from "@/utils/supabase";

const TABLE_NAME = "generated_content";

const localKey = (userId) => `socialpilot-content:${userId || "guest"}`;

const readLocalContent = (userId) => {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(window.localStorage.getItem(localKey(userId)) || "[]");
  } catch {
    return [];
  }
};

const writeLocalContent = (userId, content) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localKey(userId), JSON.stringify(content));
};

const normalizeContent = (item) => ({
  ...item,
  generated_text:
    typeof item.generated_text === "string"
      ? (() => {
          try {
            return JSON.parse(item.generated_text);
          } catch {
            return item.generated_text;
          }
        })()
      : item.generated_text,
});

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function listContent(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error) return data.map(normalizeContent);

  return readLocalContent(userId);
}

export async function saveContent(userId, input) {
  if (!userId) throw new Error("Please sign in to save content.");

  const now = new Date().toISOString();
  const item = {
    user_id: userId,
    title: input.title || "Untitled",
    type: input.type || "post",
    platform: input.platform || "general",
    generated_text: input.generatedText || input.generated_text || "",
    media: input.media || input.media_metadata || null,
    status: input.status || "draft",
    scheduled_at: input.scheduledAt || input.scheduled_at || null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(item)
    .select()
    .single();

  if (!error) return normalizeContent(data);

  const localItem = { ...item, id: newId() };
  const content = [localItem, ...readLocalContent(userId)];
  writeLocalContent(userId, content);
  return localItem;
}

export async function deleteContent(userId, id) {
  if (!userId || !id) return;

  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
  if (!error) return;

  writeLocalContent(
    userId,
    readLocalContent(userId).filter((item) => item.id !== id),
  );
}

export async function updateContent(userId, id, updates) {
  if (!userId || !id) throw new Error("Missing content item.");

  const updated_at = new Date().toISOString();
  const payload = {
    ...updates,
    updated_at,
  };
  if ("scheduledAt" in updates) {
    payload.scheduled_at = updates.scheduledAt;
  }
  delete payload.scheduledAt;

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (!error) return normalizeContent(data);

  const content = readLocalContent(userId).map((item) =>
    item.id === id ? { ...item, ...payload } : item,
  );
  writeLocalContent(userId, content);
  return content.find((item) => item.id === id);
}

export function getContentText(item, platform = item?.platform) {
  const text = item?.generated_text;
  if (!text) return "";
  if (typeof text === "string") return text;
  if (text[platform]) return text[platform];

  return Object.entries(text)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}\n${value.map((line) => `- ${line}`).join("\n")}`
        : `${key}\n${value}`,
    )
    .join("\n\n");
}
