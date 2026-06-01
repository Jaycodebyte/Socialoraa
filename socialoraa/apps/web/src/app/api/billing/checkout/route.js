import Stripe from "stripe";
import { PLAN_DETAILS, isPaidPlan, normalizePlan } from "@/utils/plans";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

const priceIds = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
};

const getOrigin = (request) => {
  const url = new URL(request.url);
  return process.env.PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
};

export async function POST(request) {
  try {
    const body = await request.json();
    const provider = body.provider || "stripe";
    const plan = normalizePlan(body.plan);
    const planDetails = PLAN_DETAILS[plan];

    if (!isPaidPlan(plan)) {
      return Response.json({ error: "Only Pro and Agency require payment." }, { status: 400 });
    }

    if (provider === "razorpay") {
      if (!razorpayKeyId || !razorpayKeySecret) {
        return Response.json(
          { error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
          { status: 500 },
        );
      }

      const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: planDetails.indiaAmountPaise,
          currency: "INR",
          receipt: `${plan}-${body.userId || "guest"}-${Date.now()}`.slice(0, 40),
          notes: {
            plan,
            userId: body.userId || "",
            email: body.email || "",
          },
        }),
      });
      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.error?.description || "Could not start Indian payment.");
      }

      return Response.json({
        provider: "razorpay",
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan,
        name: `Socialoraa ${planDetails.label}`,
        description: `${planDetails.indiaPrice} per month`,
      });
    }

    if (!stripe) {
      return Response.json(
        { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to start paid subscriptions." },
        { status: 500 },
      );
    }

    const origin = getOrigin(request);
    const lineItem = priceIds[plan]
      ? {
          price: priceIds[plan],
          quantity: 1,
        }
      : {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: plan === "pro" ? 700 : 3000,
            product_data: {
              name: `Socialoraa ${planDetails.label}`,
            },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: body.email || undefined,
      client_reference_id: body.userId || undefined,
      line_items: [lineItem],
      metadata: {
        plan,
        userId: body.userId || "",
      },
      subscription_data: {
        metadata: {
          plan,
          userId: body.userId || "",
        },
      },
      success_url: `${origin}/billing/success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/checkout?plan=${plan}&cancelled=1`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Create Checkout Session Error:", error);
    return Response.json(
      { error: error.message || "Could not start checkout." },
      { status: 500 },
    );
  }
}
