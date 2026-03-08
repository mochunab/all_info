'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BlogPost } from '@/types';
import { localePath } from '@/lib/locale-path';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'job', label: '취업팁' },
  { key: 'career', label: '커리어UP' },
  { key: 'ai', label: 'AI따라잡기' },
] as const;

type Props = {
  posts: BlogPost[];
  locale: string;
};

export default function BlogList({ posts, locale }: Props) {
  const lp = (p: string) => localePath(locale, p);
  const [category, setCategory] = useState('all');

  const filtered = category === 'all'
    ? posts
    : posts.filter((p) => p.category === category);

  return (
    <>
      <div className="flex gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors duration-200 ${
              category === cat.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[var(--text-tertiary)]">해당 카테고리에 게시된 글이 없습니다.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={lp(`/blog/${post.slug}`)}
              className="card card-hover p-6 group cursor-pointer"
            >
              <h2 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-200 line-clamp-2">
                {post.title}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2.5 line-clamp-2 leading-relaxed">
                {post.description}
              </p>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border)]">
                {post.published_at && (
                  <time className="text-xs text-[var(--text-tertiary)]">
                    {new Date(post.published_at).toLocaleDateString('ko-KR')}
                  </time>
                )}
                {post.tags.length > 0 && (
                  <div className="flex gap-1.5 ml-auto">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 text-xs font-medium bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
