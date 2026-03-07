import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || '아카인포';
  const description = searchParams.get('description') || '나만의 면접 치트키';
  const type = searchParams.get('type') || 'default';

  const accentColor = type === 'blog' ? '#7C3AED' : type === 'author' ? '#0891B2' : '#4F46E5';
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
          padding: '60px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {typeLabel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: accentColor,
                }}
              />
              <span style={{ color: accentColor, fontSize: '20px', fontWeight: 600, letterSpacing: '2px' }}>
                {typeLabel}
              </span>
            </div>
          )}
          <div
            style={{
              fontSize: title.length > 30 ? '42px' : '52px',
              fontWeight: 700,
              color: '#f8fafc',
              lineHeight: 1.3,
              maxWidth: '900px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                fontSize: '24px',
                color: '#94a3b8',
                lineHeight: 1.5,
                maxWidth: '800px',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '20px',
                fontWeight: 700,
              }}
            >
              A
            </div>
            <span style={{ color: '#e2e8f0', fontSize: '22px', fontWeight: 600 }}>아카인포</span>
          </div>
          <span style={{ color: '#64748b', fontSize: '18px' }}>aca-info.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
