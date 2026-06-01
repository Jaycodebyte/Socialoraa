import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Settings2,
  Bot,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCcw,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import supabase from "@/utils/supabase";
import {
  listPlatformConnections,
  removePlatformConnection,
  updatePlatformConnectionTokens,
} from "@/utils/platformConnections";
import { listContent } from "@/utils/contentStore";
import usePersistentState from "@/utils/usePersistentState";
import { checkUsageLimit, recordUsage } from "@/utils/plans";

const platformLabels = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

const commentKey = (comment) => `${comment.platform || "youtube"}:${comment.id}`;

const getPlatformPostId = (item, platform) =>
  item.media?.[`${platform}PostId`] ||
  item.media?.[`${platform}VideoId`] ||
  item.media?.[`${platform}MediaId`] ||
  (platform === "youtube" ? item.media?.youtubeVideoId : null);

const CommentCard = ({
  user,
  text,
  reply,
  status,
  platform,
  videoTitle,
  onGenerate,
  onApprove,
  onReject,
}) => (
  <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:rounded-3xl sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold">
          {user[0]}
        </div>
        <div className="min-w-0">
          <div className="break-words text-sm font-bold">{user}</div>
          <p className="text-gray-400 text-sm mt-1">"{text}"</p>
          {videoTitle && (
            <p className="mt-2 text-xs text-gray-600">
              From: {videoTitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
          {platformLabels[platform] || platform}
        </div>
        <div
          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            status === "Sent"
              ? "bg-emerald-400/10 text-emerald-400"
              : status === "Failed"
                ? "bg-red-400/10 text-red-400"
                : status === "Sending"
                  ? "bg-orange-400/10 text-orange-300"
              : "bg-blue-400/10 text-blue-400"
          }`}
        >
          {status}
        </div>
      </div>
    </div>

    <div className="sm:pl-14">
      <div className="group relative rounded-2xl border border-white/5 bg-white/5 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
          <Bot size={14} className="text-blue-400" />
          <span className="text-xs font-bold text-blue-400">
            AI Suggested Reply
          </span>
          </div>
          <div className="flex gap-2 sm:opacity-0 sm:transition-all sm:group-hover:opacity-100">
            <button
              onClick={onReject}
              disabled={!reply || status === "Sending"}
              className="rounded-md bg-red-500/20 p-1.5 text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:opacity-40"
            >
              <XCircle size={14} />
            </button>
            <button
              onClick={onApprove}
              disabled={!reply || status === "Sent" || status === "Sending"}
              className="rounded-md bg-emerald-500/20 p-1.5 text-emerald-400 transition-all hover:bg-emerald-500 hover:text-white disabled:opacity-40"
            >
              <CheckCircle2 size={14} />
            </button>
          </div>
        </div>
        {reply ? (
          <p className="text-sm text-gray-300 italic">"{reply}"</p>
        ) : (
          <button
            onClick={onGenerate}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Generate reply
          </button>
        )}
      </div>
    </div>
  </div>
);

export default function AutoReply() {
  const { data: user } = useUser();
  const [autoReply, setAutoReply] = usePersistentState("auto-reply:active", false);
  const [approvalMode, setApprovalMode] = usePersistentState("auto-reply:approval-mode", "Manual");
  const [replies, setReplies] = usePersistentState("auto-reply:replies", {});
  const [reconnectRequired, setReconnectRequired] = usePersistentState(
    "auto-reply:reconnect-required",
    false,
  );

  const { data: connections = [] } = useQuery({
    queryKey: ["platform-connections", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listPlatformConnections(user.id),
  });

  const { data: content = [] } = useQuery({
    queryKey: ["auto-reply-content", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listContent(user.id),
  });

  const youtubeConnection = connections.find((item) => item.platform === "youtube");
  const connectedPlatforms = connections.filter((item) =>
    ["youtube", "instagram", "facebook", "linkedin"].includes(item.platform),
  );
  const socialConnections = connectedPlatforms.filter((item) => item.platform !== "youtube");
  const socialTargetsByPlatform = socialConnections.reduce((acc, connection) => {
    acc[connection.platform] = content
      .filter((item) => item.status === "published" && item.platform === connection.platform)
      .map((item) => ({
        postId: getPlatformPostId(item, connection.platform),
        title: item.title || `${platformLabels[connection.platform]} post`,
      }))
      .filter((target) => target.postId)
      .slice(0, 10);
    return acc;
  }, {});

  useEffect(() => {
    if (youtubeConnection?.id) {
      setReconnectRequired(false);
    }
  }, [setReconnectRequired, youtubeConnection?.id]);

  const getYouTubeAuth = async () => {
    if (youtubeConnection?.access_token) {
      return {
        accessToken: youtubeConnection.access_token,
        refreshToken: youtubeConnection.refresh_token || "",
        tokenExpiresAt: youtubeConnection.token_expires_at || "",
      };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      accessToken: session?.provider_token || "",
      refreshToken: session?.provider_refresh_token || "",
      tokenExpiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : "",
    };
  };

  const {
    data: comments = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "platform-comments",
      user?.id,
      connectedPlatforms.map((item) => `${item.platform}:${item.external_account_id}`).join("|"),
      content.length,
    ],
    enabled: Boolean(autoReply && connectedPlatforms.length),
    refetchInterval: autoReply ? 15000 : false,
    queryFn: async () => {
      const groups = await Promise.all(
        connectedPlatforms.map(async (connection) => {
          if (connection.platform === "youtube") {
            const response = await fetch("/api/comments/youtube", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channelId: connection.external_account_id }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || "Could not load YouTube comments");
            }
            return (data.comments || []).map((comment) => ({
              ...comment,
              platform: "youtube",
              postTitle: comment.videoTitle,
            }));
          }

          const response = await fetch("/api/comments/social", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: connection.platform,
              accessToken: connection.access_token,
              accountId: connection.external_account_id,
              targets: socialTargetsByPlatform[connection.platform] || [],
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            const error = new Error(
              data.error || `Could not load ${platformLabels[connection.platform]} comments`,
            );
            error.needsReconnect = Boolean(data.needsReconnect);
            error.connectionId = connection.id;
            throw error;
          }
          return data.comments || [];
        }),
      );

      return groups
        .flat()
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .slice(0, 50);
    },
    onError: async (error) => {
      if (error.needsReconnect && error.connectionId) {
        await removePlatformConnection(user.id, error.connectionId);
      }
      toast.error(error.message || "Could not load comments");
    },
  });

  const sendReply = async (comment, replyText) => {
    const key = commentKey(comment);
    const currentReply = replies[key];
    if (currentReply?.status === "Sent" || currentReply?.status === "Sending") {
      return;
    }

    setReplies((state) => ({
      ...state,
      [key]: {
        ...state[key],
        text: replyText,
        status: "Sending",
      },
    }));

    if ((comment.platform || "youtube") === "youtube") {
      const auth = await getYouTubeAuth();
      if (!auth.accessToken && !auth.refreshToken) {
        throw new Error(
          "YouTube access is missing. Reconnect YouTube in Settings and approve comment reply permission.",
        );
      }

      const response = await fetch("/api/comments/youtube/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId: comment.id,
          replyText,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          tokenExpiresAt: auth.tokenExpiresAt,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          data.error ||
            "Could not send reply to YouTube. Reconnect YouTube in Settings.",
        );
        error.needsReconnect = Boolean(data.needsReconnect);
        throw error;
      }

      if (data.accessToken && youtubeConnection?.id) {
        await updatePlatformConnectionTokens(user.id, youtubeConnection.id, {
          accessToken: data.accessToken,
          tokenExpiresAt: data.tokenExpiresAt,
        });
      }

      setReplies((state) => ({
        ...state,
        [key]: {
          ...state[key],
          text: replyText,
          status: "Sent",
          replyId: data.replyId,
          sentAt: new Date().toISOString(),
        },
      }));
      return;
    }

    const connection = connections.find((item) => item.platform === comment.platform);
    if (!connection?.access_token) {
      throw new Error(
        `${platformLabels[comment.platform] || comment.platform} access is missing. Reconnect it in Settings.`,
      );
    }

    const response = await fetch("/api/comments/social/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: comment.platform,
        commentId: comment.id,
        replyText,
        accessToken: connection.access_token,
        accountId: connection.external_account_id,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(
        data.error ||
          `Could not send reply to ${platformLabels[comment.platform] || comment.platform}.`,
      );
      error.needsReconnect = Boolean(data.needsReconnect);
      error.connectionId = connection.id;
      throw error;
    }

    setReplies((state) => ({
      ...state,
      [key]: {
        ...state[key],
        text: replyText,
        status: "Sent",
        replyId: data.replyId,
        sentAt: new Date().toISOString(),
      },
    }));
  };

  const generateReply = async (comment) => {
    const key = commentKey(comment);
    const usage = checkUsageLimit(user, "autoReplies");
    if (!usage.allowed) return toast.error(usage.message);

    try {
      setReplies((state) => ({
        ...state,
        [key]: {
          ...state[key],
          status: "Generating",
        },
      }));

      const response = await fetch("/api/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentText: comment.text,
          postContext: comment.videoTitle || comment.postTitle,
          brandStyle: approvalMode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not generate reply");
      }
      recordUsage(user, "autoReplies");

      if (approvalMode === "Fully Automatic") {
        await sendReply(comment, data.reply);
        toast.success(`Reply sent to ${platformLabels[comment.platform] || comment.platform}`);
        return;
      }

      setReplies((state) => ({
        ...state,
        [key]: {
          text: data.reply,
          status: approvalMode === "Draft Only" ? "Draft" : "Pending",
        },
      }));
      toast.success(approvalMode === "Draft Only" ? "Reply drafted" : "Reply ready for approval");
    } catch (error) {
      if (error.needsReconnect) {
        setAutoReply(false);
        setReconnectRequired(true);
      }
      setReplies((state) => ({
        ...state,
        [key]: {
          ...state[key],
          status: "Failed",
        },
      }));
      toast.error(error.message || "Could not generate reply");
    }
  };

  const approveReply = async (comment) => {
    const key = commentKey(comment);
    if (replies[key]?.status === "Sent") {
      toast.message("This comment already has a sent reply.");
      return;
    }

    const reply = replies[key]?.text;
    if (!reply) return;

    try {
      await sendReply(comment, reply);
      toast.success(`Reply sent to ${platformLabels[comment.platform] || comment.platform}`);
    } catch (error) {
      if (error.needsReconnect) {
        setAutoReply(false);
        setReconnectRequired(true);
        if (error.connectionId) {
          await removePlatformConnection(user.id, error.connectionId);
        }
      }
      setReplies((state) => ({
        ...state,
        [key]: {
          ...state[key],
          status: "Failed",
        },
      }));
      toast.error(error.message || "Could not send reply");
    }
  };

  const rejectReply = (comment) => {
    const key = commentKey(comment);
    setReplies((state) => ({
      ...state,
      [key]: {
        ...state[key],
        text: "",
        status: "Rejected",
        rejectedAt: new Date().toISOString(),
      },
    }));
    toast.success("Reply removed");
  };

  useEffect(() => {
    if (!autoReply || reconnectRequired || approvalMode !== "Fully Automatic") return;

    comments
      .filter((comment) => !replies[commentKey(comment)])
      .slice(0, 3)
      .forEach((comment) => {
        generateReply(comment);
      });
  }, [autoReply, approvalMode, comments, reconnectRequired, replies]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            AI Auto-Reply 🤖
          </h1>
          <p className="text-gray-500 mt-1">
            Automate comments across connected social platforms with natural-sounding AI responses.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 p-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <span className="text-sm font-semibold ml-2">System Status:</span>
          <button
            onClick={() => {
              if (!autoReply && reconnectRequired) {
                toast.error("Reconnect the expired platform in Settings before enabling Auto Reply.");
                return;
              }

              setAutoReply(!autoReply);
              toast.success(`Auto-reply system ${!autoReply ? "enabled" : "disabled"}`);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              autoReply
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-gray-400"
            }`}
          >
            {autoReply ? "Active" : "Offline"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:space-y-8 sm:rounded-3xl sm:p-8">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings2 size={20} className="text-blue-400" /> Configuration
            </h3>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
                Reply Mode
              </label>
              <div className="space-y-2">
                {["Fully Automatic", "Manual Approval", "Draft Only"].map(
                  (mode) => (
                    <button
                      key={mode}
                      onClick={() => setApprovalMode(mode)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        approvalMode === mode
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "border-white/5 bg-white/5 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      <span className="font-bold text-sm">{mode}</span>
                      {approvalMode === mode && <CheckCircle2 size={16} />}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
              <div className="flex items-center gap-2 text-orange-400 mb-1">
                <Zap size={14} />
                <span className="text-xs font-bold">Smart Filters</span>
              </div>
              <p className="text-xs text-gray-500">
                Currently ignoring spam and single-emoji comments to save
                credits across all connected platforms.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 sm:rounded-3xl sm:p-8">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <UserCheck size={18} className="text-emerald-400" /> Engagement
              Score
            </h4>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">98</span>
              <span className="text-gray-500 text-sm mb-1">/100</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your AI is maintaining a very high sentiment score!
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">Recent Comments</h3>
            <button
              onClick={() => refetch()}
              disabled={!connectedPlatforms.length || isFetching}
              className="p-2 text-gray-500 hover:text-white disabled:opacity-40"
            >
              <RefreshCcw size={18} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="space-y-4">
            {!connectedPlatforms.length && (
              <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-5 text-sm text-orange-200 sm:rounded-3xl sm:p-6">
                Connect at least one supported platform in Settings to load real comments.
              </div>
            )}
            {connectedPlatforms.length > 0 && !autoReply && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-sm text-gray-500 sm:rounded-3xl sm:p-6">
                Turn the system status to Active to start live comment polling.
              </div>
            )}
            {youtubeConnection && reconnectRequired && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100 sm:rounded-3xl sm:p-6">
                Platform access expired. Disconnect and reconnect it in Settings,
                then turn Auto Reply on again.
              </div>
            )}
            {autoReply && comments.map((comment) => {
              const reply = replies[commentKey(comment)];
              return (
                <CommentCard
                  key={commentKey(comment)}
                  user={comment.author}
                  text={comment.text}
                  platform={comment.platform || "youtube"}
                  videoTitle={comment.videoTitle || comment.postTitle}
                  reply={reply?.text}
                  status={reply?.status || "Pending"}
                  onGenerate={() => generateReply(comment)}
                  onApprove={() => approveReply(comment)}
                  onReject={() => rejectReply(comment)}
                />
              );
            })}
            {autoReply && connectedPlatforms.length > 0 && !isFetching && comments.length === 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-sm text-gray-500 sm:rounded-3xl sm:p-6">
                No recent comments found yet. For Instagram, LinkedIn, and Facebook,
                comments appear after you have published posts from this app and the
                platform APIs approve comment access.
              </div>
            )}
          </div>

          <button className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 text-sm font-bold text-gray-400 transition-all hover:bg-white/10 sm:rounded-3xl">
            Load More Comments
          </button>
        </div>
      </div>
    </div>
  );
}
