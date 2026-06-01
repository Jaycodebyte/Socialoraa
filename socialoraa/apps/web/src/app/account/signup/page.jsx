import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import useAuth from "@/utils/useAuth";
import { getPlanDetails, isPaidPlan, resolveSelectedPlan } from "@/utils/plans";
import { Chrome } from "lucide-react";

function MainComponent() {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlan = resolveSelectedPlan(location.search);
  const selectedPlanDetails = getPlanDetails(selectedPlan);

  const { signUpWithCredentials, signInWithGoogle } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const data = await signUpWithCredentials({
        email,
        password,
        callbackUrl: "/dashboard",
        plan: selectedPlan,
        redirect: false,
      });

      if (!data.session) {
        setSuccess("Account created. Please check your email to confirm it.");
        setLoading(false);
      } else {
        navigate(
          isPaidPlan(selectedPlan)
            ? `/billing/checkout?plan=${selectedPlan}`
            : "/dashboard",
          { replace: true },
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong during sign-up. Please try again.");
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

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
          <h1 className="text-3xl font-bold text-center">Create Account</h1>
          <p className="text-gray-400 mt-2">
            Start with {selectedPlanDetails.label}
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

          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-4 text-base font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
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
            Already have an account?{" "}
            <Link
              to={`/account/signin?plan=${selectedPlan}`}
              className="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default MainComponent;
