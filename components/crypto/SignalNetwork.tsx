'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { CryptoSignal } from '@/types/crypto';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type NetworkNode = {
  id: string;
  name: string;
  fullName: string;
  type: 'coin' | 'influencer';
  mentions: number;
  sentiment: number;
  score: number;
  label: string;
  velocity: number;
  x?: number;
  y?: number;
};

type NetworkLink = {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: string;
  weight: number;
};

type Keyword = { word: string; count: number };

type SignalNetworkProps = {
  signals: CryptoSignal[];
  onCoinSelect: (symbol: string) => void;
};

const SENTIMENT_COLORS = {
  bullish: '#22c55e',
  neutral: '#a3a3a3',
  bearish: '#ef4444',
} as const;

function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.3) return SENTIMENT_COLORS.bullish;
  if (sentiment < -0.3) return SENTIMENT_COLORS.bearish;
  return SENTIMENT_COLORS.neutral;
}

function getNodeSize(mentions: number, maxMentions: number): number {
  if (maxMentions === 0) return 4;
  return 3 + (mentions / maxMentions) * 12;
}

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(check());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setDark(check());
    mq.addEventListener('change', handler);
    const obs = new MutationObserver(() => setDark(check()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { mq.removeEventListener('change', handler); obs.disconnect(); };
  }, []);
  return dark;
}

export default function SignalNetwork({ signals, onCoinSelect }: SignalNetworkProps) {
  const isDark = useIsDark();
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });

  const topCoins = useMemo(() => signals.slice(0, 8), [signals]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setDimensions({ width: Math.max(300, w), height: 350 });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fetchNetwork = useCallback(async (coin?: string) => {
    setLoading(true);
    try {
      const url = coin
        ? `/api/crypto/network?coin=${coin}&limit=30`
        : '/api/crypto/network?limit=30';
      const res = await fetch(url);
      const data = await res.json();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      setKeywords(data.keywords || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  const handleChipClick = useCallback(
    (symbol: string) => {
      const next = selectedChip === symbol ? null : symbol;
      setSelectedChip(next);
      fetchNetwork(next || undefined);
    },
    [selectedChip, fetchNetwork]
  );

  const maxMentions = useMemo(
    () => Math.max(...nodes.map((n) => n.mentions), 1),
    [nodes]
  );

  const neighborSet = useMemo(() => {
    if (!selectedChip) return null;
    const selected = nodes.find((n) => n.name === selectedChip);
    if (!selected) return null;
    const ids = new Set<string>([selected.id]);
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : l.source.id;
      const tgt = typeof l.target === 'string' ? l.target : l.target.id;
      if (src === selected.id) ids.add(tgt);
      if (tgt === selected.id) ids.add(src);
    }
    return ids;
  }, [selectedChip, nodes, links]);

  const graphWidth = useMemo(() => {
    if (selectedChip && keywords.length > 0) return Math.floor(dimensions.width * 0.6);
    return dimensions.width;
  }, [selectedChip, keywords, dimensions.width]);

  const maxKwCount = useMemo(
    () => Math.max(...keywords.map((k) => k.count), 1),
    [keywords]
  );

  const nodeCanvasObject = useCallback(
    (node: NetworkNode, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const size = getNodeSize(node.mentions, maxMentions);
      const isInfluencer = node.type === 'influencer';
      const dimmed = neighborSet && !neighborSet.has(node.id);
      const alpha = dimmed ? 0.15 : 1;

      ctx.globalAlpha = alpha;

      // glow for selected
      if (selectedChip && node.name === selectedChip) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fill();
      }

      ctx.beginPath();
      if (isInfluencer) {
        // diamond shape
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
      } else {
        ctx.arc(x, y, size, 0, 2 * Math.PI);
      }

      ctx.fillStyle = isInfluencer ? '#8b5cf6' : getSentimentColor(node.sentiment);
      ctx.fill();

      ctx.strokeStyle = isDark
        ? (dimmed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)')
        : (dimmed ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.15)');
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // label
      if (size > 5 || (selectedChip && node.name === selectedChip)) {
        ctx.font = `bold ${Math.max(10, size * 0.9)}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isDark
          ? (dimmed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)')
          : (dimmed ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.8)');
        ctx.fillText(node.name, x, y + size + 2);
      }

      ctx.globalAlpha = 1;
    },
    [maxMentions, selectedChip, neighborSet, isDark]
  );

  const linkColor = useCallback(
    (link: NetworkLink) => {
      const defaultColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      const fadedColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      if (!neighborSet) return defaultColor;
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (neighborSet.has(src) && neighborSet.has(tgt)) {
        return link.type === 'correlates_with'
          ? 'rgba(59, 130, 246, 0.5)'
          : 'rgba(139, 92, 246, 0.4)';
      }
      return fadedColor;
    },
    [neighborSet, isDark]
  );

  const linkWidth = useCallback(
    (link: NetworkLink) => {
      if (!neighborSet) return 0.5;
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      return neighborSet.has(src) && neighborSet.has(tgt)
        ? Math.min(link.weight * 0.5, 3)
        : 0.3;
    },
    [neighborSet]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      if (node.type === 'coin') {
        onCoinSelect(node.name);
      }
    },
    [onCoinSelect]
  );

  if (signals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-primary)] overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Signal Network
          </h2>
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {topCoins.map((s) => (
              <button
                key={s.coin_symbol}
                onClick={() => handleChipClick(s.coin_symbol)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  selectedChip === s.coin_symbol
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {s.coin_symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Graph + Keywords */}
        <div className="flex" ref={containerRef}>
          {/* Force Graph */}
          <div
            className="relative"
            style={{ width: graphWidth, height: dimensions.height }}
          >
            {loading && nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                네트워크 로딩 중...
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                크롤링 데이터가 쌓이면 네트워크가 표시됩니다
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <ForceGraph2D
                  ref={graphRef}
                  width={graphWidth}
                  height={dimensions.height}
                  graphData={{ nodes, links }}
                  nodeCanvasObject={nodeCanvasObject as any}
                  nodePointerAreaPaint={((node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    const size = getNodeSize(node.mentions, maxMentions);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, size + 2, 0, 2 * Math.PI);
                    ctx.fill();
                  }) as any}
                  linkColor={linkColor as any}
                  linkWidth={linkWidth as any}
                  onNodeClick={handleNodeClick as any}
                  onNodeHover={((node: any) => setHoveredNode(node)) as any}
                  backgroundColor="transparent"
                  cooldownTicks={60}
                  d3AlphaDecay={0.05}
                  d3VelocityDecay={0.3}
                  enableZoomInteraction={true}
                  enablePanInteraction={true}
                  enableNodeDrag={true}
                />

                {/* Tooltip */}
                {hoveredNode && (
                  <div className="absolute top-3 left-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs pointer-events-none shadow-lg z-10">
                    <div className="font-bold text-[var(--text-primary)]">
                      {hoveredNode.name}
                      {hoveredNode.fullName !== hoveredNode.name && (
                        <span className="font-normal text-[var(--text-tertiary)] ml-1">
                          {hoveredNode.fullName}
                        </span>
                      )}
                    </div>
                    {hoveredNode.type === 'coin' && (
                      <div className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
                        <div>Score: {hoveredNode.score.toFixed(0)}/100</div>
                        <div>Mentions: {hoveredNode.mentions}</div>
                        <div>Sentiment: {hoveredNode.sentiment > 0 ? '+' : ''}{hoveredNode.sentiment.toFixed(2)}</div>
                      </div>
                    )}
                    {hoveredNode.type === 'influencer' && (
                      <div className="mt-1 text-purple-400">Influencer</div>
                    )}
                  </div>
                )}

                {/* Legend */}
                <div className="absolute bottom-2 left-3 flex gap-3 text-[10px] text-[var(--text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Bullish
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 inline-block" />
                    Neutral
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Bearish
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" style={{ transform: 'rotate(45deg)', width: 7, height: 7 }} />
                    Influencer
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Keyword Cloud */}
          {selectedChip && (
            <div
              className="border-l border-[var(--border)] p-4 flex flex-col"
              style={{
                width: dimensions.width - graphWidth,
                height: dimensions.height,
              }}
            >
              <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">
                {selectedChip} Keywords
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] mb-3">
                AI-extracted from community posts
              </div>

              {keywords.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                  {loading ? 'Loading...' : 'No keyword data yet'}
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-wrap items-center justify-center gap-1.5 content-center">
                  {keywords.map((kw) => {
                    const ratio = kw.count / maxKwCount;
                    const fontSize = 11 + ratio * 14;
                    const opacity = 0.4 + ratio * 0.6;
                    return (
                      <span
                        key={kw.word}
                        className="inline-block text-blue-400 hover:text-blue-300 transition-colors cursor-default"
                        style={{ fontSize, opacity }}
                        title={`${kw.count} mentions`}
                      >
                        {kw.word}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Mini stats */}
              {selectedChip && !loading && (
                <div className="mt-auto pt-3 border-t border-[var(--border)] space-y-1">
                  {(() => {
                    const sig = signals.find((s) => s.coin_symbol === selectedChip);
                    if (!sig) return null;
                    const sentColor =
                      sig.avg_sentiment > 0.3
                        ? 'text-green-400'
                        : sig.avg_sentiment < -0.3
                          ? 'text-red-400'
                          : 'text-yellow-400';
                    return (
                      <>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-tertiary)]">Sentiment</span>
                          <span className={sentColor}>
                            {sig.avg_sentiment > 0 ? '+' : ''}
                            {sig.avg_sentiment.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--text-tertiary)]">FOMO Index</span>
                          <span className="text-[var(--text-secondary)]">
                            {sig.weighted_score.toFixed(0)}%
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
