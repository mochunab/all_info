import { NextRequest, NextResponse } from 'next/server';

// Whitelisted domains for image proxying
const ALLOWED_DOMAINS = [
  'blogthumb.pstatic.net',
  'blogfiles.pstatic.net',
  'postfiles.pstatic.net',
  'mblogthumb-phinf.pstatic.net',
  'img.stibee.com',
  'img1.daumcdn.net',
  't1.daumcdn.net',
  'brunch-phinf.pstatic.net',
];

// Max image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Fetch timeout: 10 seconds
const FETCH_TIMEOUT_MS = 10_000;

function isAllowedDomain(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function isPrivateIP(hostname: string): boolean {
  // Block private/internal IPs to prevent SSRF
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^::1$/,
    /^fc00:/i,
    /^fd00:/i,
    /^fe80:/i,
    /^localhost$/i,
  ];

  return privatePatterns.some((pattern) => pattern.test(hostname));
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    );
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    const parsed = new URL(decodedUrl);

    // Protocol check: HTTPS only
    if (parsed.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Only HTTPS URLs are allowed' },
        { status: 403 }
      );
    }

    // Block private/internal IPs
    if (isPrivateIP(parsed.hostname)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Domain whitelist check
    if (!isAllowedDomain(parsed.hostname)) {
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }

    // Determine referer based on domain
    let referer = 'https://blog.naver.com/';
    if (parsed.hostname.includes('daumcdn.net')) {
      referer = 'https://brunch.co.kr/';
    }

    // Fetch with timeout and redirect blocking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: referer,
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'error', // Block redirects to prevent SSRF bypass
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    // Content-Type validation: images only
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Response is not an image' },
        { status: 403 }
      );
    }

    // Size check via Content-Length header
    const contentLength = parseInt(
      response.headers.get('content-length') || '0',
      10
    );
    if (contentLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large' },
        { status: 413 }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    // Double-check actual size
    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large' },
        { status: 413 }
      );
    }

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': imageBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    if (error instanceof TypeError && String(error).includes('redirect')) {
      return NextResponse.json(
        { error: 'Redirects are not allowed' },
        { status: 403 }
      );
    }
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
