import * as React from "react";
import supabase from "@/utils/supabase";
import { getPlanDetails } from "@/utils/plans";

const formatUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User",
    image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    plan: user.user_metadata?.plan || "starter",
    planLabel: getPlanDetails(user.user_metadata?.plan).label,
    raw: user,
  };
};

const useUser = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const refetchUser = React.useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(formatUser(user));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setUser(formatUser(user));
        setLoading(false);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(formatUser(session?.user));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, data: user, loading, refetch: refetchUser };
};

export { useUser };

export default useUser;
