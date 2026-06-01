import React from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import {
  Zap,
  Video,
  FileText,
  Calendar,
  MessageSquare,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Clock,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import useUser from "@/utils/useUser";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/utils/contentStore";

const StatCard = ({ label, value, icon: Icon, color }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-6"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <span className="flex items-center text-xs font-bold text-emerald-400 gap-1 bg-emerald-400/10 px-2 py-1 rounded-full">
        <TrendingUp size={12} /> +12%
      </span>
    </div>
    <div>
      <div className="text-gray-500 text-sm mb-1">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  </motion.div>
);

const ActivityItem = ({ title, time, type, platform: PlatformIcon }) => (
  <div className="flex flex-col gap-3 border-b border-white/5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
        {PlatformIcon ? (
          <PlatformIcon size={18} className="text-gray-400" />
        ) : (
          <Clock size={18} className="text-gray-400" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-xs text-gray-500">{time}</div>
      </div>
    </div>
    <div
      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
        type === "Published"
          ? "bg-emerald-400/10 text-emerald-400"
          : "bg-blue-400/10 text-blue-400"
      }`}
    >
      {type}
    </div>
  </div>
);

export default function DashboardHome() {
  const { data: user } = useUser();
  const { data: content = [] } = useQuery({
    queryKey: ["dashboard-content", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listContent(user.id),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const posts = content.filter((item) => item.type === "post");
  const videos = content.filter(
    (item) =>
      item.type === "script" ||
      item.type === "video" ||
      item.media?.generatedBy === "video-shorts",
  );
  const scheduled = content.filter((item) => item.status === "scheduled");
  const recent = content.slice(0, 5);
  const upcoming = scheduled
    .filter((item) => item.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 3);

  return (
    <div className="space-y-8 pb-10 sm:space-y-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {user?.name || "Creator"}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening with your socials today.
          </p>
        </div>
        <a
          href="/dashboard/post-generator"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-bold shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 sm:w-auto"
        >
          <Plus size={20} /> Create New Post
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Posts"
          value={posts.length}
          icon={FileText}
          color="bg-blue-500"
        />
        <StatCard
          label="Videos Made"
          value={videos.length}
          icon={Video}
          color="bg-purple-500"
        />
        <StatCard
          label="Scheduled"
          value={scheduled.length}
          icon={Calendar}
          color="bg-orange-500"
        />
        <StatCard
          label="Auto Replies"
          value="0"
          icon={MessageSquare}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
              <h3 className="text-xl font-bold">Recent Activity</h3>
              <button className="text-blue-400 text-sm font-semibold hover:text-blue-300">
                View All
              </button>
            </div>
            <div className="space-y-1">
              {recent.length ? (
                recent.map((item) => (
                  <ActivityItem
                    key={item.id}
                    title={item.title}
                    time={new Date(item.created_at).toLocaleDateString()}
                    type={
                      item.status === "scheduled"
                        ? "Scheduled"
                        : item.status === "published"
                          ? "Published"
                          : "Draft"
                    }
                    platform={
                      item.platform === "linkedin"
                        ? Linkedin
                        : item.platform === "instagram"
                          ? Instagram
                          : item.platform === "youtube"
                            ? Youtube
                            : null
                    }
                  />
                ))
              ) : (
                <p className="py-8 text-sm text-gray-500">
                  No activity yet. Generate and save your first post.
                </p>
              )}
            </div>
          </div>

          {/* Quick Tools */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.a
              href="/dashboard/video-shorts"
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 sm:rounded-3xl sm:p-8"
            >
              <div className="relative z-10">
                <h4 className="text-xl font-bold mb-2 flex items-center gap-2">
                  Video to Shorts <ArrowUpRight size={20} />
                </h4>
                <p className="text-blue-100 text-sm">
                  Transform your long content into viral clips instantly.
                </p>
              </div>
              <Video className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 rotate-12 transition-transform group-hover:rotate-0" />
            </motion.a>
            <motion.a
              href="/dashboard/auto-reply"
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:rounded-3xl sm:p-8"
            >
              <div className="relative z-10">
                <h4 className="text-xl font-bold mb-2 flex items-center gap-2 text-white">
                  AI Auto-Reply <ArrowUpRight size={20} />
                </h4>
                <p className="text-gray-500 text-sm">
                  Keep your engagement high with AI-driven responses.
                </p>
              </div>
              <MessageSquare className="absolute -bottom-4 -right-4 w-32 h-32 text-white/[0.02] rotate-12 transition-transform group-hover:rotate-0" />
            </motion.a>
          </div>
        </div>

        {/* Sidebar Mini-Calendar or Stats */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h3 className="text-xl font-bold mb-6">Upcoming Queue</h3>
            <div className="space-y-6">
              {(upcoming.length ? upcoming : []).map((item) => {
                const scheduledDate = new Date(item.scheduled_at);
                return (
                <div key={item.id} className="flex min-w-0 gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">
                      {scheduledDate.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span className="text-xs font-bold">
                      {scheduledDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-blue-400 font-semibold">
                      {item.platform}
                    </div>
                  </div>
                </div>
              )})}
              {!upcoming.length && (
                <p className="text-sm text-gray-500">
                  Scheduled posts will appear here.
                </p>
              )}
            </div>
            <button className="w-full mt-10 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm transition-all border border-white/10">
              Manage Content Queue
            </button>
          </div>

          <div className="rounded-2xl border border-blue-600/20 bg-blue-600/10 p-5 sm:rounded-3xl sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <Zap size={20} className="text-white fill-white" />
              </div>
              <h4 className="font-bold">Pro Features</h4>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Unlock Unlimited Video Shorts and Custom Brand Voices with our Pro
              Plan.
            </p>
            <Link
              to="/billing/checkout?plan=pro"
              className="block w-full rounded-2xl bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
