import Stripe from "stripe";
import crypto from "node:crypto";
import { isPaidPlan, normalizePlan } from "@/utils/plans";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

export async function POST(request) {
  try {
    const body = await request.json();
    const provider = body.provider || "stripe";

    if (provider === "razorpay") {
      if (!razorpayKeySecret) {
        return Response.json(
          { error: "Razorpay is not configured. Payment cannot be verified." },
          { status: 500 },
        );
      }

      const plan = normalizePlan(body.plan);
      if (!isPaidPlan(plan)) {
        return Response.json({ error: "Invalid paid plan." }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac("sha256", razorpayKeySecret)
        .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
        .digest("hex");

      if (!body.razorpaySignature || expectedSignature !== body.razorpaySignature) {
        return Response.json({ error: "Indian payment verification failed." }, { status: 402 });
      }

      return Response.json({ paid: true, plan, provider: "razorpay" });
    }

    const { sessionId, plan: requestedPlan } = body;
    if (!stripe) {
      return Response.json(
        { error: "Stripe is not configured. Payment cannot be verified." },
        { status: 500 },
      );
    }

    if (!sessionId) {
      return Response.json({ error: "Missing checkout session." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionPlan = normalizePlan(session.metadata?.plan || requestedPlan);

    if (!isPaidPlan(sessionPlan)) {
      return Response.json({ error: "Invalid paid plan." }, { status: 400 });
    }

    const paid =
      session.status === "complete" &&
      ["paid", "no_payment_required"].includes(session.payment_status);

    if (!paid) {
      return Response.json(
        { error: "Payment is not complete yet." },
        { status: 402 },
      );
    }

    return Response.json({ paid: true, plan: sessionPlan });
  } catch (error) {
    console.error("Verify Checkout Session Error:", error);
    return Response.json(
      { error: error.message || "Could not verify payment." },
      { status: 500 },
    );
  }
}
