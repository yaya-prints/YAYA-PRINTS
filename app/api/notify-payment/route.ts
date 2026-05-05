// File: app/api/notify-payment/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Initialize Resend with your API key from .env.local
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientName, amount, poRef } = body;

    const { data, error } = await resend.emails.send({
      from: "YAYA System <onboarding@resend.dev>", // Resend's default testing email
      to: ["info@yayasports.ca"], // Sending TO you
      subject: `💰 Payment Received: ${clientName} (PO-${poRef})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #0ea5e9; margin-bottom: 5px;">Payment Received!</h2>
          <p style="color: #666; font-size: 14px; margin-top: 0;">A customer has just completed a payment via the B2B Portal.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>PO Reference:</strong> PO-${poRef}</p>
          </div>
          
          <p style="font-size: 12px; color: #999;">This is an automated message from your YAYA B2B Portal.</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Email API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}