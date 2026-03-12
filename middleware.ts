import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/locale-config';
import type { Locale } from '@/lib/locale-config';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
];

let lastTriggerTime = 0;
const TRIGGER_COOLDOWN_MS = 30_000;

const LOCALE_SET = new Set<string>(LOCALES);

const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  KR: 'ko',
  CN: 'zh',
  JP: 'ja',
  VN: 'vi',
};

function detectLocaleFromHeader(request: NextRequest): Locale {
  const country = request.headers.get('x-vercel-ip-country');
  if (country && COUNTRY_TO_LOCALE[country]) {
    return COUNTRY_TO_LOCALE[country];
  }

  const accept = request.headers.get('accept-language') || '';
  const preferred = accept.split(',').map((s) => s.split(';')[0].trim().toLowerCase());
  for (const lang of preferred) {
    const short = lang.substring(0, 2);
    if (LOCALE_SET.has(short)) return short as Locale;
  }
  return 'en';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  // Rate limit for crawl trigger
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

  // CORS preflight
  if (request.method === 'OPTIONS') {
    const preflightHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (isAllowedOrigin) {
      preflightHeaders['Access-Control-Allow-Origin'] = origin;
    }
    return new NextResponse(null, { status: 204, headers: preflightHeaders });
  }

  // --- i18n routing ---
  const firstSegment = pathname.split('/')[1];

  // Legacy ?lang= redirect (301)
  const langParam = request.nextUrl.searchParams.get('lang');
  if (langParam && LOCALE_SET.has(langParam) && !LOCALE_SET.has(firstSegment)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('lang');
    url.pathname = `/${langParam}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 301);
  }

  // No locale prefix → detect and redirect (302)
  const hasVisited = request.cookies.has('ih_visited');
  if (!LOCALE_SET.has(firstSegment)) {
    const detected = detectLocaleFromHeader(request);
    const url = request.nextUrl.clone();
    const target = (pathname === '/' && !hasVisited) ? '/landing' : pathname;
    url.pathname = `/${detected}${target}`;
    const res = NextResponse.redirect(url, 302);
    if (!hasVisited) res.cookies.set('ih_visited', '1', { maxAge: 60 * 60 * 24 * 365, path: '/' });
    return res;
  }

  // /{locale} root → /{locale}/landing redirect (first visit only)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && LOCALE_SET.has(segments[0]) && !hasVisited) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segments[0]}/landing`;
    const res = NextResponse.redirect(url, 302);
    res.cookies.set('ih_visited', '1', { maxAge: 60 * 60 * 24 * 365, path: '/' });
    return res;
  }

  // Valid locale prefix → continue (set visited cookie on landing page)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });
  if (!hasVisited && pathname.endsWith('/landing')) {
    response.cookies.set('ih_visited', '1', { maxAge: 60 * 60 * 24 * 365, path: '/' });
  }

  // Supabase auth — session refresh only (no blocking getUser() call)
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

  await supabase.auth.getSession();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('x-locale', firstSegment);
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
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|feed\\.xml|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
