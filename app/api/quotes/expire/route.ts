// app/api/quotes/expire/route.ts
// Daily cron job that handles quote expiration and revival emails.
//
// Runs once per day. For every quote, computes age in days from created_at,
// then takes the appropriate action:
//
//   Day 13:  send "expires tomorrow" reminder to customer
//   Day 15:  mark expired + send revival email to customer + alert owner
//   Day 18:  send last-chance email to customer
//   Day 21:  mark as fully closed (no further emails)
//
// To prevent double-sending we record the last reminder day in
// `quotes.last_reminder_sent_day` so the same email never fires twice.
//
// Vercel Cron config: see vercel.json
//
// Manual trigger (for testing):
//   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourapp.com/api/quotes/expire

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail, OWNER_NOTIFICATION_EMAIL } from "@/lib/email";
import {
  dayBeforeExpiryEmail,
  expiredWithReviveEmail,
  lastChanceReviveEmail,
  ownerExpiredNoticeEmail,
} from "@/emails/templates";

export const runtime = "nodejs";
// Don't try to render this at build time
export const dynamic = "force-dynamic";

const VALIDITY_DAYS = 14;

function daysSince(date: Date): number {
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sends a Bearer token. Other callers (manual curl) use the same.
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { reminders_sent: 0, expired: 0, revival_sent: 0, last_chance: 0, closed: 0, errors: 0, processed: 0 };

  // Pull every quote that's still in play. We skip ones that are already
  // approved/paid (no point reminding) and ones already closed.
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select(`
      id, created_at, status, deposit_paid_at, last_reminder_sent_day,
      revival_requested_at, expired_at,
      customers (id, company_name, contact_name, email),
      quote_items (id, quantity, unit_price)
    `)
    .is("deposit_paid_at", null)
    .neq("status", "Approved")
    .neq("status", "Closed");

  if (error) {
    console.error("[cron/expire] supabase fetch error:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  for (const q of quotes || []) {
    stats.processed++;
    try {
      const created = new Date(q.created_at);
      const age = daysSince(created);
      const expiryDate = new Date(created.getTime() + VALIDITY_DAYS * 86400000);
      const customer: any = q.customers;
      if (!customer?.email) continue; // can't email no-one

      const subtotal = (q.quote_items || []).reduce(
        (s: number, it: any) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0
      );
      const total = fmtMoney(subtotal); // HST handled in display layer; total here is for context

      const ctx = {
        customerName: customer.contact_name || customer.company_name || "there",
        customerCompany: customer.company_name || "your team",
        quoteId: q.id,
        quoteRef: `#${String(q.id).slice(0, 8).toUpperCase()}`,
        total,
        expiryDateStr: fmtDate(expiryDate),
        quoteUrl: `${baseUrl}/quotes/${q.id}`,
        reviveUrl: `${baseUrl}/quotes/${q.id}?revive=true`,
      };

      const lastSent = q.last_reminder_sent_day ?? -1;

      // ── Day 13: "expires tomorrow" ──────────────────────────────────────
      if (age === 13 && lastSent < 13) {
        const t = dayBeforeExpiryEmail(ctx);
        await sendEmail({ to: customer.email, ...t });
        await supabase.from("quotes").update({ last_reminder_sent_day: 13 }).eq("id", q.id);
        stats.reminders_sent++;
      }

      // ── Day 15: expired + revival CTA + owner notice ────────────────────
      else if (age >= 15 && age < 18 && lastSent < 15) {
        const t = expiredWithReviveEmail(ctx);
        await sendEmail({ to: customer.email, ...t });
        const ownerT = ownerExpiredNoticeEmail(ctx);
        await sendEmail({ to: OWNER_NOTIFICATION_EMAIL, ...ownerT });
        await supabase.from("quotes").update({
          last_reminder_sent_day: 15,
          expired_at: new Date().toISOString(),
        }).eq("id", q.id);
        stats.expired++;
        stats.revival_sent++;
      }

      // ── Day 18: last chance ─────────────────────────────────────────────
      else if (age >= 18 && age < 21 && lastSent < 18) {
        const t = lastChanceReviveEmail(ctx);
        await sendEmail({ to: customer.email, ...t });
        await supabase.from("quotes").update({ last_reminder_sent_day: 18 }).eq("id", q.id);
        stats.last_chance++;
      }

      // ── Day 21+: close the file ─────────────────────────────────────────
      else if (age >= 21 && q.status !== "Closed") {
        await supabase.from("quotes").update({
          status: "Closed",
          last_reminder_sent_day: 21,
        }).eq("id", q.id);
        stats.closed++;
      }
    } catch (err) {
      console.error("[cron/expire] error on quote", q.id, err);
      stats.errors++;
    }
  }

  console.log("[cron/expire] done:", stats);
  return NextResponse.json({ ok: true, stats });
}
