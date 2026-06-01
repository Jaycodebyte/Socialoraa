import React, { useMemo, useState } from "react";
import {
  FileText,
  Video,
  Zap,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Copy,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import { deleteContent, getContentText, listContent } from "@/utils/contentStore";
import usePersistentState from "@/utils/usePersistentState";

const ContentCard = ({ item, onDelete, onView }) => (
  <div className="group space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05] sm:rounded-3xl sm:p-6">
    <div className="flex items-start justify-between">
      <div
        className={`p-3 rounded-2xl ${
          item.type === "post"
            ? "bg-blue-600/20 text-blue-400"
            : item.type === "script"
              ? "bg-purple-600/20 text-purple-400"
              : "bg-emerald-600/20 text-emerald-400"
        }`}
      >
        {item.type === "post" ? (
          <Zap size={20} />
        ) : item.type === "script" ? (
          <Video size={20} />
        ) : (
          <FileText size={20} />
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="rounded-lg p-2 text-gray-500 transition-all hover:bg-red-500/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 size={16} />
      </button>
    </div>

    <div>
      <h4 className="font-bold text-lg mb-1 truncate">{item.title}</h4>
      <p className="text-xs text-gray-500">
        {new Date(item.created_at).toLocaleDateString()}
      </p>
    </div>

    <div className="flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {item.platform || "General"}
      </span>
      <button
        onClick={() => onView(item)}
        className="flex items-center gap-1 text-blue-400 text-xs font-bold hover:text-blue-300"
      >
        View Details <ExternalLink size={12} />
      </button>
    </div>
  </div>
);

export default function MyWork() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = usePersistentState("my-work:search", "");
  const [filter, setFilter] = usePersistentState("my-work:filter", "all");
  const [selectedItem, setSelectedItem] = usePersistentState("my-work:selected-item", null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-work", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listContent(user.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteContent(user.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-work", user?.id] });
      toast.success("Content deleted");
    },
    onError: () => toast.error("Could not delete content"),
  });

  const content = data || [];
  const filteredContent = useMemo(() => {
    return content.filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const haystack = `${item.title} ${item.platform} ${getContentText(item)}`.toLowerCase();
      return matchesFilter && haystack.includes(search.toLowerCase());
    });
  }, [content, filter, search]);

  const copySelected = () => {
    navigator.clipboard.writeText(getContentText(selectedItem));
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-8 pb-24 sm:space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            My Generated Work 📂
          </h1>
          <p className="text-gray-500 mt-1">
            Access all your AI-generated posts, scripts, and descriptions.
          </p>
        </div>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 md:w-auto">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your work..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-sm outline-none transition-all focus:border-blue-500 md:w-64"
            />
          </div>
          <button
            onClick={() =>
              setFilter((current) =>
                current === "all" ? "post" : current === "post" ? "script" : "all",
              )
            }
            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-500 hover:text-white transition-all"
            title={`Filter: ${filter}`}
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl bg-white/5 sm:rounded-3xl"
            />
          ))}
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-gray-600">
            <FileText size={40} />
          </div>
          <div>
            <h3 className="text-xl font-bold">No work saved yet</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-2">
              {content.length
                ? "No saved work matches your search."
                : "Start generating content with our AI tools to see them here."}
            </p>
          </div>
          <a
            href="/dashboard/post-generator"
            className="rounded-2xl bg-blue-600 px-8 py-3 font-bold shadow-lg shadow-blue-600/20"
          >
            Generate First Post
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onDelete={(id) => deleteMutation.mutate(id)}
              onView={setSelectedItem}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 sm:p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0F101A] p-5 shadow-2xl sm:rounded-3xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-blue-400">
                  {selectedItem.platform || "General"} · {selectedItem.type}
                </div>
                <h2 className="mt-2 break-words text-xl font-bold sm:text-2xl">{selectedItem.title}</h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl bg-white/5 p-2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[52vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-black/25 p-5 leading-relaxed text-gray-300">
              {getContentText(selectedItem)}
            </div>
            <div className="mt-6 flex justify-stretch sm:justify-end">
              <button
                onClick={copySelected}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-700 sm:w-auto"
              >
                <Copy size={16} /> Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
