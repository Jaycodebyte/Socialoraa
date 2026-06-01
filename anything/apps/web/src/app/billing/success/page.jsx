import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { applyPlanToCurrentUser, getPlanDetails, getPlanFromSearch } from "@/utils/plans";

export default function BillingSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const selectedPlan = getPlanFromSearch(location.search) || "starter";
  const sessionId = params.get("session_id");
  const plan = getPlanDetails(selectedPlan);
  const [status, setStatus] = useState("Verifying payment...");
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const activatePlan = async () => {
      try {
        const response = await fetch("/api/billing/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan, sessionId }),
        });
        const data = await response.json();

        if (!response.ok || !data.paid) {
          throw new Error(data.error || "Payment could not be verified.");
        }

        await applyPlanToCurrentUser(data.plan);

        if (!isMounted) return;
        setStatus(`${getPlanDetails(data.plan).label} activated.`);
        window.setTimeout(() => navigate("/dashboard", { replace: true }), 900);
      } catch (error) {
        if (!isMounted) return;
        setError(error.message || "Payment could not be verified.");
        setStatus("Payment verification failed");
      }
    };

    activatePlan();

    return () => {
      isMounted = false;
    };
  }, [navigate, selectedPlan, sessionId]);

  return (
    <div className="grid min-h-screen w-full place-items-center bg-[#0A0B14] px-4 py-10 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-blue-950/20">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          {error ? <CheckCircle2 size={24} /> : <Loader2 className="animate-spin" size={24} />}
        </div>
        <h1 className="text-3xl font-bold">{status}</h1>
        <p className="mt-3 text-gray-400">
          {error
            ? `Your ${plan.label} was not activated yet.`
            : "You will be redirected to your dashboard in a moment."}
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {error && (
          <Link
            to={`/billing/checkout?plan=${selectedPlan}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
          >
            Try Payment Again
          </Link>
        )}
      </div>
    </div>
  );
}
