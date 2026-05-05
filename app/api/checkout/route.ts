// File: app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16",
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, amountDue, clientName, poRef } = body;

    // Create the secure Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad", // Using Canadian Dollars
            product_data: {
              name: `Invoice Payment: PO-${poRef}`,
              description: `Payment from ${clientName} for YAYA Prints order.`,
            },
            // Stripe calculates amounts in cents, so we multiply by 100
            unit_amount: Math.round(amountDue * 100), 
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // If successful, send them back to the portal with a success tag in the URL
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/portal?success=true&quote_id=${quoteId}`,
      // If they cancel, send them back to the portal normally
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/portal`,
    });

    // Return the secure Stripe URL to the frontend
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}