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
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] xl:right-[calc((100vw-1280px)/2+32px)] z-50 max-h-[70vh] sm:max-h-none sm:top-[112px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 shrink-0">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-semibold text-sm text-gray-900 truncate">{t(language, 'chat.title')}</span>
          <span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full shrink-0">{category}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setInput(''); }}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="New chat"
              title={t(language, 'chat.newChat')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          </button>
        </div>
      </div>

      {/* Context badge */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 shrink-0">
        <span className="text-xs text-blue-600">
          {t(language, 'chat.contextBadge', { category, count: String(articles.length) })}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
            <p className="text-sm text-gray-500 text-center">{t(language, 'chat.welcome')}</p>
            <div className="flex flex-col gap-2 w-full">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
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
                <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap bg-blue-600 text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-gray-100 text-gray-800 chat-markdown">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Pinned Article Badge */}
      {pinnedArticle && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-t border-amber-100 shrink-0">
          <span className="text-xs shrink-0">📌</span>
          <span className="text-xs text-amber-800 truncate flex-1">
            {pinnedArticle.title_ko || pinnedArticle.title}
          </span>
          <button
            onClick={onClearPinned}
            className="p-0.5 hover:bg-amber-200 rounded transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t(language, 'chat.placeholder')}
          disabled={isLoading}
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
      <LoginPromptDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
    </div>
  );
}
