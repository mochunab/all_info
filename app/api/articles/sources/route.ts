import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get distinct source names from articles
    const { data: articles, error } = await supabase
      .from('articles')
      .select('source_name')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching sources:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      );
    }

    // Extract unique source names
    const sourceNames = articles?.map((a: { source_name: string }) => a.source_name) || [];
    const sources = Array.from(new Set(sourceNames)).sort();

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Sources API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
