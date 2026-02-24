import { NextRequest, NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/auth';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messages, articles, category, language, pinnedArticle } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(
        `${supabaseUrl}/functions/v1/chat-insight`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, articles, category, language, pinnedArticle }),
          signal: controller.signal,
        }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      const msg = fetchError instanceof Error ? fetchError.message : 'Edge Function fetch failed';
      return NextResponse.json(
        { success: false, error: msg.includes('abort') ? 'Request timeout (25s)' : msg },
        { status: 504 }
      );
    }
    clearTimeout(timeout);

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: `Edge Function returned invalid response (HTTP ${response.status})` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || `Edge Function error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
