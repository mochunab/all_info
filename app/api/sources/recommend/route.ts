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

    const response = await fetch(
      `${supabaseUrl}/functions/v1/recommend-sources`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, scope }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
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
