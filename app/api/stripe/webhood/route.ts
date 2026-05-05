// app/api/stripe/webhook/route.ts
// Receives webhook events from Stripe.
//
// Events we handle:
//   • checkout.session.completed  →  payment confirmed, mark quote as paid
//                                    + auto-create the linked job
//
// Setup (in Stripe Dashboard):
//   1. Developers → Webhooks → Add endpoint
//   2. URL: https://YOURDOMAIN.com/api/stripe/webhook
//   3. Subscribe to: checkout.session.completed
//   4. Copy the Signing Secret → add as STRIPE_WEBHOOK_SECRET in .env.local
//
// Local testing: `stripe listen --forward-to localhost:4000/api/stripe/webhook`
//
// IMPORTANT: We MUST verify the signature. Otherwise anyone could POST a
// fake "payment succeeded" and mark quotes as paid for free.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import Stripe from "stripe";

// Next.js 15+ App Router: must read raw body for signature verification.
// This config disables automatic body parsing.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    console.error("[stripe/webhook] missing signature or secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Read raw body — required for Stripe's HMAC signature check
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error("[stripe/webhook] signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Handle the event ──
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
    }
    // (You can add more event types here later — refunds, disputes, etc.)
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[stripe/webhook] handler error:", err);
    // Return 500 — Stripe will retry, which is what we want
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const quoteId = session.metadata?.quote_id;
  if (!quoteId) {
    console.error("[stripe/webhook] no quote_id in metadata");
    return;
  }

  // Idempotency: if this quote already has deposit_paid_at, bail.
  // Stripe can fire the same webhook multiple times.
  const { data: existing } = await supabase
    .from("quotes")
    .select("id, deposit_paid_at, status, customers(company_name, email)")
    .eq("id", quoteId)
    .single();

  if (existing?.deposit_paid_at) {
    console.log("[stripe/webhook] quote", quoteId, "already marked paid — skipping");
    return;
  }

  const depositAmount = parseFloat(session.metadata?.deposit_amount || "0");
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  // 1. Mark the quote as paid + approved
  const { error: qErr } = await supabase
    .from("quotes")
    .update({
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: depositAmount,
      stripe_payment_intent_id: paymentIntent,
      status: "Approved",
    })
    .eq("id", quoteId);

  if (qErr) {
    console.error("[stripe/webhook] quote update failed:", qErr);
    throw qErr;
  }

  // 2. Auto-create the linked job (if one doesn't exist already)
  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!existingJob) {
    // Pick the next job_number — max + 1
    const { data: maxJobRow } = await supabase
      .from("jobs")
      .select("job_number")
      .order("job_number", { ascending: false })
      .limit(1)
      .single();
    const nextJobNumber = (maxJobRow?.job_number || 1000) + 1;

    const customer: any = (existing as any)?.customers;
    const jobTitle = customer?.company_name
      ? `${customer.company_name} — Quote ${String(quoteId).slice(0, 8).toUpperCase()}`
      : `Quote ${String(quoteId).slice(0, 8).toUpperCase()}`;

    const { error: jErr } = await supabase.from("jobs").insert([
      {
        quote_id: quoteId,
        job_number: nextJobNumber,
        title: jobTitle,
        stage: "Incoming",
      },
    ]);
    if (jErr) {
      console.error("[stripe/webhook] job create failed:", jErr);
      // Don't throw — the payment already succeeded. Log and move on.
    } else {
      console.log("[stripe/webhook] created job", nextJobNumber, "for quote", quoteId);
    }
  }

  console.log("[stripe/webhook] quote", quoteId, "marked paid: $" + depositAmount);
}
