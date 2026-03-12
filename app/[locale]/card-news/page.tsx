'use client';

import { useState, useCallback } from 'react';
import { Header, Footer } from '@/components';
import { useLanguage } from '@/lib/language-context';

const ASPECT_RATIOS = [
  { id: 'ig-square', label: '인스타 피드', ratio: '1:1', width: 1080, height: 1080, platform: 'Instagram' },
  { id: 'ig-portrait', label: '인스타 피드 (세로)', ratio: '4:5', width: 1080, height: 1350, platform: 'Instagram' },
  { id: 'ig-story', label: '스토리 / 릴스', ratio: '9:16', width: 1080, height: 1920, platform: 'Instagram' },
  { id: 'x-feed', label: 'X (Twitter)', ratio: '16:9', width: 1200, height: 675, platform: 'X' },
  { id: 'yt-thumb', label: 'YouTube 썸네일', ratio: '16:9', width: 1280, height: 720, platform: 'YouTube' },
  { id: 'naver-blog', label: '네이버 블로그', ratio: '3:4', width: 900, height: 1200, platform: 'Naver' },
  { id: 'linkedin', label: 'LinkedIn', ratio: '1:1', width: 1080, height: 1080, platform: 'LinkedIn' },
] as const;

const SLIDE_COUNTS = [5, 7, 10] as const;

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: '#E4405F',
  X: '#000000',
  YouTube: '#FF0000',
  Naver: '#03C75A',
  LinkedIn: '#0A66C2',
};

type Slide = {
  slide_number: number;
  type: 'cover' | 'content' | 'cta';
  headline: string;
  subtext?: string;
  body?: string;
  image_prompt: string;
  color_scheme: string;
};

type SlideResult = {
  title: string;
  slides: Slide[];
};

export default function CardNewsPage() {
  const [topic, setTopic] = useState('');
  const [selectedRatio, setSelectedRatio] = useState<string>('ig-square');
  const [slideCount, setSlideCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SlideResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  const [imageGenerating, setImageGenerating] = useState<number | null>(null);
  const [imageProgress, setImageProgress] = useState(0);
  const { language, setLanguage } = useLanguage();

  const selected = ASPECT_RATIOS.find(r => r.id === selectedRatio)!;

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setImages({});
    setImageProgress(0);

    try {
      const res = await fetch('/api/card-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          slideCount,
          ratio: { id: selected.id, label: selected.label, width: selected.width, height: selected.height },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImages = useCallback(async () => {
    if (!result) return;
    setError(null);

    for (let i = 0; i < result.slides.length; i++) {
      const slide = result.slides[i];
      setImageGenerating(slide.slide_number);
      setImageProgress(i);

      try {
        const res = await fetch('/api/card-news/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_prompt: slide.image_prompt,
            width: selected.width,
            height: selected.height,
            aspect_ratio: selected.ratio,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '이미지 생성 실패');

        setImages(prev => ({
          ...prev,
          [slide.slide_number]: `data:${data.mimeType};base64,${data.image}`,
        }));
      } catch (err) {
        console.error(`Slide ${slide.slide_number} image error:`, err);
        setError(`${slide.slide_number}장 이미지 실패: ${err instanceof Error ? err.message : '오류'}`);
      }

      if (i < result.slides.length - 1) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    setImageGenerating(null);
    setImageProgress(result.slides.length);
  }, [result, selected]);

  const allImagesReady = result ? Object.keys(images).length === result.slides.length : false;

  const handleDownloadAll = useCallback(() => {
    if (!result) return;
    result.slides.forEach(slide => {
      const src = images[slide.slide_number];
      if (!src) return;
      const a = document.createElement('a');
      a.href = src;
      a.download = `card-${slide.slide_number}.png`;
      a.click();
    });
  }, [result, images]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <Header language={language} onLanguageChange={setLanguage} />

      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '40px 20px', width: '100%' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            AI 카드뉴스 메이커
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
            주제만 입력하면 AI가 카드뉴스를 자동으로 만들어드려요
          </p>
        </div>

        {/* Topic Input */}
        <section style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            주제
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="예: 2026년 직장인 부업 트렌드 TOP 5"
            rows={3}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </section>

        {/* Aspect Ratio */}
        <section style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            화면 비율
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {ASPECT_RATIOS.map(r => {
              const isSelected = selectedRatio === r.id;
              const pc = PLATFORM_COLORS[r.platform];
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRatio(r.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '16px 12px',
                    border: isSelected ? `2px solid ${pc}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? `${pc}08` : 'var(--bg-secondary)',
                    cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{
                    width: r.width > r.height ? 48 : 48 * (r.width / r.height),
                    height: r.height > r.width ? 48 : 48 * (r.height / r.width),
                    border: `2px solid ${isSelected ? pc : 'var(--border-hover)'}`,
                    borderRadius: 4, background: isSelected ? `${pc}15` : 'var(--bg-tertiary)',
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? pc : 'var(--text-primary)' }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {r.ratio} · {r.width}×{r.height}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Slide Count */}
        <section style={{ marginBottom: 40 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            슬라이드 수
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {SLIDE_COUNTS.map(count => {
              const isSelected = slideCount === count;
              return (
                <button
                  key={count}
                  onClick={() => setSlideCount(count)}
                  style={{
                    flex: 1, padding: '12px 0', fontSize: 15,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                    background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}
                >
                  {count}장
                </button>
              );
            })}
          </div>
        </section>

        {/* Summary Bar */}
        <div style={{
          padding: '16px 20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
          marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 14, color: 'var(--text-secondary)',
        }}>
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>{selected.label}</strong>
            {' '}· {selected.ratio} · {selected.width}×{selected.height} · {slideCount}장
          </span>
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 20,
            background: `${PLATFORM_COLORS[selected.platform]}15`,
            color: PLATFORM_COLORS[selected.platform], fontWeight: 600,
          }}>
            {selected.platform}
          </span>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || isGenerating}
          style={{
            width: '100%', padding: '16px 0', fontSize: 16, fontWeight: 700, color: 'white',
            background: !topic.trim() || isGenerating ? 'var(--text-tertiary)' : 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: !topic.trim() || isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? '기획 생성 중...' : `카드뉴스 ${slideCount}장 생성하기`}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, padding: '14px 18px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)',
            color: '#DC2626', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <section style={{ marginTop: 40 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {result.title}
              </h2>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                {result.slides.length}장 · 기획 완료
              </span>
            </div>

            {/* Slide Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${selected.width >= selected.height ? 220 : 160}px, 1fr))`,
              gap: 16,
            }}>
              {result.slides.map(slide => {
                const imgSrc = images[slide.slide_number];
                const isThisGenerating = imageGenerating === slide.slide_number;
                return (
                  <div
                    key={slide.slide_number}
                    style={{
                      width: '100%',
                      aspectRatio: `${selected.width} / ${selected.height}`,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      position: 'relative',
                      background: imgSrc ? undefined : `linear-gradient(135deg, ${slide.color_scheme}CC, ${slide.color_scheme}40)`,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Background Image */}
                    {imgSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc}
                        alt={`slide ${slide.slide_number}`}
                        style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%', objectFit: 'cover',
                        }}
                      />
                    )}

                    {/* Loading Spinner */}
                    {isThisGenerating && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                      }}>
                        <div style={{
                          width: 32, height: 32, border: '3px solid rgba(255,255,255,0.3)',
                          borderTop: '3px solid white', borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }} />
                      </div>
                    )}

                    {/* Slide Number */}
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.5)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, zIndex: 1,
                    }}>
                      {slide.slide_number}
                    </div>

                    {/* Type Badge */}
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '3px 8px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.4)', color: 'white',
                      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', zIndex: 1,
                    }}>
                      {slide.type}
                    </div>

                    {/* Text Overlay */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '24px 16px 16px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                      color: 'white', zIndex: 1,
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
                        {slide.headline}
                      </div>
                      {(slide.subtext || slide.body) && (
                        <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>
                          {slide.subtext || slide.body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Image Generation Controls */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              {!allImagesReady ? (
                <button
                  onClick={generateImages}
                  disabled={imageGenerating !== null}
                  style={{
                    flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 700, color: 'white',
                    background: imageGenerating !== null ? 'var(--text-tertiary)' : '#10B981',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: imageGenerating !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {imageGenerating !== null
                    ? `이미지 생성 중... (${imageProgress + 1}/${result.slides.length})`
                    : Object.keys(images).length > 0
                      ? `나머지 이미지 생성 (${Object.keys(images).length}/${result.slides.length})`
                      : '배경 이미지 생성하기'
                  }
                </button>
              ) : (
                <button
                  onClick={handleDownloadAll}
                  style={{
                    flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 700, color: 'white',
                    background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  전체 다운로드 ({result.slides.length}장)
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {imageGenerating !== null && (
              <div style={{
                marginTop: 12, height: 4, background: 'var(--bg-tertiary)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', background: '#10B981',
                  width: `${((imageProgress + 1) / result.slides.length) * 100}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            )}
          </section>
        )}
      </main>

      <Footer language={language} />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
