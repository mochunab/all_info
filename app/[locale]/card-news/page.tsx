'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Header, Footer } from '@/components';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/lib/auth-context';
import type { Article, ArticleListResponse } from '@/types';
import { SOURCE_COLORS, DEFAULT_SOURCE_COLOR } from '@/types';

// ── Types ──

type SelectedArticle = {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  source_name: string;
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

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// ── Constants ──

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

// ── Step enum ──

type Step = 'input' | 'plan' | 'production';

// ── Article Picker Modal ──

function ArticlePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelected,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (articles: SelectedArticle[]) => void;
  initialSelected: SelectedArticle[];
  userId?: string;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'home' | 'my'>('home');
  const [selected, setSelected] = useState<Map<string, SelectedArticle>>(
    () => new Map(initialSelected.map(a => [a.id, a]))
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArticles = useCallback(async (pageNum: number, searchQuery: string, feedTab: 'home' | 'my', append = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
      if (searchQuery) params.set('search', searchQuery);
      if (feedTab === 'my' && userId) params.set('user_id', userId);
      const res = await fetch(`/api/articles?${params}`);
      if (!res.ok) return;
      const data: ArticleListResponse = await res.json();
      setArticles(prev => append ? [...prev, ...data.articles] : data.articles);
      setHasMore(data.hasMore);
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchArticles(1, search, tab);
    }
  }, [isOpen, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchArticles(1, value, tab);
    }, 300);
  };

  const toggleSelect = (article: Article) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(article.id)) {
        next.delete(article.id);
      } else {
        next.set(article.id, {
          id: article.id,
          title: article.title_ko || article.title,
          summary: article.summary,
          tags: article.summary_tags || [],
          source_name: article.source_name,
        });
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)', borderRadius: 16,
          width: '100%', maxWidth: 640, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              피드에서 콘텐츠 선택
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {([['home', '홈피드'], ['my', '마이피드']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSearch(''); }}
                disabled={key === 'my' && !userId}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none', cursor: key === 'my' && !userId ? 'not-allowed' : 'pointer',
                  background: tab === key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: tab === key ? 'white' : key === 'my' && !userId ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="콘텐츠 검색..."
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14,
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Article List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px' }}>
          {articles.map(article => {
            const isSelected = selected.has(article.id);
            const sourceColor = SOURCE_COLORS[article.source_name] || DEFAULT_SOURCE_COLOR;
            const summary = article.summary || '';
            const summaryParts = summary.split('\n\n');
            const headline = summaryParts[0] || '';
            const details = summaryParts.slice(1).join(' ').trim();
            return (
              <div
                key={article.id}
                onClick={() => toggleSelect(article)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 0', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                  border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border-hover)',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                      color: 'white', background: sourceColor, whiteSpace: 'nowrap',
                    }}>
                      {article.source_name}
                    </span>
                    {(article.summary_tags || []).slice(0, 2).map((tag, i) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>#{tag}</span>
                    ))}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                    lineHeight: 1.4, marginBottom: details ? 4 : 0,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {headline || article.title_ko || article.title}
                  </div>
                  {details && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {details}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>
              불러오는 중...
            </div>
          )}

          {hasMore && !isLoading && (
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchArticles(next, search, true); }}
              style={{
                display: 'block', width: '100%', padding: '12px 0', margin: '8px 0',
                fontSize: 13, color: 'var(--accent)', background: 'none',
                border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
              }}
            >
              더 보기
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {selected.size}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500,
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={() => { onConfirm(Array.from(selected.values())); onClose(); }}
              disabled={selected.size === 0}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600,
                background: selected.size === 0 ? 'var(--text-tertiary)' : 'var(--accent)',
                color: 'white', border: 'none', borderRadius: 8,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              선택 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function CardNewsPage() {
  const [step, setStep] = useState<Step>('input');
  const [topic, setTopic] = useState('');
  const [sourceArticles, setSourceArticles] = useState<SelectedArticle[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [slideCount, setSlideCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SlideResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Plan revision chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Production step
  const [selectedRatio, setSelectedRatio] = useState<string>('ig-square');
  const [images, setImages] = useState<Record<number, string>>({});
  const [imageGenerating, setImageGenerating] = useState<number | null>(null);
  const [imageProgress, setImageProgress] = useState(0);

  const { language, setLanguage } = useLanguage();
  const { user: authUser } = useAuth();
  const selectedAspect = ASPECT_RATIOS.find(r => r.id === selectedRatio)!;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Step 1: Generate plan ──

  const handleGeneratePlan = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setChatMessages([]);

    try {
      const res = await fetch('/api/card-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          slideCount,
          ratio: { id: 'ig-square', label: '인스타 피드', width: 1080, height: 1080 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setResult(data);
      setStep('plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Step 2: Revise plan via chat ──

  const handleRevise = async () => {
    if (!chatInput.trim() || !result) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsRevising(true);
    setError(null);

    try {
      const currentPlan = JSON.stringify(result, null, 2);
      const res = await fetch('/api/card-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `기존 기획안:\n${currentPlan}\n\n수정 요청: ${userMsg}\n\n위 기획안을 수정 요청에 맞게 수정해줘. 슬라이드 수는 ${result.slides.length}장 유지.`,
          slideCount: result.slides.length,
          ratio: { id: 'ig-square', label: '인스타 피드', width: 1080, height: 1080 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수정 실패');
      setResult(data);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '기획안을 수정했습니다. 확인해주세요!' }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '오류';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `수정 실패: ${errMsg}` }]);
      setError(errMsg);
    } finally {
      setIsRevising(false);
    }
  };

  // ── Step 3: Generate images ──

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
            width: selectedAspect.width,
            height: selectedAspect.height,
            aspect_ratio: selectedAspect.ratio,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '이미지 생성 실패');
        setImages(prev => ({ ...prev, [slide.slide_number]: `data:${data.mimeType};base64,${data.image}` }));
      } catch (err) {
        console.error(`Slide ${slide.slide_number} image error:`, err);
        setError(`${slide.slide_number}장 이미지 실패: ${err instanceof Error ? err.message : '오류'}`);
      }

      if (i < result.slides.length - 1) await new Promise(r => setTimeout(r, 5000));
    }

    setImageGenerating(null);
    setImageProgress(result.slides.length);
  }, [result, selectedAspect]);

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

  const handleArticlesSelected = (articles: SelectedArticle[]) => {
    setSourceArticles(articles);
    const parts = articles.map(a => `- ${a.title}${a.tags?.length ? ` [${a.tags.join(', ')}]` : ''}`);
    setTopic(`다음 콘텐츠를 기반으로 카드뉴스를 만들어줘:\n\n${parts.join('\n')}`);
  };

  // ── Render ──

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <Header language={language} onLanguageChange={setLanguage} />

      <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '40px 20px', width: '100%' }}>

        {/* ════ STEP 1: Input ════ */}
        {step === 'input' && (
          <>
            <div style={{ marginBottom: 40 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                AI 카드뉴스 메이커
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                주제를 입력하거나 피드에서 콘텐츠를 선택하세요
              </p>
            </div>

            {/* Source Articles */}
            {sourceArticles.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  선택된 콘텐츠 ({sourceArticles.length}개)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sourceArticles.map(a => (
                    <div key={a.id} style={{
                      padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8,
                      border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                        background: 'var(--accent-light)', color: 'var(--accent)', whiteSpace: 'nowrap',
                      }}>
                        {a.source_name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.title}
                      </span>
                      <button
                        onClick={() => setSourceArticles(prev => prev.filter(x => x.id !== a.id))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, padding: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Feed Picker Button */}
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '14px 0', marginBottom: 20,
                fontSize: 14, fontWeight: 600,
                color: 'var(--accent)', background: 'var(--accent-light)',
                border: '1px dashed var(--accent)', borderRadius: 8,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              피드에서 주제 찾기
            </button>

            {/* Topic */}
            <section style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                주제
              </label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="예: 2026년 직장인 부업 트렌드 TOP 5"
                rows={4}
                style={{
                  width: '100%', padding: '14px 16px', fontSize: 15,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </section>

            {/* Slide Count */}
            <section style={{ marginBottom: 32 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
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
                        flex: 1, padding: '10px 0', fontSize: 14,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'white' : 'var(--text-secondary)',
                        background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                        border: isSelected ? 'none' : '1px solid var(--border)',
                        borderRadius: 8, cursor: 'pointer',
                      }}
                    >
                      {count}장
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Generate Plan Button */}
            <button
              onClick={handleGeneratePlan}
              disabled={!topic.trim() || isGenerating}
              style={{
                width: '100%', padding: '16px 0', fontSize: 16, fontWeight: 700, color: 'white',
                background: !topic.trim() || isGenerating ? 'var(--text-tertiary)' : 'var(--accent)',
                border: 'none', borderRadius: 8,
                cursor: !topic.trim() || isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating ? '기획안 생성 중...' : '기획안 생성하기'}
            </button>
          </>
        )}

        {/* ════ STEP 2: Plan Review + Chat ════ */}
        {step === 'plan' && result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  기획안 검토
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  슬라이드 구성을 확인하고, 수정이 필요하면 아래에서 요청하세요
                </p>
              </div>
              <button
                onClick={() => { setStep('input'); setResult(null); }}
                style={{
                  fontSize: 13, color: 'var(--text-tertiary)', background: 'none',
                  border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                처음으로
              </button>
            </div>

            {/* Plan Title */}
            <div style={{
              padding: '16px 20px', background: 'var(--accent-light)', borderRadius: 10,
              marginBottom: 20, border: '1px solid var(--accent)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                {result.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {result.slides.length}장 슬라이드
              </div>
            </div>

            {/* Slide List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {result.slides.map(slide => (
                <div
                  key={slide.slide_number}
                  style={{
                    padding: '14px 16px', background: 'var(--bg-secondary)',
                    borderRadius: 10, border: '1px solid var(--border)',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: slide.type === 'cover' ? 'var(--accent)' : slide.type === 'cta' ? '#10B981' : 'var(--bg-tertiary)',
                    color: slide.type === 'content' ? 'var(--text-secondary)' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {slide.slide_number}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        padding: '1px 6px', borderRadius: 4,
                        background: slide.type === 'cover' ? '#EEF2FF' : slide.type === 'cta' ? '#ECFDF5' : 'var(--bg-tertiary)',
                        color: slide.type === 'cover' ? '#4F46E5' : slide.type === 'cta' ? '#059669' : 'var(--text-tertiary)',
                      }}>
                        {slide.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {slide.headline}
                    </div>
                    {(slide.subtext || slide.body) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                        {slide.subtext || slide.body}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Messages */}
            {chatMessages.length > 0 && (
              <div style={{
                background: 'var(--bg-tertiary)', borderRadius: 10,
                padding: 16, marginBottom: 16, maxHeight: 240, overflow: 'auto',
              }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    marginBottom: i < chatMessages.length - 1 ? 12 : 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                      maxWidth: '85%',
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-primary)',
                      color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                      border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Revision Input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(); } }}
                placeholder="수정 요청을 입력하세요 (예: 3번 슬라이드 제목을 바꿔줘)"
                disabled={isRevising}
                style={{
                  flex: 1, padding: '12px 14px', fontSize: 14,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleRevise}
                disabled={!chatInput.trim() || isRevising}
                style={{
                  padding: '0 20px', fontSize: 14, fontWeight: 600, color: 'white',
                  background: !chatInput.trim() || isRevising ? 'var(--text-tertiary)' : 'var(--accent)',
                  border: 'none', borderRadius: 8, cursor: !chatInput.trim() || isRevising ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isRevising ? '수정 중...' : '수정'}
              </button>
            </div>

            {/* Proceed to Production */}
            <button
              onClick={() => { setStep('production'); setImages({}); setImageProgress(0); }}
              style={{
                width: '100%', padding: '16px 0', fontSize: 16, fontWeight: 700, color: 'white',
                background: '#10B981', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              이 기획안으로 제작하기
            </button>
          </>
        )}

        {/* ════ STEP 3: Production ════ */}
        {step === 'production' && result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  카드뉴스 제작
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  화면 비율을 선택하고 이미지를 생성하세요
                </p>
              </div>
              <button
                onClick={() => setStep('plan')}
                style={{
                  fontSize: 13, color: 'var(--text-tertiary)', background: 'none',
                  border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                기획안 수정
              </button>
            </div>

            {/* Aspect Ratio */}
            <section style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                화면 비율
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {ASPECT_RATIOS.map(r => {
                  const isSelected = selectedRatio === r.id;
                  const pc = PLATFORM_COLORS[r.platform];
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRatio(r.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 8px',
                        border: isSelected ? `2px solid ${pc}` : '1px solid var(--border)',
                        borderRadius: 8,
                        background: isSelected ? `${pc}08` : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: r.width > r.height ? 40 : 40 * (r.width / r.height),
                        height: r.height > r.width ? 40 : 40 * (r.height / r.width),
                        border: `2px solid ${isSelected ? pc : 'var(--border-hover)'}`,
                        borderRadius: 3, background: isSelected ? `${pc}15` : 'var(--bg-tertiary)',
                      }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? pc : 'var(--text-primary)' }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                          {r.ratio}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Slide Preview Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${selectedAspect.width >= selectedAspect.height ? 200 : 150}px, 1fr))`,
              gap: 12, marginBottom: 24,
            }}>
              {result.slides.map(slide => {
                const imgSrc = images[slide.slide_number];
                const isThisGen = imageGenerating === slide.slide_number;
                return (
                  <div key={slide.slide_number} style={{
                    width: '100%', aspectRatio: `${selectedAspect.width} / ${selectedAspect.height}`,
                    borderRadius: 8, overflow: 'hidden', position: 'relative',
                    background: imgSrc ? undefined : `linear-gradient(135deg, ${slide.color_scheme}CC, ${slide.color_scheme}40)`,
                    border: '1px solid var(--border)',
                  }}>
                    {imgSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc} alt={`slide ${slide.slide_number}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {isThisGen && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {slide.slide_number}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 12px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', color: 'white' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{slide.headline}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Image Generation / Download */}
            <div style={{ display: 'flex', gap: 10 }}>
              {!allImagesReady ? (
                <button
                  onClick={generateImages}
                  disabled={imageGenerating !== null}
                  style={{
                    flex: 1, padding: '14px 0', fontSize: 15, fontWeight: 700, color: 'white',
                    background: imageGenerating !== null ? 'var(--text-tertiary)' : '#10B981',
                    border: 'none', borderRadius: 8,
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
                    background: 'var(--accent)', border: 'none', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  전체 다운로드 ({result.slides.length}장)
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {imageGenerating !== null && (
              <div style={{ marginTop: 10, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#10B981', width: `${((imageProgress + 1) / result.slides.length) * 100}%`, transition: 'width 0.5s ease' }} />
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, padding: '14px 18px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 14,
          }}>
            {error}
          </div>
        )}
      </main>

      <Footer language={language} />

      {/* Article Picker Modal */}
      <ArticlePickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onConfirm={handleArticlesSelected}
        initialSelected={sourceArticles}
        userId={authUser?.id}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
