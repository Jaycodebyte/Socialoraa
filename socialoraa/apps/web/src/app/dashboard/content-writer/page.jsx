import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Copy,
  Save,
  RefreshCcw,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { saveContent } from "@/utils/contentStore";
import { useUserPersistentState } from "@/utils/usePersistentState";
import { useBackgroundTask } from "@/utils/backgroundTasks";
import { checkUsageLimit, recordUsage } from "@/utils/plans";

const DescriptionCard = ({ title, content, onCopy }) => (
  <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">
        {title}
      </h3>
      <button
        onClick={() => onCopy(content)}
        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white"
      >
        <Copy size={16} />
      </button>
    </div>
    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
      {content}
    </p>
  </div>
);

export default function ContentWriter() {
  const { data: user } = useUser();
  const userStateKey = user?.id || user?.email || "guest";
  const [content, setContent] = useUserPersistentState(userStateKey, "content-writer:content", "");
  const [results, setResults] = useUserPersistentState(userStateKey, "content-writer:results", null);
  const { task, runTask, clearTask } = useBackgroundTask("content-writer");
  const handledResultRef = useRef(null);
  const loading = task.status === "running";

  useEffect(() => {
    if (task.status !== "success" || !task.result?.results) return;
    if (handledResultRef.current === task.result) return;
    handledResultRef.current = task.result;

    setResults(task.result.results);
    clearTask();
  }, [clearTask, setResults, task.result, task.status]);

  const handleGenerate = async () => {
    if (!content) return toast.error("Please paste your content");

    const usage = checkUsageLimit(user, "aiPosts");
    if (!usage.allowed) return toast.error(usage.message);

    runTask(async () => {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      recordUsage(user, "aiPosts");
      toast.success("Descriptions generated!");
      return { results: data.results };
    }, {
      message: "Generating descriptions in the background...",
      successMessage: "Descriptions ready",
      initialProgress: 10,
      maxProgress: 96,
      estimatedDurationMs: 10000,
      progressIntervalMs: 300,
    }).catch((error) => {
      console.error(error);
      toast.error("Could not generate. Showing demo results.");
      setResults({
        short:
          "Master the art of social media automation with Socialoraa. 🚀 #SaaS #AI",
        long: "Tired of spending hours on social media content? Socialoraa is here to help you generate, schedule, and analyze your posts in seconds. Our AI-driven platform ensures your brand stays consistent and viral across all major platforms. Ready to scale? Start your journey today! 📈",
        seo: "Social media automation tool powered by AI. Generate LinkedIn posts, Instagram captions, and YouTube descriptions automatically. Best SaaS for content creators and businesses in 2026.",
        hashtags:
          "#SocialMediaAutomation #AIContent #SaaS #Socialoraa #DigitalMarketing #GrowthHacking #ContentCreator",
      });
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const handleSave = async () => {
    if (!results) return;

    try {
      await saveContent(user?.id, {
        title: content.slice(0, 54) || "Generated descriptions",
        type: "description",
        platform: "general",
        generatedText: results,
        status: "draft",
      });
      toast.success("Descriptions saved to My Work");
    } catch (error) {
      toast.error(error.message || "Could not save descriptions");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          AI Content Writer ✍️
        </h1>
        <p className="text-gray-500">
          Paste your content and let AI generate perfect descriptions and
          hashtags.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
        <div className="space-y-4">
          <label className="text-sm font-semibold text-gray-400">
            Your Content / Article / Notes
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your rough content here..."
            className="h-48 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-base outline-none transition-all focus:border-blue-500 sm:p-6 sm:text-lg"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-4 text-base font-bold shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50 sm:text-lg"
        >
          {loading ? (
            <RefreshCcw className="animate-spin" />
          ) : (
            <FileText size={20} />
          )}
          {loading ? "Analyzing Content..." : "Generate Descriptions & Tags"}
        </button>
      </div>

      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
              >
                <Save size={16} /> Save to Work
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DescriptionCard
                title="Short Description"
                content={results.short}
                onCopy={copyToClipboard}
              />
              <DescriptionCard
                title="SEO Description"
                content={results.seo}
                onCopy={copyToClipboard}
              />
            </div>
            <div>
              <DescriptionCard
                title="Long Detailed Description"
                content={results.long}
                onCopy={copyToClipboard}
              />
            </div>
            <div>
              <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest flex items-center gap-2">
                    <Hash size={14} /> Recommended Hashtags
                  </h3>
                  <button
                    onClick={() => copyToClipboard(results.hashtags)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {results.hashtags.split(" ").map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
