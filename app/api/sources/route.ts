import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { inferCrawlerType } from '@/lib/crawlers/strategies';

// GET /api/sources - Get all crawl sources
export async function GET() {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('crawl_sources')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching sources:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sources: data || [] });
  } catch (error) {
    console.error('Error in GET /api/sources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sources - Add new crawl sources
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { sources } = body;

    if (!sources || !Array.isArray(sources)) {
      return NextResponse.json(
        { error: 'Invalid sources data' },
        { status: 400 }
      );
    }

    const results = [];

    for (const source of sources) {
      const { url, name, category } = source;

      if (!url) continue;

      // Check if source already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('crawl_sources')
        .select('id')
        .eq('base_url', url)
        .single();

      if (existing) {
        // Update existing source
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .update({
            name: name || extractDomainName(url),
            config: { category },
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }
      } else {
        // Insert new source with auto-detected crawler type
        const detectedType = inferCrawlerType(url);
        console.log(`[SOURCES] New source: ${url} -> crawler_type: ${detectedType}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: name || extractDomainName(url),
            base_url: url,
            crawler_type: detectedType,
            config: { category },
            is_active: true,
            priority: 1,
          })
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sources: results,
    });
  } catch (error) {
    console.error('Error in POST /api/sources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return url;
  }
}
