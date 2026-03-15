import { NextRequest, NextResponse } from 'next/server';

const ORIENTATION_MAP: Record<string, string> = {
  landscape: 'landscape',
  portrait: 'portrait',
  squarish: 'square',
};

async function fetchFromPexels(query: string, page: string, orientation: string) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    query,
    page,
    per_page: '1',
    orientation: ORIENTATION_MAP[orientation] || 'square',
  });

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    console.error('[pexels] Error:', res.status);
    return null;
  }

  const data = await res.json();
  const photo = data.photos?.[0];
  if (!photo) return null;

  return {
    id: `pexels-${photo.id}`,
    url: photo.src.large2x,
    thumb: photo.src.small,
    photographer: photo.photographer,
    photographer_url: photo.photographer_url,
    unsplash_url: photo.url,
    color: photo.avg_color,
    source: 'pexels' as const,
  };
}

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('query');
    const page = req.nextUrl.searchParams.get('page') || '1';
    const orientation = req.nextUrl.searchParams.get('orientation') || 'squarish';

    if (!query) {
      return NextResponse.json({ error: 'query 필수' }, { status: 400 });
    }

    // 1차: Unsplash
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (accessKey) {
      const params = new URLSearchParams({
        query,
        page,
        per_page: '1',
        orientation,
      });

      const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });

      if (res.ok) {
        const data = await res.json();
        const photo = data.results?.[0];

        if (photo) {
          fetch(`https://api.unsplash.com/photos/${photo.id}/download`, {
            headers: { Authorization: `Client-ID ${accessKey}` },
          }).catch(() => {});

          return NextResponse.json({
            id: photo.id,
            url: photo.urls.regular,
            thumb: photo.urls.thumb,
            photographer: photo.user.name,
            photographer_url: photo.user.links.html,
            unsplash_url: photo.links.html,
            color: photo.color,
            source: 'unsplash',
          });
        }
      } else {
        console.error('[unsplash] Error:', res.status, '→ Pexels fallback');
      }
    }

    // 2차: Pexels fallback
    const pexelsResult = await fetchFromPexels(query, page, orientation);
    if (pexelsResult) {
      return NextResponse.json(pexelsResult);
    }

    return NextResponse.json({ error: '검색 결과 없음', query }, { status: 404 });
  } catch (err) {
    console.error('[unsplash] Error:', err);

    // 에러 시에도 Pexels 시도
    try {
      const query = req.nextUrl.searchParams.get('query') || '';
      const page = req.nextUrl.searchParams.get('page') || '1';
      const orientation = req.nextUrl.searchParams.get('orientation') || 'squarish';
      const pexelsResult = await fetchFromPexels(query, page, orientation);
      if (pexelsResult) return NextResponse.json(pexelsResult);
    } catch { /* ignore */ }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `이미지 검색 실패: ${message}` }, { status: 500 });
  }
}
