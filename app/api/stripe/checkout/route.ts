// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout Session for a quote deposit (or full balance).
// Called from the "Pay Deposit" button on the quote page.
//
// Flow:
//   1. Client POSTs { quoteId } to this endpoint
//   2. We look up the quote in Supabase to get the amount
//   3. We compute deposit = grandTotal × (depositPct / 100)
//   4. We create a Stripe Checkout Session with that amount
//   5. We save the session_id on the quote so the webhook can match it
//   6. We return the checkout URL → client redirects there
//
// IMPORTANT: All math happens server-side. Never trust amounts from the client.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

// HST rate for Ontario (you said CAD + HST 13%)
const HST_RATE = 0.13;

export async function POST(req: NextRequest) {
  try {
    const { quoteId } = await req.json();
    if (!quoteId) {
      return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
    }

    // ── Look up the quote with all data needed to compute the price ──
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(`
        id,
        deposit_pct,
        include_hst,
        deposit_paid_at,
        customers (id, company_name, email),
        quote_items (id, quantity, unit_price)
      `)
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Already paid? Don't double-charge.
    if (quote.deposit_paid_at) {
      return NextResponse.json({ error: "Deposit already paid for this quote" }, { status: 400 });
    }

    // ── Compute totals server-side ──
    const subtotal = (quote.quote_items || []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
    const hst = quote.include_hst ? subtotal * HST_RATE : 0;
    const grandTotal = subtotal + hst;

    // Deposit %: from quote, fallback 50. If 0 or 100, treat as full payment.
    const depositPct = Number(quote.deposit_pct ?? 50);
    const effectivePct = depositPct <= 0 ? 100 : depositPct;
    const amountDue = grandTotal * (effectivePct / 100);

    // Stripe wants amounts in cents (smallest currency unit)
    const amountCents = Math.round(amountDue * 100);

    if (amountCents < 50) {
      // Stripe's minimum charge is ~$0.50 in most currencies
      return NextResponse.json({ error: "Amount too small to charge" }, { status: 400 });
    }

    const customer: any = quote.customers;
    const isFullPayment = effectivePct >= 100;
    const lineLabel = isFullPayment
      ? `YAYA Sports — Quote #${String(quote.id).slice(0, 8).toUpperCase()} — Full payment`
      : `YAYA Sports — Quote #${String(quote.id).slice(0, 8).toUpperCase()} — ${depositPct}% deposit`;

    // Where Stripe sends the customer back to. Read from request origin so it
    // works on localhost AND production without env-var futzing.
    const origin =
      req.headers.get("origin") ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // ── Create the Checkout Session ──
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Pre-fill customer email (cards require it anyway)
      customer_email: customer?.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: amountCents,
            product_data: {
              name: lineLabel,
              description: customer?.company_name
                ? `Custom apparel & print order for ${customer.company_name}`
                : "Custom apparel & print order",
            },
          },
        },
      ],
      // Stripe will email a receipt automatically (you confirmed this is OK)
      // If you want to disable later: payment_intent_data: { receipt_email: undefined }
      success_url: `${origin}/quotes/${quote.id}?paid=true`,
      cancel_url: `${origin}/quotes/${quote.id}?cancelled=true`,
      // Metadata so the webhook knows which quote/job this belongs to
      metadata: {
        quote_id: String(quote.id),
        deposit_pct: String(effectivePct),
        deposit_amount: amountDue.toFixed(2),
        is_full_payment: isFullPayment ? "true" : "false",
      },
    });

    // ── Persist the session id on the quote so the webhook can verify ──
    await supabase
      .from("quotes")
      .update({
        stripe_session_id: session.id,
        deposit_amount: amountDue,
      })
      .eq("id", quote.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
