import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Save,
  RefreshCcw,
  PlayCircle,
  Lightbulb,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { saveContent } from "@/utils/contentStore";
import { useUserPersistentState } from "@/utils/usePersistentState";
import { useBackgroundTask } from "@/utils/backgroundTasks";
import { checkUsageLimit, recordUsage } from "@/utils/plans";

const ScriptPart = ({ label, content, onCopy }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
        {label}
      </span>
      <button
        onClick={() => onCopy(content)}
        className="text-gray-500 hover:text-white transition-colors"
      >
        <Copy size={14} />
      </button>
    </div>
    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  </div>
);

export default function ScriptGenerator() {
  const { data: user } = useUser();
  const userStateKey = user?.id || user?.email || "guest";
  const [topic, setTopic] = useUserPersistentState(userStateKey, "script-generator:topic", "");
  const [language, setLanguage] = useUserPersistentState(userStateKey, "script-generator:language", "English");
  const [duration, setDuration] = useUserPersistentState(userStateKey, "script-generator:duration", "60");
  const [customDuration, setCustomDuration] = useUserPersistentState(userStateKey, "script-generator:custom-duration", "");
  const [script, setScript] = useUserPersistentState(userStateKey, "script-generator:script", null);
  const [useWebSearch, setUseWebSearch] = useUserPersistentState(userStateKey, "script-generator:web-search", false);
  const [sources, setSources] = useUserPersistentState(userStateKey, "script-generator:sources", []);
  const { task, runTask, clearTask } = useBackgroundTask("script-generator");
  const handledResultRef = useRef(null);
  const loading = task.status === "running";

  useEffect(() => {
    if (task.status !== "success" || !task.result?.script) return;
    if (handledResultRef.current === task.result) return;
    handledResultRef.current = task.result;

    setScript(task.result.script);
    setSources(task.result.sources || []);
    const timer = globalThis.setTimeout(clearTask, 900);
    return () => globalThis.clearTimeout(timer);
  }, [clearTask, setScript, setSources, task.result, task.status]);

  const handleGenerate = async () => {
    if (!topic) return toast.error("Please enter a video topic");

    const usage = checkUsageLimit(user, "aiPosts");
    if (!usage.allowed) return toast.error(usage.message);

    setScript(null);
    setSources([]);

    runTask(async ({ setProgress }) => {
      setProgress(18, useWebSearch ? "Searching live script references..." : "Preparing script structure...");
      const response = await fetch("/api/ai/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          language,
          durationSeconds: duration === "custom" ? customDuration : duration,
          useWebSearch,
        }),
      });

      setProgress(82, "Formatting script sections...");
      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      setProgress(96, "Finalizing video script...");
      recordUsage(user, "aiPosts");
      toast.success("Script generated!");
      return {
        script: data.script,
        sources: data.sources || [],
      };
    }, {
      message: "Generating script in the background...",
      successMessage: "Script ready",
      initialProgress: 8,
      maxProgress: 96,
      estimatedDurationMs: useWebSearch ? 28000 : 16000,
      progressIntervalMs: 300,
    }).catch((error) => {
      console.error(error);
      toast.error("Could not generate. Showing demo script.");
      setScript({
        title: `How to Scale with ${topic}`,
        hook: `Did you know that 90% of creators fail because they ignore ${topic}? Here's how you can be in the top 10%.`,
        intro: `Welcome back! Today we're diving into the world of ${topic} and why it's the single most important skill to learn in 2026.`,
        main: `1. The Foundation: Start by understanding the core principles.\n2. The Strategy: Implement a consistent workflow.\n3. The Secret: It's all about the data!`,
        outro: `That's it for today! If you found this helpful, you know what to do.`,
        cta: `Click the link in bio to download my free ${topic} checklist!`,
        thumbnails: [
          "Big text: ${topic} EXPLAINED",
          "Reaction face + Shocking Stat",
          "Before vs After using ${topic}",
        ],
      });
      setSources([]);
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const handleSave = async () => {
    if (!script) return;

    try {
      await saveContent(user?.id, {
        title: script.title,
        type: "script",
        platform: "youtube",
        generatedText: script,
        status: "draft",
      });
      toast.success("Script saved to My Work");
    } catch (error) {
      toast.error(error.message || "Could not save script");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          AI Script Generator 🎬
        </h1>
        <p className="text-gray-500">
          From topic to full video script in seconds. Perfect for Reels, Shorts,
          and YouTube.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
        <div className="space-y-4">
          <label className="text-sm font-semibold text-gray-400">
            What is your video about?
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. My Morning Routine as a 6-Figure Creator"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-base outline-none transition-all focus:border-blue-500 sm:px-6 sm:text-lg"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-400">
            Script Language
          </label>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            {["English", "Hindi", "Hinglish"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                  language === option
                    ? "border-purple-500 bg-purple-500/10 text-purple-300"
                    : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-400">
            Target Duration
          </label>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-5">
            {[
              ["30", "30 sec"],
              ["50", "50 sec"],
              ["300", "5 min"],
              ["1800", "30 min"],
              ["custom", "Custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDuration(value)}
                className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                  duration === value
                    ? "border-purple-500 bg-purple-500/10 text-purple-300"
                    : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {duration === "custom" && (
            <input
              type="text"
              value={customDuration}
              onChange={(event) => setCustomDuration(event.target.value)}
              placeholder="e.g. 90 sec, 7 min, 12 minutes"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all focus:border-purple-500"
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setUseWebSearch((value) => !value)}
          className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
            useWebSearch
              ? "border-purple-500 bg-purple-500/10 text-purple-300"
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
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-purple-600 py-4 text-base font-bold shadow-lg shadow-purple-600/20 transition-all hover:bg-purple-700 disabled:opacity-50 sm:text-lg"
        >
          {loading ? (
            <RefreshCcw className="animate-spin" />
          ) : (
            <PlayCircle size={20} />
          )}
          {loading ? "Crafting Your Script..." : "Generate Video Script"}
        </button>
      </div>

      <AnimatePresence>
        {script && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:space-y-8 sm:rounded-3xl sm:p-8">
                <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold">{script.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => copyToClipboard(script.title)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <ScriptPart
                  label="The Hook (0-3s)"
                  content={script.hook}
                  onCopy={copyToClipboard}
                />
                <ScriptPart
                  label="Intro"
                  content={script.intro}
                  onCopy={copyToClipboard}
                />
                <ScriptPart
                  label="Main Content"
                  content={script.main}
                  onCopy={copyToClipboard}
                />
                <ScriptPart
                  label="Outro & CTA"
                  content={script.outro + "\n\n" + script.cta}
                  onCopy={copyToClipboard}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <Lightbulb size={18} className="text-yellow-400" /> Thumbnail
                  Ideas
                </h4>
                <div className="space-y-3">
                  {script.thumbnails.map((idea, i) => (
                    <div
                      key={i}
                      className="p-4 bg-white/5 rounded-xl border border-white/5 text-sm text-gray-400 italic"
                    >
                      "{idea}"
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                <h4 className="font-bold text-purple-400 mb-2">Style Tip</h4>
                <p className="text-sm text-gray-400">
                  For vertical shorts, use 2-3 cuts every 10 seconds to maintain
                  high retention.
                </p>
              </div>

              {sources.length > 0 && (
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-purple-300">
                    <Globe2 size={18} /> Sources
                  </h4>
                  <div className="space-y-3">
                    {sources.slice(0, 5).map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-white/5 bg-black/20 p-4 transition-colors hover:border-purple-500/40"
                      >
                        <div className="text-sm font-semibold text-gray-200">
                          {source.title}
                        </div>
                        <div className="mt-1 truncate text-xs text-purple-300">
                          {source.url}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
