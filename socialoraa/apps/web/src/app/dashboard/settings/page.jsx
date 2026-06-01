import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  LockKeyhole,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAuth from "@/utils/useAuth";
import useUser from "@/utils/useUser";
import supabase from "@/utils/supabase";
import { getPlanDetails, getPlanLabel, getUserPlan } from "@/utils/plans";
import {
  listPlatformConnections,
  removePlatformConnection,
  savePlatformConnection,
} from "@/utils/platformConnections";

const platforms = [
  {
    id: "youtube",
    name: "YouTube",
    provider: "google",
    oauthProvider: "google",
    icon: Youtube,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    scope:
      "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube.upload",
    proof:
      "Connect with Google. The owner approves channel read, comment reply, and upload access.",
  },
  {
    id: "facebook",
    name: "Facebook",
    provider: "meta",
    oauthProvider: "facebook",
    icon: Facebook,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    scope:
      "public_profile email pages_show_list pages_read_engagement pages_manage_posts pages_manage_engagement",
    comingSoon: true,
    proof:
      "Facebook publishing will be available soon.",
  },
  {
    id: "instagram",
    name: "Instagram",
    provider: "meta",
    oauthProvider: "facebook",
    icon: Instagram,
    color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    scope:
      "public_profile email pages_show_list pages_read_engagement instagram_basic instagram_content_publish instagram_manage_comments",
    proof:
      "Connect through Meta. Instagram must be a Business or Creator account linked to a Facebook Page.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    provider: "linkedin",
    oauthProvider: "linkedin_oidc",
    icon: Linkedin,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    scope: "openid profile email w_member_social",
    proof:
      "Connect with LinkedIn. The signed-in member or organization admin grants posting access.",
  },
];

const SettingRow = ({ label, desc, children }) => (
  <div className="flex flex-col justify-between gap-4 border-b border-white/5 py-6 md:flex-row md:items-center md:py-8">
    <div className="max-w-md">
      <h4 className="font-bold text-lg">{label}</h4>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
    <div className="w-full md:w-auto">{children}</div>
  </div>
);

const getOAuthQueryParams = (platform) => {
  if (platform.oauthProvider === "google") {
    return {
      access_type: "offline",
      prompt: "select_account consent",
    };
  }

  if (platform.oauthProvider === "facebook") {
    return {
      auth_type: "rerequest",
    };
  }

  return {};
};

const PlatformBadge = ({ platform }) => {
  const config = platforms.find((item) => item.id === platform);
  const Icon = config?.icon || Globe;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
        config?.color || "border-white/10 bg-white/5 text-gray-400"
      }`}
    >
      <Icon size={16} />
      {config?.name || platform}
    </div>
  );
};

async function readVerifiedPlatformAccount(platformId, token, fallbackLabel, fallbackId) {
  if (!token && platformId === "youtube") {
    throw new Error("Google did not return a YouTube access token. Reconnect and approve YouTube permissions.");
  }

  if (!token) {
    return { accountLabel: fallbackLabel, externalAccountId: fallbackId };
  }

  if (platformId === "youtube") {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          "Google rejected the YouTube token. Reconnect and approve YouTube upload permission.",
      );
    }

    const channel = data.items?.[0];

    if (channel) {
      return {
        accountLabel: channel.snippet?.title || fallbackLabel,
        externalAccountId: channel.id || fallbackId,
      };
    }

    throw new Error("No YouTube channel was found for the connected Google account.");
  }

  if (platformId === "linkedin") {
    const response = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await response.json();

    return {
      accountLabel: profile.name || profile.email || fallbackLabel,
      externalAccountId: profile.sub || fallbackId,
    };
  }

  if (platformId === "facebook" || platformId === "instagram") {
    const response = await fetch(
      "https://graph.facebook.com/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    const pages = data.data || [];

    if (platformId === "instagram") {
      const pageWithInstagram = pages.find(
        (page) => page.instagram_business_account?.id,
      );

      if (pageWithInstagram) {
        const instagram = pageWithInstagram.instagram_business_account;
        return {
          accountLabel:
            instagram.username || instagram.name || `${pageWithInstagram.name} Instagram`,
          externalAccountId: instagram.id,
          accessToken: pageWithInstagram.access_token || token,
          accountMetadata: {
            facebookPageId: pageWithInstagram.id,
            facebookPageName: pageWithInstagram.name,
          },
        };
      }

      throw new Error(
        "No linked Instagram Business or Creator account was found on your Facebook Pages.",
      );
    }

    const page = pages[0];
    if (page) {
      return {
        accountLabel: page.name || fallbackLabel,
        externalAccountId: page.id || fallbackId,
        accessToken: page.access_token || token,
      };
    }
  }

  return { accountLabel: fallbackLabel, externalAccountId: fallbackId };
}

function PlatformModal({
  connections,
  onClose,
  onConnect,
  onDisconnect,
  loading,
  setupError,
  onDismissSetupError,
}) {
  const connectedByPlatform = useMemo(
    () =>
      connections.reduce((acc, item) => {
        acc[item.platform] = item;
        return acc;
      }, {}),
    [connections],
  );

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-[#10111d] shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-300">
              <ShieldCheck size={18} />
              Owner-verified connections
            </div>
            <h2 className="text-2xl font-bold">Connected Platforms</h2>
            <p className="mt-2 max-w-xl text-sm text-gray-400">
              Public channel links are not accepted. Each platform must be
              connected by the account owner using OAuth permissions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/5 p-2 text-gray-400 transition-colors hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {setupError && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {setupError.platformName} setup required
                  </div>
                  <p className="mt-1 text-sm text-amber-100/80">
                    Enable {setupError.providerName} in Supabase Authentication
                    Providers and add its client ID and secret before verifying
                    ownership.
                  </p>
                  <p className="mt-2 break-words text-xs text-amber-100/60">
                    Supabase rejected the provider before the account login could start.
                  </p>
                </div>
                <button
                  onClick={onDismissSetupError}
                  className="rounded-lg bg-white/10 p-1 text-amber-100/70 transition-colors hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const connection = connectedByPlatform[platform.id];
            const isComingSoon = platform.comingSoon && !connection;

            return (
              <div
                key={platform.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${platform.color}`}
                    >
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{platform.name}</h3>
                        {connection ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            <CheckCircle2 size={12} /> Verified
                          </span>
                        ) : isComingSoon ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <LockKeyhole size={12} /> Not connected
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-words text-sm text-gray-400">
                        {connection?.account_label || platform.proof}
                      </p>
                    </div>
                  </div>

                  {connection ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => onConnect(platform)}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500"
                      >
                        <ExternalLink size={16} />
                        Reconnect
                      </button>
                      <button
                        onClick={() => onDisconnect(connection.id)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={16} />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onConnect(platform)}
                      disabled={loading || isComingSoon}
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500"
                    >
                      <ExternalLink size={16} />
                      {isComingSoon ? "Coming Soon" : "Verify Owner"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: user } = useUser();
  const { signInWithProvider } = useAuth();
  const queryClient = useQueryClient();
  const [brandName, setBrandName] = useState("My Brand");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("English");
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [platformSetupError, setPlatformSetupError] = useState(null);

  const { data: connections = [] } = useQuery({
    queryKey: ["platform-connections", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listPlatformConnections(user.id),
  });

  const saveConnectionMutation = useMutation({
    mutationFn: (input) => savePlatformConnection(user.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-connections", user?.id],
      });
      toast.success("Platform ownership verified");
    },
    onError: (error) =>
      toast.error(error.message || "Could not save platform connection"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId) => removePlatformConnection(user.id, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-connections", user?.id],
      });
      toast.success("Platform disconnected");
    },
    onError: () => toast.error("Could not disconnect platform"),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("connectedPlatform");
    if (!platform || !user?.id) return;

    const saveVerifiedConnection = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const config = platforms.find((item) => item.id === platform);
      const plan = getPlanDetails(getUserPlan(user));
      const isExistingPlatform = connections.some(
        (connection) => connection.platform === platform,
      );
      if (
        !isExistingPlatform &&
        plan.limits.socialAccounts !== Infinity &&
        connections.length >= plan.limits.socialAccounts
      ) {
        toast.error(`Your ${plan.label} includes ${plan.limits.socialAccounts} social account. Please switch plan.`);
        window.history.replaceState({}, "", "/dashboard/settings");
        setIsPlatformModalOpen(true);
        setConnectingPlatform(null);
        return;
      }
      const fallbackLabel = user.email || `${config?.name || platform} owner`;
      const fallbackId = user.id;
      let verifiedAccount;

      try {
        verifiedAccount = await readVerifiedPlatformAccount(
          platform,
          session?.provider_token,
          fallbackLabel,
          fallbackId,
        );
      } catch (error) {
        toast.error(error.message || "Could not read the connected account");
        if (platform === "youtube") {
          window.history.replaceState({}, "", "/dashboard/settings");
          setIsPlatformModalOpen(true);
          setConnectingPlatform(null);
          return;
        }
        verifiedAccount = {
          accountLabel: `${fallbackLabel} · owner verified`,
          externalAccountId: fallbackId,
        };
      }

      await saveConnectionMutation.mutateAsync({
        platform,
        provider: config?.provider || platform,
        accountLabel: verifiedAccount.accountLabel,
        externalAccountId: verifiedAccount.externalAccountId,
        accessToken: verifiedAccount.accessToken || session?.provider_token || null,
        refreshToken: session?.provider_refresh_token || null,
        tokenExpiresAt: session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        scopes: config?.scope || null,
        accountMetadata: {
          oauthProvider: config?.oauthProvider,
          ...(verifiedAccount.accountMetadata || {}),
          savedAt: new Date().toISOString(),
        },
      });

      window.history.replaceState({}, "", "/dashboard/settings");
      setIsPlatformModalOpen(true);
      setConnectingPlatform(null);
    };

    saveVerifiedConnection().catch((error) => {
      toast.error(error.message || "Could not save platform connection");
      window.history.replaceState({}, "", "/dashboard/settings");
      setIsPlatformModalOpen(true);
      setConnectingPlatform(null);
    });
  }, [connections, saveConnectionMutation, user]);

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  const handleConnectPlatform = async (platform) => {
    const plan = getPlanDetails(getUserPlan(user));
    if (
      plan.limits.socialAccounts !== Infinity &&
      connections.length >= plan.limits.socialAccounts &&
      !connections.some((connection) => connection.platform === platform.id)
    ) {
      toast.error(`Your ${plan.label} includes ${plan.limits.socialAccounts} social account. Please switch plan.`);
      return;
    }

    setConnectingPlatform(platform.id);
    setPlatformSetupError(null);
    try {
      await signInWithProvider(platform.oauthProvider, {
        callbackUrl: `/dashboard/settings?connectedPlatform=${platform.id}`,
        scopes: platform.scope,
        preflight: true,
        queryParams: getOAuthQueryParams(platform),
      });
    } catch (error) {
      setConnectingPlatform(null);
      const message = error.message || "Could not start owner verification";
      if (/not enabled in Supabase|Authentication > Providers/i.test(message)) {
        setPlatformSetupError({
          platformName: platform.name,
          providerName:
            platform.oauthProvider === "linkedin_oidc" ? "LinkedIn OIDC" : platform.name,
        });
        return;
      }

      toast.error(message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-24 sm:space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Account Settings ⚙️
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your profile, brand kit, and preferences.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-bold shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 sm:w-auto"
        >
          <Save size={18} /> Save Changes
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] sm:rounded-3xl">
        <div className="flex flex-col gap-5 border-b border-white/5 bg-white/[0.02] p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
          <div className="relative group">
            <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center font-bold text-3xl overflow-hidden shadow-2xl">
              {user?.image ? (
                <img src={user.image} className="w-full h-full object-cover" />
              ) : (
                (user?.name || "U")[0].toUpperCase()
              )}
            </div>
            <button className="absolute -bottom-2 -right-2 p-2 bg-white text-black rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
              <Camera size={16} />
            </button>
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-bold">
              {user?.name || "Socialoraa User"}
            </h2>
            <p className="break-words text-gray-500">{user?.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-md">
                {getPlanLabel(user?.plan)}
              </span>
              <span className="px-2 py-1 bg-white/5 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-md">
                Member since 2026
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-10">
          <SettingRow
            label="Brand Identity"
            desc="How your brand appears in generated content and replies."
          >
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 w-full md:w-64"
            />
          </SettingRow>

          <SettingRow
            label="Default Voice Tone"
            desc="The default tone AI will use for your content."
          >
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="bg-[#0A0B14] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 w-full md:w-64 cursor-pointer"
            >
              <option>Professional</option>
              <option>Casual</option>
              <option>Witty</option>
              <option>Empathetic</option>
              <option>Viral/Aggressive</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Preferred Language"
            desc="All generated content will be in this language by default."
          >
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-[#0A0B14] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 w-full md:w-64 cursor-pointer"
            >
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
              <option>Hindi</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Connected Platforms"
            desc="Only verified owners can connect channels for automation."
          >
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {connections.length ? (
                connections.slice(0, 3).map((connection) => (
                  <PlatformBadge
                    key={connection.id}
                    platform={connection.platform}
                  />
                ))
              ) : (
                <>
                  <div className="p-3 bg-white/5 text-gray-500 rounded-xl border border-white/10 grayscale opacity-50">
                    <Globe size={20} />
                  </div>
                  <div className="p-3 bg-white/5 text-gray-500 rounded-xl border border-white/10 grayscale opacity-50">
                    <Smartphone size={20} />
                  </div>
                </>
              )}
              <button
                onClick={() => setIsPlatformModalOpen(true)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/10"
              >
                Manage
              </button>
            </div>
          </SettingRow>

          <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-12">
            <div className="space-y-1">
              <h4 className="font-bold text-red-400">Danger Zone</h4>
              <p className="text-sm text-gray-500">
                Permanently delete your account and all stored work.
              </p>
            </div>
            <button className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-sm font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white">
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {isPlatformModalOpen && (
        <PlatformModal
          connections={connections}
          loading={Boolean(connectingPlatform)}
          onClose={() => setIsPlatformModalOpen(false)}
          onConnect={handleConnectPlatform}
          onDisconnect={(connectionId) =>
            disconnectMutation.mutate(connectionId)
          }
          setupError={platformSetupError}
          onDismissSetupError={() => setPlatformSetupError(null)}
        />
      )}
    </div>
  );
}
