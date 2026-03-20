'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import ScoreBreakdown from '@/components/crypto/ScoreBreakdown';
import AiReasoningQuotes from '@/components/crypto/AiReasoningQuotes';
import SourceBreakdown from '@/components/crypto/SourceBreakdown';
import PhraseCloud from '@/components/crypto/PhraseCloud';
import NarrativeContext from '@/components/crypto/NarrativeContext';
import EventTimeline from '@/components/crypto/EventTimeline';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  data: TrendingExplainResponse;
  language: Language;
};

export default function WhyTrendingPanel({ data, language }: Props) {
  const priceChange = data.price?.price_change_pct_24h;
  const changeColor = priceChange
    ? priceChange > 0 ? 'text-emerald-500' : 'text-red-500'
    : '';

  return (
    <div className="overflow-y-auto flex flex-col gap-4 p-4" style={{ maxHeight: 420 }}>
      {/* Header: Coin + Price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)]">{data.coin_symbol}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            {data.score_breakdown.final_score.toFixed(0)}
          </span>
        </div>
        {data.price && (
          <div className="text-right">
            <div className="text-xs text-[var(--text-primary)]">
              ${data.price.price_usd < 1
                ? data.price.price_usd.toPrecision(4)
                : data.price.price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            {priceChange != null && (
              <div className={`text-[10px] ${changeColor}`}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--border)]" />

      {/* A. Score Breakdown */}
      <ScoreBreakdown breakdown={data.score_breakdown} language={language} />

      <div className="h-px bg-[var(--border)]" />

      {/* B. AI Reasoning */}
      <AiReasoningQuotes posts={data.post_sentiments} language={language} />

      <div className="h-px bg-[var(--border)]" />

      {/* C. Source Breakdown */}
      <SourceBreakdown sources={data.source_breakdown} language={language} />

      <div className="h-px bg-[var(--border)]" />

      {/* D. Phrase Cloud */}
      <PhraseCloud phrases={data.top_phrases} language={language} />

      {/* E. Narrative Context */}
      {(data.narratives.length > 0 || data.events.length > 0) && (
        <>
          <div className="h-px bg-[var(--border)]" />
          <NarrativeContext narratives={data.narratives} events={data.events} language={language} />
        </>
      )}

      {/* F. Event Timeline */}
      <div className="h-px bg-[var(--border)]" />
      <EventTimeline coin={data.coin_symbol} language={language} />
    </div>
  );
}
