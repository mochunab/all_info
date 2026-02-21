import { NextRequest, NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/auth';

// POST /api/sources/recommend - AI 콘텐츠 소스 추천
export async function POST(request: NextRequest) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { category, scope } = body;

    if (!category || !scope) {
      return NextResponse.json(
        { error: 'Missing category or scope' },
        { status: 400 }
      );
    }

    const validScopes = ['domestic', 'international', 'both'];
    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { error: `Invalid scope: ${scope}` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(
        `${supabaseUrl}/functions/v1/recommend-sources`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category, scope }),
          signal: controller.signal,
        }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      const msg = fetchError instanceof Error ? fetchError.message : 'Edge Function fetch failed';
      console.error('[POST /api/sources/recommend] Fetch error:', msg);
      return NextResponse.json(
        { error: msg.includes('abort') ? 'Request timeout (30s)' : msg },
        { status: 504 }
      );
    }
    clearTimeout(timeout);

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[POST /api/sources/recommend] Invalid JSON from Edge Function:', text.slice(0, 200));
      return NextResponse.json(
        { error: `Edge Function returned invalid response (HTTP ${response.status})` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[POST /api/sources/recommend] Edge Function error:', response.status, data);
      return NextResponse.json(
        { error: data.error || `Edge Function error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[POST /api/sources/recommend] Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
