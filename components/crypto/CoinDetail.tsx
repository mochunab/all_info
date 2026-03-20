'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { CryptoSignal, CryptoPost, CryptoEntity, TimeWindow } from '@/types/crypto';
import { t } from '@/lib/i18n';
import SentimentGauge from './SentimentGauge';
import TimeWindowSelector from './TimeWindowSelector';

type CoinDetailProps = {
  symbol: string;
  onClose: () => void;
  language?: 'ko' | 'en' | 'vi' | 'zh' | 'ja';
};

type DetailData = {
  entity: CryptoEntity | null;
  signals: CryptoSignal[];
  posts: CryptoPost[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relations: any[];
};

type TimelinePoint = {
  timestamp: string;
  mentions: number;
  avg_sentiment: number | null;
  avg_fomo: number | null;
};

type EventPoint = {
  id: string;
  name: string;
  timestamp: string;
  impact: string;
  coins: string[];
};

export default function CoinDetail({ symbol, onClose, language = 'ko' }: CoinDetailProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [events, setEvents] = useState<EventPoint[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coinsRes, signalsRes, postsRes, historyRes, eventsRes] = await Promise.all([
        fetch(`/api/crypto/coins?search=${symbol}&type=coin&limit=1`),
        fetch(`/api/crypto/signals?coin=${symbol}&window=${timeWindow}`),
        fetch(`/api/crypto/posts?coin=${symbol}&limit=10`),
        fetch(`/api/crypto/history?coin=${symbol}&days=7`),
        fetch(`/api/crypto/events?coin=${symbol}&days=7&limit=10`),
      ]);

      const [coinsData, signalsData, postsData, historyData, eventsData] = await Promise.all([
        coinsRes.json(),
        signalsRes.json(),
        postsRes.json(),
        historyRes.json(),
        eventsRes.json(),
      ]);

      setData({
        entity: coinsData.entities?.[0] || null,
        signals: signalsData.signals || [],
        posts: postsData.posts || [],
        relations: coinsData.relations || [],
      });
      setTimeline(historyData.timeline || []);
      setEvents(eventsData.events || []);
    } catch (error) {
      console.error('Failed to fetch coin detail:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeWindow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const signal = data?.signals?.[0];
  const dateLocale = language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : language === 'vi' ? 'vi-VN' : 'en-US';

  const chartData = timeline.map((p) => ({
    label: new Date(p.timestamp).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', hour: '2-digit' }),
    mentions: p.mentions,
    sentiment: p.avg_sentiment != null ? Math.round(p.avg_sentiment * 100) : null,
    fomo: p.avg_fomo != null ? Math.round(p.avg_fomo * 100) : null,
  }));

  const eventLabels = events.map((evt) => {
    const evtDate = new Date(evt.timestamp);
    return {
      label: evtDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', hour: '2-digit' }),
      name: evt.name,
      impact: evt.impact,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border)] p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{symbol}</h2>
            {data?.entity && (
              <p className="text-sm text-[var(--text-tertiary)]">{data.entity.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          <TimeWindowSelector selected={timeWindow} onChange={setTimeWindow} />

          {loading ? (
            <div className="text-center py-8 text-[var(--text-tertiary)]">{t(language, 'crypto.loading')}</div>
          ) : (
            <>
              {signal && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                      <p className="text-xs text-[var(--text-tertiary)]">{t(language, 'crypto.score')}</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {signal.weighted_score.toFixed(0)}
                        <span className="text-sm font-normal text-[var(--text-tertiary)]">/100</span>
                      </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {t(language, 'crypto.mentions').replace('{count}', '').trim()}
                      </p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {signal.mention_count}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">{t(language, 'crypto.sentiment')}</p>
                    <SentimentGauge score={signal.avg_sentiment} />
                  </div>
                  {signal.sentiment_trend !== 0 && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      <span>{t(language, 'crypto.communityMood')}</span>
                      <span className={signal.sentiment_trend > 0 ? 'text-green-500' : 'text-red-500'}>
                        {signal.sentiment_trend > 0 ? '+' : ''}{(signal.sentiment_trend * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {chartData.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
                    {t(language, 'crypto.chart.title')}
                  </h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          yAxisId="mentions"
                          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                          allowDecimals={false}
                        />
                        <YAxis
                          yAxisId="sentiment"
                          orientation="right"
                          domain={[-100, 100]}
                          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                          hide
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any, name: any) => {
                            if (name === 'sentiment') return [`${value}%`, t(language, 'crypto.sentiment')];
                            if (name === 'fomo') return [`${value}%`, 'FOMO'];
                            return [value, t(language, 'crypto.mentions').replace('{count}', '').trim()];
                          }}
                        />
                        <Bar
                          yAxisId="mentions"
                          dataKey="mentions"
                          fill="var(--accent, #6366f1)"
                          opacity={0.4}
                          radius={[2, 2, 0, 0]}
                        />
                        <Line
                          yAxisId="sentiment"
                          dataKey="sentiment"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          yAxisId="sentiment"
                          dataKey="fomo"
                          stroke="#f97316"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                          connectNulls
                        />
                        {eventLabels.map((evt, i) => (
                          <ReferenceLine
                            key={`evt-${i}`}
                            x={evt.label}
                            yAxisId="mentions"
                            stroke={evt.impact === 'positive' ? '#22c55e' : evt.impact === 'negative' ? '#ef4444' : '#9CA3AF'}
                            strokeDasharray="3 3"
                            strokeWidth={1}
                            label={{
                              value: evt.name.length > 15 ? evt.name.slice(0, 15) + '…' : evt.name,
                              position: 'insideTopRight',
                              fontSize: 9,
                              fill: 'var(--text-tertiary)',
                            }}
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-1 text-[10px] text-[var(--text-tertiary)]">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded-sm bg-[var(--accent,#6366f1)] opacity-40" />
                      {t(language, 'crypto.mentions').replace('{count}', '').trim()}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-green-500" />
                      {t(language, 'crypto.sentiment')}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-orange-500" style={{ borderTop: '1px dashed' }} />
                      FOMO
                    </span>
                    {eventLabels.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-3 h-0.5 bg-neutral-400" style={{ borderTop: '1px dashed' }} />
                        Events
                      </span>
                    )}
                  </div>
                </div>
              )}

              {data?.relations && data.relations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{t(language, 'crypto.relatedEntities')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.relations.slice(0, 10).map((rel: { id: string; relation_type: string; source_entity?: { name: string }; target_entity?: { name: string } }) => {
                      const related = rel.source_entity?.name === symbol
                        ? rel.target_entity
                        : rel.source_entity;
                      return (
                        <span
                          key={rel.id}
                          className="px-2 py-1 text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full"
                        >
                          {related?.name || '?'} ({rel.relation_type})
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {data?.posts && data.posts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{t(language, 'crypto.relatedPosts')}</h3>
                  <div className="space-y-2">
                    {data.posts.map((post) => (
                      <a
                        key={post.id}
                        href={post.permalink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <p className="text-sm text-[var(--text-primary)] line-clamp-2">{post.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)]">
                          <span>{post.source === 'telegram' ? `t/${post.channel}` : `r/${post.channel}`}</span>
                          <span>↑{post.upvotes}</span>
                          <span>💬{post.num_comments}</span>
                          <span>{new Date(post.posted_at).toLocaleDateString(dateLocale)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
