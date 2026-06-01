const DRAFT_KEY = "scheduler:incoming-draft";

export const extractPostTitle = (topic, content) => {
  const text = String(content || "").trim();
  const titleMatch = text.match(/^title:\s*(.+)$/im);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine?.slice(0, 90) || String(topic || "Scheduled post").slice(0, 90);
};

export const saveSchedulerDraft = (draft) => {
  if (typeof window === "undefined") return;

  const payload = {
    title: draft.title || extractPostTitle(draft.topic, draft.content),
    content: draft.content || "",
    platform: draft.platform || "linkedin",
    topic: draft.topic || "",
    updatedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("scheduler-draft-updated", { detail: payload }));
};

export const readSchedulerDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(DRAFT_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const clearSchedulerDraft = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DRAFT_KEY);
};
