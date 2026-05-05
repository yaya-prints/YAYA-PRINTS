// emails/templates.ts
// All email templates used by the quote-revival system.
// Plain HTML strings — keeps things simple, no JSX-email dependency.
//
// Templates:
//   1. dayBeforeExpiry  — sent on day 13 ("expires tomorrow")
//   2. expiredWithRevive — sent on day 15 ("expired, revive here")
//   3. lastChanceRevive — sent on day 18 ("final reminder")
//   4. ownerExpiredNotice — sent to owner when quote hits expiry
//   5. ownerRevivalRequest — sent to owner when customer asks to revive
//   6. customerRevivalApproved — sent to customer when owner approves revival

const BRAND = {
  primary: "#0EA5E9",
  dark: "#0F172A",
  muted: "#64748B",
  light: "#F8FAFC",
  emerald: "#10B981",
  rose: "#F43F5E",
};

function shell(content: string, ctaText?: string, ctaUrl?: string) {
  const cta = ctaText && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${BRAND.primary};border-radius:8px;"><a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-family:Arial,sans-serif;font-weight:900;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;">${ctaText}</a></td></tr></table>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${BRAND.light};font-family:Arial,Helvetica,sans-serif;color:${BRAND.dark};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.light};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:${BRAND.dark};padding:24px 32px;">
          <div style="font-family:Arial,sans-serif;font-weight:900;font-style:italic;font-size:28px;color:#fff;letter-spacing:-0.5px;">YAYA SPORTS</div>
          <div style="font-family:Arial,sans-serif;font-weight:700;font-size:10px;color:${BRAND.primary};letter-spacing:3px;margin-top:4px;">CUSTOM PRODUCTION HOUSE</div>
        </td></tr>
        <tr><td style="padding:36px 32px 32px 32px;">
          ${content}
          ${cta}
        </td></tr>
        <tr><td style="background:${BRAND.light};padding:20px 32px;border-top:1px solid #e2e8f0;">
          <div style="font-family:Arial,sans-serif;font-size:11px;color:${BRAND.muted};line-height:1.6;">
            YAYA Sports — Custom apparel & print<br/>
            <a href="mailto:info@yayasports.ca" style="color:${BRAND.primary};text-decoration:none;">info@yayasports.ca</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Strip HTML tags for the plaintext fallback. Crude but fine.
function toText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "")
             .replace(/<[^>]+>/g, " ")
             .replace(/\s+/g, " ")
             .trim();
}

type QuoteCtx = {
  customerName: string;
  customerCompany: string;
  quoteId: string;
  quoteRef: string;
  total: string;
  expiryDateStr: string;
  quoteUrl: string;
  reviveUrl: string;
};

// ───────────────────────────────────────────────────────────────────────────
// 1. DAY 13 — "expires tomorrow"
export function dayBeforeExpiryEmail(c: QuoteCtx) {
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;letter-spacing:-0.5px;">
      Hi ${c.customerName.split(" ")[0] || "there"} — your quote expires tomorrow.
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Quick heads up — your quote <strong style="color:${BRAND.dark};">${c.quoteRef}</strong> for <strong style="color:${BRAND.dark};">${c.customerCompany}</strong> is set to expire on <strong style="color:${BRAND.dark};">${c.expiryDateStr}</strong>.
    </p>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Total locked in: <strong style="color:${BRAND.dark};">${c.total}</strong>
    </p>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 8px 0;">
      Approve now to lock in pricing — once it expires, materials and labor costs may have changed.
    </p>
  `, "Approve Quote", c.quoteUrl);
  return { subject: `Your YAYA Sports quote ${c.quoteRef} expires tomorrow`, html, text: toText(html) };
}

// 2. DAY 15 — "expired, revive here"
export function expiredWithReviveEmail(c: QuoteCtx) {
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;letter-spacing:-0.5px;">
      Your quote has expired — but it's not too late.
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Hi ${c.customerName.split(" ")[0] || "there"}, your quote <strong style="color:${BRAND.dark};">${c.quoteRef}</strong> for <strong style="color:${BRAND.dark};">${c.customerCompany}</strong> expired on ${c.expiryDateStr}.
    </p>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      No worries — we can revive it. Click below and we'll review the pricing and get you a fresh quote within one business day.
    </p>
  `, "Revive This Quote", c.reviveUrl);
  return { subject: `Quote ${c.quoteRef} expired — easy revival, one click`, html, text: toText(html) };
}

// 3. DAY 18 — "last chance"
export function lastChanceReviveEmail(c: QuoteCtx) {
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;letter-spacing:-0.5px;">
      Last chance to bring this back.
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Hi ${c.customerName.split(" ")[0] || "there"} — this is the last note we'll send about quote <strong style="color:${BRAND.dark};">${c.quoteRef}</strong>.
    </p>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      If your project is still on the table, just hit the button below and we'll get you fresh pricing this week. Otherwise we'll close the file and you'll stop hearing from us.
    </p>
  `, "Revive Quote", c.reviveUrl);
  return { subject: `Final reminder: Quote ${c.quoteRef}`, html, text: toText(html) };
}

// 4. OWNER — "quote expired" alert
export function ownerExpiredNoticeEmail(c: QuoteCtx) {
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;">
      Quote expired: ${c.quoteRef}
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${BRAND.light};border-radius:12px;padding:16px;margin:0 0 16px 0;">
      <tr><td style="font-family:Arial,sans-serif;font-size:13px;color:${BRAND.muted};line-height:1.8;">
        <strong style="color:${BRAND.dark};">Customer:</strong> ${c.customerCompany}<br/>
        <strong style="color:${BRAND.dark};">Contact:</strong> ${c.customerName}<br/>
        <strong style="color:${BRAND.dark};">Total:</strong> ${c.total}<br/>
        <strong style="color:${BRAND.dark};">Expired on:</strong> ${c.expiryDateStr}
      </td></tr>
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      A revival email was sent to the customer. If they request revival, you'll get a separate email with an approve link.
    </p>
  `, "View Quote", c.quoteUrl);
  return { subject: `[YAYA] Quote expired: ${c.quoteRef} (${c.customerCompany})`, html, text: toText(html) };
}

// 5. OWNER — "customer wants to revive"
export function ownerRevivalRequestEmail(c: QuoteCtx & { note?: string; approveUrl: string }) {
  const noteBlock = c.note
    ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:${BRAND.dark};line-height:1.6;margin:8px 0 16px 0;background:${BRAND.light};border-left:3px solid ${BRAND.primary};padding:12px 16px;">"${c.note}"</p>`
    : "";
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;">
      Revival request: ${c.quoteRef}
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:${BRAND.muted};line-height:1.6;margin:0 0 8px 0;">
      <strong style="color:${BRAND.dark};">${c.customerName}</strong> at <strong style="color:${BRAND.dark};">${c.customerCompany}</strong> wants to revive their expired quote.
    </p>
    ${noteBlock}
    <p style="font-family:Arial,sans-serif;font-size:14px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Original total: <strong style="color:${BRAND.dark};">${c.total}</strong> — review pricing before approving.
    </p>
  `, "Approve & Revive", c.approveUrl);
  return { subject: `[YAYA] Revival requested: ${c.quoteRef} (${c.customerCompany})`, html, text: toText(html) };
}

// 6. CUSTOMER — "your revival was approved"
export function customerRevivalApprovedEmail(c: QuoteCtx) {
  const html = shell(`
    <h1 style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:${BRAND.dark};margin:0 0 16px 0;letter-spacing:-0.5px;">
      Quote revived — you're back in.
    </h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      Good news ${c.customerName.split(" ")[0] || ""} — quote <strong style="color:${BRAND.dark};">${c.quoteRef}</strong> for <strong style="color:${BRAND.dark};">${c.customerCompany}</strong> has been revived.
    </p>
    <p style="font-family:Arial,sans-serif;font-size:15px;color:${BRAND.muted};line-height:1.6;margin:0 0 16px 0;">
      It's valid for another 14 days. Click below to view, sign, and lock in your order.
    </p>
  `, "View & Approve", c.quoteUrl);
  return { subject: `Your quote ${c.quoteRef} has been revived`, html, text: toText(html) };
}
