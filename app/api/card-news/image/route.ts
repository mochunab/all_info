import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { image_prompt, width, height, aspect_ratio, reference_image } = await req.json();

    if (!image_prompt) {
      return NextResponse.json({ error: 'image_prompt 필수' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다' }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-card-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ image_prompt, width, height, aspect_ratio, ...(reference_image && { reference_image }) }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `이미지 생성 오류: ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[card-news/image] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `이미지 생성 실패: ${message}` }, { status: 500 });
  }
}
