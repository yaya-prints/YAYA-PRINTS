import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseVoiceCommand } from '@/lib/voiceParser'; // ADDITIVE

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
    try {
        const { text } = await request.json();

        // ADDITIVE: Use the FREE local parser instead of an AI API
        const aiParsedData = parseVoiceCommand(text);

        if (aiParsedData.intent === "order") {
            const { error } = await supabase
                .from('orders') 
                .insert([aiParsedData.payload]);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('todos')
                .insert([{ task: text, status: 'pending' }]);
            if (error) throw error;
        }

        return NextResponse.json({ success: true, actionType: aiParsedData.intent });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}