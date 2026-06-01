import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingConfigError = new Error(
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : {
        auth: {
          getUser: async () => ({ data: { user: null }, error: missingConfigError }),
          signInWithPassword: async () => ({ data: null, error: missingConfigError }),
          signUp: async () => ({ data: null, error: missingConfigError }),
          updateUser: async () => ({ data: null, error: missingConfigError }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({
            data: {
              subscription: {
                unsubscribe: () => {},
              },
            },
          }),
        },
      };

export default supabase;
