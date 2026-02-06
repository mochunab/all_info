import { NextResponse } from 'next/server';

// Server-side proxy to trigger crawl without exposing CRON_SECRET to client
export async function POST() {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[TRIGGER] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Determine base URL for internal call
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/crawl/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Crawl failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[TRIGGER] Error triggering crawl:', error);
    return NextResponse.json(
      { error: 'Failed to trigger crawl' },
      { status: 500 }
    );
  }
}
