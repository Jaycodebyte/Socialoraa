import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CreditCard, IndianRupee, Loader2 } from "lucide-react";
import useUser from "@/utils/useUser";
import { applyPlanToCurrentUser, getPlanDetails, getPlanFromSearch, isPaidPlan } from "@/utils/plans";

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Indian payment checkout."));
    document.body.appendChild(script);
  });

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user, loading } = useUser();
  const selectedPlan = getPlanFromSearch(location.search) || "starter";
  const plan = getPlanDetails(selectedPlan);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(null);
  const cancelled = new URLSearchParams(location.search).get("cancelled") === "1";

  useEffect(() => {
    if (loading) return;
    if (!isPaidPlan(selectedPlan)) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, navigate, selectedPlan]);

  const startStripeCheckout = async () => {
    setStarting("stripe");
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "stripe",
          plan: selectedPlan,
          userId: user?.id,
          email: user?.email,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not start payment.");
      }

      window.location.href = data.url;
    } catch (error) {
      setError(error.message || "Could not start payment.");
      setStarting(null);
    }
  };

  const startIndianCheckout = async () => {
    setStarting("razorpay");
    setError(null);

    try {
      await loadRazorpay();

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "razorpay",
          plan: selectedPlan,
          userId: user?.id,
          email: user?.email,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.orderId) {
        throw new Error(data.error || "Could not start Indian payment.");
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Socialoraa",
        description: data.description,
        order_id: data.orderId,
        prefill: {
          email: user?.email || "",
          name: user?.name || "",
        },
        theme: {
          color: "#2563eb",
        },
        handler: async (payment) => {
          try {
            const verifyResponse = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "razorpay",
                plan: selectedPlan,
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              }),
            });
            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.paid) {
              throw new Error(verifyData.error || "Indian payment could not be verified.");
            }

            await applyPlanToCurrentUser(verifyData.plan);
            navigate("/dashboard", { replace: true });
          } catch (error) {
            setError(error.message || "Indian payment could not be verified.");
            setStarting(null);
          }
        },
        modal: {
          ondismiss: () => setStarting(null),
        },
      });

      checkout.open();
    } catch (error) {
      setError(error.message || "Could not start Indian payment.");
      setStarting(null);
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center bg-[#0A0B14] px-4 py-10 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-blue-950/20">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          {starting ? <Loader2 className="animate-spin" size={24} /> : <CreditCard size={24} />}
        </div>
        <h1 className="text-3xl font-bold">Complete {plan.label}</h1>
        <p className="mt-3 text-gray-400">
          Your account is ready. Complete payment to activate {plan.label}.
        </p>
        <div className="my-8 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Subscription
          </div>
          <div className="mt-2 text-4xl font-bold">
            {plan.price}
            <span className="text-base font-medium text-gray-500"> / month</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-blue-300">
            India: {plan.indiaPrice} / month
          </div>
        </div>

        {cancelled && (
          <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            Payment was cancelled. You can try again when ready.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={startStripeCheckout}
          disabled={Boolean(starting) || loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          {starting === "stripe" ? "Opening Payment..." : "International Payment"}
        </button>
        <button
          type="button"
          onClick={startIndianCheckout}
          disabled={Boolean(starting) || loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 font-bold text-emerald-100 transition-all hover:bg-emerald-500/15 disabled:opacity-50"
        >
          {starting === "razorpay" ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <IndianRupee size={18} />
          )}
          Indian Payment: UPI / Cards / Netbanking
        </button>
        <Link
          to="/dashboard"
          className="mt-4 inline-block text-sm font-semibold text-gray-500 transition-colors hover:text-white"
        >
          Stay on Free Plan
        </Link>
      </div>
    </div>
  );
}
