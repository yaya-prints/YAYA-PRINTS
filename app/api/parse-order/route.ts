// app/api/parse-order/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // We use OpenAI's API to extract the data. 
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // The fastest, cheapest model
        messages: [
          {
            role: 'system',
            content: `You are an expert order entry assistant for a custom apparel print shop. 
            Extract order details from the user's text into a strictly formatted JSON array of objects.
            
            CRITICAL RULES:
            1. "description": Try to map to standard catalog names. If they say "T-shirt", "Tee", or "Shirt", output "Custom T-Shirt". If "Sweater" or "Crewneck", output "Custom Sweater". If "Hoodie", output "Custom Hoodie".
            2. "color": Extract the color and capitalize it (e.g., "Black", "Navy", "Sport Grey"). If no color is mentioned, default to "Black".
            3. "sizes": This object MUST ONLY contain INTEGERS. Never strings. 
               - Keys allowed: "xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl".
               - Example: If text says "3 x Small", set "s": 3. 
               - If text gives a total quantity but no specific size (e.g., "Need 3 Black T-Shirts"), default the entire quantity to Large ("l": 3).
               - If a size is not requested, omit it or set it to 0.

            OUTPUT FORMAT:
            {
              "items": [
                {
                  "description": "Custom T-Shirt",
                  "color": "Black",
                  "sizes": { "s": 3 }
                }
              ]
            }
            Do NOT return any markdown, text, or explanations. Only the raw JSON object.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: { type: "json_object" } // Forces perfect JSON output
      })
    });

    // --- NEW: CATCH EXACT OPENAI ERRORS ---
    if (!response.ok) {
        const errorBody = await response.json();
        console.error("OPENAI REJECTED:", errorBody);
        return NextResponse.json({ error: errorBody.error?.message || "OpenAI API Error" }, { status: response.status });
    }

    const aiData = await response.json();
    const parsedOrder = JSON.parse(aiData.choices[0].message.content);
    
    // The AI might return it wrapped in an object depending on how it formats, 
    // so we safely extract the array.
    const itemsArray = Array.isArray(parsedOrder) ? parsedOrder : parsedOrder[Object.keys(parsedOrder)[0]];

    return NextResponse.json({ items: itemsArray });

  } catch (error) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: "Failed to parse order" }, { status: 500 });
  }
}