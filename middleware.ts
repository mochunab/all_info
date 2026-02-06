import { NextRequest, NextResponse } from 'next/server';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  // Add production domain(s) here:
  // 'https://insight-hub.vercel.app',
];

// Simple in-memory rate limit for /api/crawl/trigger (30s cooldown)
let lastTriggerTime = 0;
const TRIGGER_COOLDOWN_MS = 30_000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  // --- Rate limit: /api/crawl/trigger ---
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

  // --- CORS handling ---
  // Handle preflight OPTIONS requests
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

  // --- Apply response headers ---
  const response = NextResponse.next();

  // CORS headers for allowed origins only
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  // Security headers (defense-in-depth with next.config.mjs)
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
    // Match all API routes and pages, excluding static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
