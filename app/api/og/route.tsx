import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || '아카인포';
  const description = searchParams.get('description') || 'AI 비즈니스 인사이트 큐레이션';
  const type = searchParams.get('type') || 'default';

  const typeLabel = type === 'blog' ? 'BLOG' : type === 'author' ? 'AUTHOR' : type === 'article' ? 'ARTICLE' : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: '#FAFAFA',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Organic blur shapes */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(37, 99, 235, 0.08)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '-40px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.06)',
            filter: 'blur(60px)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
          {typeLabel && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '3px',
                  color: '#2563EB',
                  background: '#DBEAFE',
                  padding: '6px 16px',
                  borderRadius: '100px',
                }}
              >
                {typeLabel}
              </span>
            </div>
          )}
          <div
            style={{
              fontSize: title.length > 30 ? '44px' : '56px',
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.25,
              maxWidth: '900px',
              display: 'flex',
            }}
          >
            {title.length > 80 ? title.substring(0, 80) + '...' : title}
          </div>
          {description && (
            <div
              style={{
                fontSize: '24px',
                color: '#4B5563',
                lineHeight: 1.5,
                maxWidth: '800px',
                display: 'flex',
              }}
            >
              {description.length > 120 ? description.substring(0, 120) + '...' : description}
            </div>
          )}
        </div>

        {/* Bottom bar: logo + domain */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* /Ai logo mark */}
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path d="M3.5 27L11 5" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" />
              <path d="M16.5 27L16.5 17" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" />
              <path d="M26 27L26 14" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" />
              <circle cx="26" cy="5.5" r="3.8" fill="#2563EB" />
            </svg>
            <span style={{ color: '#111827', fontSize: '24px', fontWeight: 700 }}>아카인포</span>
          </div>
          <span style={{ color: '#9CA3AF', fontSize: '18px', fontWeight: 500 }}>aca-info.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
