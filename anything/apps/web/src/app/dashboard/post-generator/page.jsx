import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Send,
  Copy,
  Save,
  RefreshCcw,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  CheckCircle2,
  ChevronDown,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { saveContent } from "@/utils/contentStore";
import { useUserPersistentState } from "@/utils/usePersistentState";
import { extractPostTitle, saveSchedulerDraft } from "@/utils/schedulerDraft";
import { useBackgroundTask } from "@/utils/backgroundTasks";
import { checkUsageLimit, recordUsage } from "@/utils/plans";

const PlatformTab = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 transition-all sm:px-6 ${
      active
        ? "border-blue-600 text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-300"
    }`}
  >
    <Icon size={18} />
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

export default function PostGenerator() {
  const { data: user } = useUser();
  const userStateKey = user?.id || user?.email || "guest";
  const [topic, setTopic] = useUserPersistentState(userStateKey, "post-generator:topic", "");
  const [language, setLanguage] = useUserPersistentState(userStateKey, "post-generator:language", "English");
  const [style, setStyle] = useUserPersistentState(userStateKey, "post-generator:style", "Professional");
  const [generatedContent, setGeneratedContent] = useUserPersistentState(userStateKey, "post-generator:content", null);
  const [activePlatform, setActivePlatform] = useUserPersistentState(userStateKey, "post-generator:active-platform", "linkedin");
  const [useWebSearch, setUseWebSearch] = useUserPersistentState(userStateKey, "post-generator:web-search", false);
  const [sources, setSources] = useUserPersistentState(userStateKey, "post-generator:sources", []);
  const { task, runTask } = useBackgroundTask("post-generator");
  const loading = task.status === "running";

  useEffect(() => {
    if (task.status !== "success" || !task.result?.content) return;
    setGeneratedContent(task.result.content);
    setSources(task.result.sources || []);
    saveSchedulerDraft({
      topic: task.result.topic,
      platform: task.result.activePlatform,
      content: task.result.content?.[task.result.activePlatform] || "",
    });
  }, [setGeneratedContent, setSources, task.result, task.status]);

  const handleGenerate = async () => {
    if (!topic) return toast.error("Please enter a topic");

    const usage = checkUsageLimit(user, "aiPosts");
    if (!usage.allowed) return toast.error(usage.message);

    runTask(async () => {
      const response = await fetch("/api/ai/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, style, useWebSearch }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }
      recordUsage(user, "aiPosts");
      toast.success("Content generated successfully!");
      return {
        content: data.content,
        sources: data.sources || [],
        topic,
        activePlatform,
      };
    }, {
      message: "Generating post content in the background...",
      successMessage: "Post content ready",
    }).catch((error) => {
      console.error(error);
      toast.error(error.message || "Could not generate content. Try again.");
      setGeneratedContent(null);
      setSources([]);
    });
  };

  const handleSave = async () => {
    if (!generatedContent) return;
    try {
      await saveContent(user?.id, {
        title: topic,
        type: "post",
        platform: activePlatform,
        generatedText: generatedContent,
        status: "draft",
      });
      toast.success("Content saved to My Work!");
    } catch (error) {
      toast.error(error.message || "Failed to save content");
    }
  };

  const handleSchedule = async () => {
    if (!generatedContent) return;
    const content = generatedContent[activePlatform] || "";

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    try {
      await saveContent(user?.id, {
        title: extractPostTitle(topic, content),
        type: "post",
        platform: activePlatform,
        generatedText: generatedContent,
        status: "scheduled",
        scheduledAt: tomorrow.toISOString(),
      });
      saveSchedulerDraft({
        topic,
        platform: activePlatform,
        content,
        title: extractPostTitle(topic, content),
      });
      toast.success("Post added to your schedule!");
      window.location.href = "/dashboard/scheduler";
    } catch (error) {
      toast.error(error.message || "Failed to schedule content");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const languages = ["English", "Hindi", "Hinglish"];
  const styles = ["Professional", "Friendly", "Viral", "Funny"];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          AI Post Generator ⚡
        </h1>
        <p className="text-gray-500">
          Transform a simple topic into multi-platform viral content.
        </p>
      </div>

      {/* Input Section */}
      <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:space-y-8 sm:rounded-3xl sm:p-8">
        <div className="space-y-4">
          <label className="text-sm font-semibold text-gray-400">
            What is your post about?
          </label>
          <div className="relative">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Benefits of Remote Work for Software Engineers"
              className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-base outline-none transition-all focus:border-blue-500 sm:p-6 sm:text-lg"
            />
            <div className="absolute bottom-4 right-4 text-xs text-gray-500">
              {topic.length}/200
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-400">
              Content Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition-all focus:border-blue-500"
              >
                {languages.map((option) => (
                  <option key={option} value={option} className="bg-[#0A0B14]">
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-400">
              Content Style
            </label>
            <div className="relative">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-semibold text-white outline-none transition-all focus:border-blue-500"
              >
                {styles.map((option) => (
                  <option key={option} value={option} className="bg-[#0A0B14]">
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setUseWebSearch((value) => !value)}
          className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
            useWebSearch
              ? "border-blue-500 bg-blue-500/10 text-blue-300"
              : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          <span className="flex items-center gap-3 font-semibold">
            <Globe2 size={18} />
            Use live web search
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {useWebSearch ? "On" : "Off"}
          </span>
        </button>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-4 text-base font-bold shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-50 sm:text-lg"
        >
          {loading ? (
            <RefreshCcw className="animate-spin" />
          ) : (
            <Zap className="fill-white" />
          )}
          {loading ? "Generating Content..." : "Generate Post Pack"}
        </button>
      </div>

      {/* Results Section */}
      <AnimatePresence>
        {generatedContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">Generated Content</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-semibold border border-white/5 transition-all"
                >
                  <Save size={16} /> Save to Work
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] sm:rounded-3xl">
              <div className="flex overflow-x-auto border-b border-white/5 bg-white/[0.02]">
                <PlatformTab
                  icon={Linkedin}
                  label="LinkedIn"
                  active={activePlatform === "linkedin"}
                  onClick={() => {
                    setActivePlatform("linkedin");
                    saveSchedulerDraft({
                      topic,
                      platform: "linkedin",
                      content: generatedContent?.linkedin || "",
                    });
                  }}
                />
                <PlatformTab
                  icon={Instagram}
                  label="Instagram"
                  active={activePlatform === "instagram"}
                  onClick={() => {
                    setActivePlatform("instagram");
                    saveSchedulerDraft({
                      topic,
                      platform: "instagram",
                      content: generatedContent?.instagram || "",
                    });
                  }}
                />
                <PlatformTab
                  icon={Facebook}
                  label="Facebook"
                  active={activePlatform === "facebook"}
                  onClick={() => {
                    setActivePlatform("facebook");
                    saveSchedulerDraft({
                      topic,
                      platform: "facebook",
                      content: generatedContent?.facebook || "",
                    });
                  }}
                />
                <PlatformTab
                  icon={Youtube}
                  label="YouTube"
                  active={activePlatform === "youtube"}
                  onClick={() => {
                    setActivePlatform("youtube");
                    saveSchedulerDraft({
                      topic,
                      platform: "youtube",
                      content: generatedContent?.youtube || "",
                    });
                  }}
                />
              </div>

              <div className="p-4 sm:p-8">
                <div className="min-h-[200px] whitespace-pre-wrap rounded-2xl bg-black/20 p-4 font-medium leading-relaxed text-gray-300 sm:p-6">
                  {generatedContent[activePlatform]}
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 size={16} /> Ready to post
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:flex">
                    <button
                      onClick={() =>
                        copyToClipboard(generatedContent[activePlatform])
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-6 py-3 text-sm font-bold transition-all hover:bg-white/10"
                    >
                      <Copy size={16} /> Copy Text
                    </button>
                    <button
                      onClick={handleSchedule}
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
                    >
                      <Send size={16} /> Schedule Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Advice Section */}
            {sources.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-blue-400">
                  <Globe2 size={18} /> Sources
                </h4>
                <div className="space-y-3">
                  {sources.slice(0, 5).map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-white/5 bg-black/20 p-4 transition-colors hover:border-blue-500/40"
                    >
                      <div className="font-semibold text-sm text-gray-200">
                        {source.title}
                      </div>
                      <div className="mt-1 truncate text-xs text-blue-300">
                        {source.url}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-2xl border border-blue-500/10 bg-blue-500/5 p-5 sm:flex-row sm:p-6">
              <div className="p-3 bg-blue-500/20 rounded-xl h-fit">
                <Zap size={20} className="text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-blue-400 mb-1">Pro Tip</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Posts with questions in the first 2 lines tend to have 40%
                  higher engagement on LinkedIn. Try adding a hook!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
