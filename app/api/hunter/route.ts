import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
  }

  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey || apiKey === 'your_hunter_api_key_here') {
    return NextResponse.json({ error: 'Hunter API key not configured in .env.local' }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`Hunter API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const emails = data.data?.emails || [];
    
    // Attempt to extract the best contact name and email
    let bestEmail = "";
    let bestName = "";

    if (emails.length > 0) {
      // Prioritize executive/management roles if available
      const bestContact = emails.find((e: any) => e.position?.toLowerCase().includes('owner') || e.position?.toLowerCase().includes('manager')) || emails[0];
      bestEmail = bestContact.value;
      bestName = `${bestContact.first_name || ''} ${bestContact.last_name || ''}`.trim() || "Operations Manager";
    }

    return NextResponse.json({ 
      email: bestEmail,
      contact_name: bestName
    });

  } catch (error: any) {
    console.error('Hunter API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch email data' }, { status: 500 });
  }
}