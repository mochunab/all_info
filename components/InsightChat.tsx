'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { event as gaEvent } from '@/lib/gtag';
import type { Article, ChatMessage, ChatResponse, Language } from '@/types';
import { t } from '@/lib/i18n';
import LoginPromptDialog from './LoginPromptDialog';

type InsightChatProps = {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  category: string;
  language: Language;
  pinnedArticle: Article | null;
  onClearPinned: () => void;
  isLoggedIn?: boolean;
};

export default function InsightChat({ isOpen, onClose, articles, category, language, pinnedArticle, onClearPinned, isLoggedIn = false }: InsightChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contentPreview, setContentPreview] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCategoryRef = useRef(category);

  useEffect(() => {
    if (prevCategoryRef.current !== category) {
      setMessages([]);
      setInput('');
      prevCategoryRef.current = category;
    }
  }, [category]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role === 'user') {
      // 유저 메시지 전송 시 → 최하단 스크롤 (로딩 인디케이터 보이도록)
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    } else {
      // AI 응답 도착 시 → 유저 메시지 위치로 스크롤 (응답 상단부터 읽기)
      lastUserMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!pinnedArticle) {
      setContentPreview(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/articles/${pinnedArticle.id}/content`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data) setContentPreview(data.content_preview);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pinnedArticle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const articleContext = articles.map(a => ({
    title: a.title_ko || a.title,
    summary: a.summary,
    summary_tags: a.summary_tags,
  }));

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    gaEvent({ action: 'send_message', category: 'chat', label: text.trim().slice(0, 50) });

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const requestBody: Record<string, unknown> = {
        messages: newMessages,
        articles: articleContext,
        category,
        language,
      };

      if (pinnedArticle) {
        requestBody.pinnedArticle = {
          title: pinnedArticle.title_ko || pinnedArticle.title,
          summary: pinnedArticle.summary,
          summary_tags: pinnedArticle.summary_tags,
          content_preview: contentPreview,
        };
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: ChatResponse = await res.json();
      if (data.success && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply! }]);
      } else {
        throw new Error(data.error || t(language, 'chat.error'));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : t(language, 'chat.networkError');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${errMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, articleContext, category, language, pinnedArticle, contentPreview]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setShowLoginDialog(true);
      return;
    }
    sendMessage(input);
  };

  const quickQuestions = [
    t(language, 'chat.quickTrend'),
    t(language, 'chat.quickSummary'),
    t(language, 'chat.quickInsight'),
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] xl:right-[calc((100vw-1280px)/2+32px)] z-50 max-h-[70vh] sm:max-h-none sm:top-[112px] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-primary)] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="font-bold text-sm text-[var(--text-primary)] truncate">{t(language, 'chat.title')}</span>
          <span className="text-[11px] font-medium px-2.5 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full shrink-0">{category}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setInput(''); }}
              className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors duration-200 cursor-pointer"
              aria-label="New chat"
              title={t(language, 'chat.newChat')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors duration-200 cursor-pointer"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Context badge */}
      <div className="px-5 py-2.5 bg-[var(--accent-light)] shrink-0">
        <span className="text-xs font-medium text-[var(--accent)]">
          {t(language, 'chat.contextBadge', { category, count: String(articles.length) })}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-6">
            <p className="text-sm text-[var(--text-tertiary)] text-center whitespace-pre-line">{t(language, 'chat.welcome')}</p>
            <div className="flex flex-col gap-2.5 w-full">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border)] rounded-xl text-[var(--text-primary)] transition-colors duration-200 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              ref={msg.role === 'user' ? lastUserMsgRef : undefined}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap bg-[var(--accent)] text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-[var(--bg-tertiary)] text-[var(--text-primary)] chat-markdown">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Pinned Article Badge */}
      {pinnedArticle && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-light)] border-t border-[var(--border)] shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)] shrink-0">
            <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z" />
          </svg>
          <span className="text-xs font-medium text-[var(--accent)] truncate flex-1">
            {pinnedArticle.title_ko || pinnedArticle.title}
          </span>
          <button
            onClick={onClearPinned}
            className="p-1 hover:bg-[var(--border)] rounded-lg transition-colors duration-200 shrink-0 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t(language, 'chat.placeholder')}
          disabled={isLoading}
          className="flex-1 text-sm px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] disabled:opacity-50 transition-all duration-200"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-tertiary)] text-white rounded-xl transition-colors duration-200 shrink-0 cursor-pointer active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
      <LoginPromptDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
    </div>
  );
}
