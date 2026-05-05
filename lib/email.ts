// lib/email.ts
// Centralized Resend client + helpers. All transactional emails go through here.
//
// Setup:
//   1. Make sure RESEND_API_KEY is in .env.local
//   2. Verify your sending domain (yayasports.ca) in Resend dashboard
//   3. Use sendEmail() from anywhere on the server side

import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY environment variable");
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_DEFAULT = "YAYA Sports <info@yayasports.ca>";
const REPLY_TO = "info@yayasports.ca";

export const OWNER_NOTIFICATION_EMAIL = "info@yayasports.ca";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export async function sendEmail(params: SendEmailParams) {
  const { to, subject, html, text, from = FROM_DEFAULT, replyTo = REPLY_TO } = params;
  if (!to) {
    console.warn("[sendEmail] no recipient — skipping");
    return { skipped: true };
  }
  try {
    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
      replyTo,
    });
    if (result.error) {
      console.error("[sendEmail] Resend error:", result.error);
      return { error: result.error };
    }
    return { id: result.data?.id };
  } catch (err: any) {
    console.error("[sendEmail] threw:", err);
    return { error: err };
  }
}
