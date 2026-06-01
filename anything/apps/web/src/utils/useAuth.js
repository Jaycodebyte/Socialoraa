import { useCallback } from "react";
import supabase from "@/utils/supabase";
import { applyPlanToCurrentUser, isPaidPlan, normalizePlan } from "@/utils/plans";

const getCallbackUrl = (fallback = "/dashboard") => {
  if (typeof window === "undefined") return fallback;

  return new URLSearchParams(window.location.search).get("callbackUrl") || fallback;
};

const redirectTo = (url) => {
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
};

const withPlanParam = (url, plan) => {
  if (!plan) return url;

  const [path, query = ""] = String(url || "/dashboard").split("?");
  const params = new URLSearchParams(query);
  params.set("plan", normalizePlan(plan));
  return `${path}?${params.toString()}`;
};

function useAuth() {
  const signInWithCredentials = useCallback(async (options) => {
    const { email, password, redirect = true, plan } = options;
    const callbackUrl = getCallbackUrl(options.callbackUrl);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (plan && !isPaidPlan(plan)) {
      await applyPlanToCurrentUser(plan);
    }
    if (redirect) redirectTo(callbackUrl);

    return data;
  }, []);

  const signUpWithCredentials = useCallback(async (options) => {
    const { email, password, redirect = true, plan } = options;
    const callbackUrl = getCallbackUrl(options.callbackUrl);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          plan: isPaidPlan(plan) ? "starter" : normalizePlan(plan),
        },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}${callbackUrl}`
            : undefined,
      },
    });

    if (error) throw error;
    if (redirect && data.session) redirectTo(callbackUrl);

    return data;
  }, []);

  const signInWithGoogle = useCallback(async (options = {}) => {
    const plan = options.plan ? normalizePlan(options.plan) : null;
    const callbackUrl = getCallbackUrl(withPlanParam(options.callbackUrl || "/dashboard", plan));
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${callbackUrl}`
        : undefined;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: options.scopes,
        queryParams: options.queryParams,
      },
    });

    if (error) throw error;

    return data;
  }, []);

  const signInWithProvider = useCallback(async (provider, options = {}) => {
    const callbackUrl = getCallbackUrl(options.callbackUrl);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${callbackUrl}`
        : undefined;

    if (options.preflight) {
      const response = await fetch("/api/auth/oauth-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          redirectTo,
          scopes: options.scopes,
          queryParams: options.queryParams,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result?.redirectUrl) {
        throw new Error(
          result?.error ||
            "This OAuth provider is not enabled in Supabase. Enable it from Authentication > Providers, then try again.",
        );
      }

      if (typeof window !== "undefined") {
        window.location.href = result.redirectUrl;
      }

      return result;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: options.scopes,
        queryParams: options.queryParams,
      },
    });

    if (error) throw error;

    return data;
  }, []);

  const signOut = useCallback(async (options = {}) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    redirectTo(options.callbackUrl || "/");
  }, []);

  return {
    signInWithCredentials,
    signUpWithCredentials,
    signInWithGoogle,
    signInWithProvider,
    signOut,
  };
}

export default useAuth;
