import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  MousePointer2,
  Share2,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  FileText,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import { getContentText, listContent } from "@/utils/contentStore";

const platformConfig = {
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-blue-600" },
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-600" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-600" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-indigo-600" },
};

const formatCompact = (value) => {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
};

const getItemDate = (item) => new Date(item.scheduled_at || item.updated_at || item.created_at);

const estimateReach = (item) => {
  const textLength = getContentText(item).length;
  const base =
    item.status === "scheduled"
      ? 180
      : item.status === "published"
        ? 420
        : 90;
  const platformBoost =
    item.platform === "instagram"
      ? 1.35
      : item.platform === "youtube"
        ? 1.5
        : item.platform === "linkedin"
          ? 1.2
          : 1;

  return Math.max(40, Math.round((base + textLength * 0.8) * platformBoost));
};

const getRangeDays = (range) => {
  if (range === "7") return 7;
  if (range === "90") return 90;
  return 30;
};

const buildAnalytics = (content, range) => {
  const days = getRangeDays(range);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  const filtered = content.filter((item) => {
    const date = getItemDate(item);
    return date >= start && date <= end;
  });

  const platformCounts = filtered.reduce((acc, item) => {
    const platform = item.platform || "linkedin";
    acc[platform] = acc[platform] || { count: 0, reach: 0 };
    acc[platform].count += 1;
    acc[platform].reach += estimateReach(item);
    return acc;
  }, {});

  const chartData = Array.from({ length: Math.min(days, 14) }).map((_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (Math.min(days, 14) - 1 - index));
    const key = date.toISOString().slice(0, 10);
    const dayItems = filtered.filter((item) => getItemDate(item).toISOString().slice(0, 10) === key);

    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      generated: dayItems.length,
      scheduled: dayItems.filter((item) => item.status === "scheduled").length,
      reach: dayItems.reduce((total, item) => total + estimateReach(item), 0),
    };
  });

  const topContent = [...filtered]
    .sort((a, b) => estimateReach(b) - estimateReach(a))
    .slice(0, 5);

  const totalReach = filtered.reduce((total, item) => total + estimateReach(item), 0);
  const scheduled = filtered.filter((item) => item.status === "scheduled").length;
  const generated = filtered.length;

  return {
    filtered,
    platformCounts,
    chartData,
    topContent,
    totalReach,
    scheduled,
    generated,
    ctr: generated ? Math.min(12, 2.8 + scheduled * 0.3).toFixed(1) : "0.0",
    sentiment: generated ? Math.min(98, 78 + Math.round(scheduled * 1.5)) : 0,
  };
};

const PlatformStat = ({ platform, name, value, growth, color }) => {
  const Icon = platform;
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-xs font-bold text-emerald-400">+{growth}%</span>
      </div>
      <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">
        {name}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#10111d] p-3 text-sm shadow-xl">
      <div className="mb-2 font-bold">{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-gray-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.name}: {item.value}
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { data: user } = useUser();
  const [range, setRange] = useState("30");
  const { data: content = [], isFetching } = useQuery({
    queryKey: ["analytics-content", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listContent(user.id),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const analytics = useMemo(() => buildAnalytics(content, range), [content, range]);
  const platformCards = ["linkedin", "instagram", "youtube"].map((platform) => {
    const config = platformConfig[platform];
    const data = analytics.platformCounts[platform] || { count: 0, reach: 0 };
    return {
      ...config,
      value: formatCompact(data.reach),
      growth: Math.min(99, 8 + data.count * 6),
    };
  });

  const exportReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Range days", getRangeDays(range)],
      ["Generated content", analytics.generated],
      ["Scheduled posts", analytics.scheduled],
      ["Estimated reach", analytics.totalReach],
      ["Average sentiment", `${analytics.sentiment}%`],
      ["Estimated CTR", `${analytics.ctr}%`],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "socialoraa-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-24 sm:space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Performance Analytics 📈
          </h1>
          <p className="text-gray-500 mt-1">
            Track real-time content activity across connected workflows.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[auto_auto]">
          <div className="relative">
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="appearance-none rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-9 text-sm font-bold outline-none"
            >
              <option value="7" className="bg-[#0A0B14]">Last 7 Days</option>
              <option value="30" className="bg-[#0A0B14]">Last 30 Days</option>
              <option value="90" className="bg-[#0A0B14]">Last 90 Days</option>
            </select>
            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2" />
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            onClick={exportReport}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold shadow-lg shadow-blue-600/20"
          >
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {platformCards.map((item) => (
          <PlatformStat
            key={item.label}
            platform={item.icon}
            name={item.label}
            value={item.value}
            growth={item.growth}
            color={item.color}
          />
        ))}
        <PlatformStat
          platform={Share2}
          name="Total Reach"
          value={formatCompact(analytics.totalReach)}
          growth={Math.min(99, 10 + analytics.generated * 4)}
          color="bg-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8 lg:col-span-2">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Content Activity</h3>
              <p className="text-sm text-gray-500">
                {isFetching ? "Refreshing live activity..." : "Generated, scheduled, and estimated reach."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-400">Generated</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-xs text-gray-400">Scheduled</span>
              </div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.chartData}>
                <defs>
                  <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name="Reach"
                  stroke="#3b82f6"
                  fill="url(#reachGradient)"
                  strokeWidth={3}
                  isAnimationActive
                  animationDuration={900}
                />
                <Bar dataKey="generated" name="Generated" fill="#60a5fa" radius={[8, 8, 0, 0]} animationDuration={900} />
                <Bar dataKey="scheduled" name="Scheduled" fill="#6366f1" radius={[8, 8, 0, 0]} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
          <h3 className="text-xl font-bold mb-8">Top Performing</h3>
          <div className="space-y-6">
            {analytics.topContent.length ? (
              analytics.topContent.map((item) => {
                const config = platformConfig[item.platform] || {
                  icon: FileText,
                  label: "General",
                };
                const Icon = config.icon;
                return (
                  <div key={item.id} className="group flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Icon size={18} className="text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCompact(estimateReach(item))} estimated interactions
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="text-gray-600 group-hover:text-white transition-all"
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">
                Generate or schedule content to see top performers.
              </p>
            )}
          </div>
          <button className="w-full mt-10 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm border border-white/10 transition-all">
            Detailed Analysis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center sm:rounded-3xl sm:p-8">
          <TrendingUp className="text-emerald-400 mb-4" size={32} />
          <div className="text-2xl font-bold">{analytics.sentiment}%</div>
          <div className="text-sm text-gray-500">Avg. Sentiment Score</div>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center sm:rounded-3xl sm:p-8">
          <Users className="text-blue-400 mb-4" size={32} />
          <div className="text-2xl font-bold">+{formatCompact(analytics.generated * 12)}</div>
          <div className="text-sm text-gray-500">Estimated audience lift</div>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center sm:rounded-3xl sm:p-8">
          <MousePointer2 className="text-purple-400 mb-4" size={32} />
          <div className="text-2xl font-bold">{analytics.ctr}%</div>
          <div className="text-sm text-gray-500">Estimated CTR</div>
        </div>
      </div>
    </div>
  );
}
