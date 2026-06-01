import supabase from "@/utils/supabase";

export const PLAN_IDS = ["starter", "pro", "agency"];

export const PLAN_DETAILS = {
  starter: {
    id: "starter",
    name: "Free",
    label: "Free Plan",
    price: "Free",
    limits: {
      aiPosts: 30,
      videoShorts: 10,
      autoReplies: 5,
      socialAccounts: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    label: "Pro Plan",
    price: "$7",
    indiaPrice: "₹599",
    indiaAmountPaise: 59900,
    limits: {
      aiPosts: Infinity,
      videoShorts: 30,
      autoReplies: Infinity,
      socialAccounts: Infinity,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    label: "Agency Plan",
    price: "$30",
    indiaPrice: "₹2,499",
    indiaAmountPaise: 249900,
    limits: {
      aiPosts: Infinity,
      videoShorts: Infinity,
      autoReplies: Infinity,
      socialAccounts: Infinity,
    },
  },
};

const SELECTED_PLAN_KEY = "socialoraa:selected-plan";
const USAGE_KEY_PREFIX = "socialoraa:plan-usage";

export const normalizePlan = (plan) => {
  const value = String(plan || "").trim().toLowerCase();
  if (["free", "starter"].includes(value)) return "starter";
  if (value === "pro") return "pro";
  if (value === "agency") return "agency";
  return "starter";
};

export const getPlanDetails = (plan) => PLAN_DETAILS[normalizePlan(plan)];

export const getPlanLabel = (plan) => getPlanDetails(plan).label;

export const getUserPlan = (user) =>
  normalizePlan(user?.plan || user?.raw?.user_metadata?.plan);

export const isPaidPlan = (plan) => ["pro", "agency"].includes(normalizePlan(plan));

export const getPlanFromSearch = (search) => {
  const params = new URLSearchParams(search || "");
  const plan = params.get("plan");
  if (plan) return normalizePlan(plan);

  const callbackUrl = params.get("callbackUrl");
  if (!callbackUrl) return null;

  try {
    const callback = new URL(callbackUrl, "https://socialoraa.local");
    const callbackPlan = callback.searchParams.get("plan");
    return callbackPlan ? normalizePlan(callbackPlan) : null;
  } catch {
    return null;
  }
};

export const storeSelectedPlan = (plan) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_PLAN_KEY, normalizePlan(plan));
};

export const readSelectedPlan = () => {
  if (typeof window === "undefined") return null;
  const plan = window.localStorage.getItem(SELECTED_PLAN_KEY);
  return plan ? normalizePlan(plan) : null;
};

export const clearSelectedPlan = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_PLAN_KEY);
};

export const resolveSelectedPlan = (search) => {
  const urlPlan = getPlanFromSearch(search);
  if (urlPlan) {
    storeSelectedPlan(urlPlan);
    return urlPlan;
  }
  return readSelectedPlan() || "starter";
};

export async function applyPlanToCurrentUser(plan) {
  const selectedPlan = normalizePlan(plan);
  const { data, error } = await supabase.auth.updateUser({
    data: { plan: selectedPlan },
  });

  if (error) throw error;
  clearSelectedPlan();
  return data;
}

const getMonthKey = () => new Date().toISOString().slice(0, 7);

const usageKey = (userId) =>
  `${USAGE_KEY_PREFIX}:${userId || "guest"}:${getMonthKey()}`;

const readUsage = (userId) => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(usageKey(userId)) || "{}");
  } catch {
    return {};
  }
};

const writeUsage = (userId, usage) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(usageKey(userId), JSON.stringify(usage));
};

export const usageFeatureLabels = {
  aiPosts: "AI posts",
  videoShorts: "video to shorts",
  autoReplies: "auto comment replies",
};

export function checkUsageLimit(user, feature, amount = 1) {
  const plan = getPlanDetails(getUserPlan(user));
  const limit = plan.limits[feature];
  if (limit === Infinity || typeof limit !== "number") {
    return { allowed: true, plan, used: 0, limit };
  }

  const usage = readUsage(user?.id);
  const used = Number(usage[feature] || 0);
  const requested = Number(amount || 1);

  return {
    allowed: used + requested <= limit,
    plan,
    used,
    limit,
    requested,
    message: `You have reached your ${plan.label} limit for ${usageFeatureLabels[feature] || "this feature"}. Please switch plan.`,
  };
}

export function recordUsage(user, feature, amount = 1) {
  const plan = getPlanDetails(getUserPlan(user));
  const limit = plan.limits[feature];
  if (limit === Infinity || typeof limit !== "number") return;

  const usage = readUsage(user?.id);
  usage[feature] = Number(usage[feature] || 0) + Number(amount || 1);
  writeUsage(user?.id, usage);
}
