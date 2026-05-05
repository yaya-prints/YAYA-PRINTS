import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const location = searchParams.get('location');

  if (!query || !location) {
    return NextResponse.json({ error: 'Missing query or location' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey || apiKey === 'your_google_api_key_here') {
    return NextResponse.json({ error: 'Google API key not configured in .env.local' }, { status: 500 });
  }

  try {
    const combinedQuery = `${query} in ${location}`;
    
    // Using Google's New Places API (Text Search V2)
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri'
      },
      body: JSON.stringify({
        textQuery: combinedQuery,
        languageCode: 'en'
      })
    });

    if (!response.ok) {
      throw new Error(`Google API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Format the raw Google data to match your CRM structure
    const formattedLeads = (data.places || []).map((place: any) => {
      let domain = "";
      if (place.websiteUri) {
        try {
          const urlObj = new URL(place.websiteUri);
          domain = urlObj.hostname.replace('www.', '');
        } catch (e) {}
      }

      return {
        id: place.id,
        company_name: place.displayName?.text || "Unknown Company",
        formatted_address: place.formattedAddress || "No Address Provided",
        phone: place.nationalPhoneNumber || "",
        website: place.websiteUri || "",
        domain: domain,
        email: "", 
        contact_name: "" 
      };
    });

    return NextResponse.json({ leads: formattedLeads });

  } catch (error: any) {
    console.error('Google Places API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch places data' }, { status: 500 });
  }
}