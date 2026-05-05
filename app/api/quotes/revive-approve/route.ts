// app/api/quotes/revive-approve/route.ts
// Owner-facing endpoint. Called when YOU click "Approve & Revive" in your email.
//
// One-time token verifies the request is legit. On approve:
//   1. Reset created_at to today (so 14-day clock restarts)
//   2. Clear expired_at, revival_*, last_reminder_sent_day
//   3. Set status back to pending
//   4. Email customer that quote is revived
//   5. Redirect owner to the quote page

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { customerRevivalApprovedEmail } from "@/emails/templates";

export const runtime = "nodejs";

function fmtMoney(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("token");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  if (!id || !token) {
    return NextResponse.redirect(`${baseUrl}/?revival_error=missing_params`);
  }

  try {
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(`
        id, revival_approval_token, revival_approved_at,
        customers (company_name, contact_name, email),
        quote_items (quantity, unit_price)
      `)
      .eq("id", id)
      .single();

    if (error || !quote) {
      return NextResponse.redirect(`${baseUrl}/?revival_error=not_found`);
    }

    if (quote.revival_approval_token !== token) {
      return NextResponse.redirect(`${baseUrl}/?revival_error=bad_token`);
    }

    if (quote.revival_approved_at) {
      // Already approved — just send owner to the quote
      return NextResponse.redirect(`${baseUrl}/quotes/${id}?already_revived=true`);
    }

    // Reset the validity clock + clear all expiry flags
    const now = new Date().toISOString();
    await supabase
      .from("quotes")
      .update({
        created_at: now,
        revival_approved_at: now,
        revival_approval_token: null,
        expired_at: null,
        last_reminder_sent_day: null,
        status: "pending",
      })
      .eq("id", id);

    // Notify the customer
    const customer: any = quote.customers;
    const subtotal = (quote.quote_items || []).reduce(
      (s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
    );
    const newExpiry = new Date(Date.now() + 14 * 86400000);

    if (customer?.email) {
      const t = customerRevivalApprovedEmail({
        customerName: customer.contact_name || customer.company_name || "there",
        customerCompany: customer.company_name || "your team",
        quoteId: quote.id,
        quoteRef: `#${String(quote.id).slice(0, 8).toUpperCase()}`,
        total: fmtMoney(subtotal),
        expiryDateStr: fmtDate(newExpiry),
        quoteUrl: `${baseUrl}/quotes/${quote.id}`,
        reviveUrl: "",
      });
      await sendEmail({ to: customer.email, ...t });
    }

    return NextResponse.redirect(`${baseUrl}/quotes/${id}?revived=true`);
  } catch (err: any) {
    console.error("[revive-approve] error:", err);
    return NextResponse.redirect(`${baseUrl}/?revival_error=server`);
  }
}
