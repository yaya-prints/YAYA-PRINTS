// app/api/quotes/revive-request/route.ts
// Customer-facing endpoint. Called when an expired quote's "Revive" button is clicked.
//
// Records the request and emails YOU (the owner) with a one-click approve link.
// Does NOT auto-revive — you review pricing first, then approve.

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail, OWNER_NOTIFICATION_EMAIL } from "@/lib/email";
import { ownerRevivalRequestEmail } from "@/emails/templates";
import crypto from "crypto";

export const runtime = "nodejs";

function fmtMoney(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { quoteId, note } = await req.json();
    if (!quoteId) {
      return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
    }

    const { data: quote, error } = await supabase
      .from("quotes")
      .select(`
        id, created_at, revival_requested_at, revival_approved_at,
        customers (company_name, contact_name, email),
        quote_items (quantity, unit_price)
      `)
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.revival_requested_at && !quote.revival_approved_at) {
      return NextResponse.json({ error: "Revival already requested. We'll be in touch shortly." }, { status: 400 });
    }

    // Generate a one-time approval token so the owner's email link is safe to click
    const approvalToken = crypto.randomBytes(24).toString("hex");

    await supabase
      .from("quotes")
      .update({
        revival_requested_at: new Date().toISOString(),
        revival_request_note: note || null,
        revival_approval_token: approvalToken,
      })
      .eq("id", quoteId);

    const customer: any = quote.customers;
    const subtotal = (quote.quote_items || []).reduce(
      (s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    const ownerEmail = ownerRevivalRequestEmail({
      customerName: customer?.contact_name || customer?.company_name || "Customer",
      customerCompany: customer?.company_name || "Unknown",
      quoteId: quote.id,
      quoteRef: `#${String(quote.id).slice(0, 8).toUpperCase()}`,
      total: fmtMoney(subtotal),
      expiryDateStr: "",
      quoteUrl: `${baseUrl}/quotes/${quote.id}`,
      reviveUrl: "",
      note: note || undefined,
      approveUrl: `${baseUrl}/api/quotes/revive-approve?id=${quote.id}&token=${approvalToken}`,
    });

    await sendEmail({ to: OWNER_NOTIFICATION_EMAIL, ...ownerEmail });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[revive-request] error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
