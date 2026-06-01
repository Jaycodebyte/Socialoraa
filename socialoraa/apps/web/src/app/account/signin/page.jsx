import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import useAuth from "@/utils/useAuth";
import { getPlanDetails, isPaidPlan, resolveSelectedPlan } from "@/utils/plans";
import { Chrome } from "lucide-react";

function MainComponent() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlan = resolveSelectedPlan(location.search);
  const selectedPlanDetails = getPlanDetails(selectedPlan);

  const { signInWithCredentials, signInWithGoogle } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      await signInWithCredentials({
        email,
        password,
        callbackUrl: "/dashboard",
        plan: selectedPlan,
        redirect: false,
      });
      navigate(
        isPaidPlan(selectedPlan)
          ? `/billing/checkout?plan=${selectedPlan}`
          : "/dashboard",
        { replace: true },
      );
    } catch (err) {
      setError(err.message || "Incorrect email or password. Please try again.");
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInWithGoogle({
        callbackUrl: isPaidPlan(selectedPlan) ? "/billing/checkout" : "/dashboard",
        plan: selectedPlan,
      });
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0A0B14] p-4 text-white">
      <form
        noValidate
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl bg-white/[0.03] p-10 border border-white/5 shadow-2xl backdrop-blur-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-600/20 mb-4">
            S
          </div>
          <h1 className="text-3xl font-bold text-center">Welcome Back</h1>
          <p className="text-gray-400 mt-2">
            Log in to continue with {selectedPlanDetails.label}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">
              Email
            </label>
            <input
              required
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">
              Password
            </label>
            <input
              required
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-4 text-base font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              or
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.08] disabled:opacity-50"
          >
            <Chrome size={20} />
            Continue with Google
          </button>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link
              to={`/account/signup?plan=${selectedPlan}`}
              className="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            >
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default MainComponent;
