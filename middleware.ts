import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
];

let lastTriggerTime = 0;
const TRIGGER_COOLDOWN_MS = 30_000;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  if (pathname === '/api/crawl/trigger' && request.method === 'POST') {
    const now = Date.now();
    if (now - lastTriggerTime < TRIGGER_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before retrying.' },
        { status: 429 }
      );
    }
    lastTriggerTime = now;
  }

  if (request.method === 'OPTIONS') {
    const preflightHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (isAllowedOrigin) {
      preflightHeaders['Access-Control-Allow-Origin'] = origin;
    }

    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
