import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';

// Default categories if the table doesn't exist or is empty
const DEFAULT_CATEGORIES = ['비즈니스', '소비 트렌드'];

// GET /api/categories - Get all categories
export async function GET() {
  try {
    const supabase = await createClient();

    // Try to fetch from categories table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('categories')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      // Table might not exist, return default categories
      console.log('Categories table not found, using defaults');
      return NextResponse.json({
        categories: DEFAULT_CATEGORIES.map((name, index) => ({
          id: index + 1,
          name,
          is_default: true,
        })),
      });
    }

    // If no categories, return defaults
    if (!data || data.length === 0) {
      return NextResponse.json({
        categories: DEFAULT_CATEGORIES.map((name, index) => ({
          id: index + 1,
          name,
          is_default: true,
        })),
      });
    }

    return NextResponse.json({ categories: data });
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    // Return default categories on error
    return NextResponse.json({
      categories: DEFAULT_CATEGORIES.map((name, index) => ({
        id: index + 1,
        name,
        is_default: true,
      })),
    });
  }
}

// POST /api/categories - Add a new category (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require same-origin (browser) or cron auth (server)
    if (!verifySameOrigin(request) && !verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Category name cannot be empty' },
        { status: 400 }
      );
    }

    // Check if category already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('categories')
      .select('id')
      .eq('name', trimmedName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 409 }
      );
    }

    // Insert new category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('categories')
      .insert({
        name: trimmedName,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
