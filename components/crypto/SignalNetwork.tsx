'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { CryptoSignal } from '@/types/crypto';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

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
  z?: number;
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
  language?: 'ko' | 'en' | 'vi' | 'zh' | 'ja';
};

const SENTIMENT_COLORS = {
  bullish: '#22c55e',
  neutral: '#9CA3AF',
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
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });

  const topCoins = useMemo(() => signals.slice(0, 8), [signals]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setDimensions({ width: Math.max(300, w), height: 420 });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // configure forces & center camera after layout stabilizes
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || nodes.length === 0) return;

    // tighten layout: strong center pull + limited repulsion + shorter links
    fg.d3Force('center')?.strength(1);
    fg.d3Force('charge')?.strength(-30).distanceMax(100);
    fg.d3Force('link')?.distance(20);
    fg.d3ReheatSimulation();

    const timer = setTimeout(() => {
      fg.zoomToFit(400, 40);
    }, 1500);
    return () => clearTimeout(timer);
  }, [nodes]);

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

  const bgColor = useMemo(() => isDark ? '#111827' : '#FAFAFA', [isDark]);

  const nodeColorFn = useCallback(
    (node: NetworkNode) => {
      const dimmed = neighborSet && !neighborSet.has(node.id);
      if (dimmed) return isDark ? 'rgba(100,100,100,0.2)' : 'rgba(180,180,180,0.3)';
      if (node.type === 'influencer') return '#8b5cf6';
      if (selectedChip && node.name === selectedChip) return '#2563EB';
      return getSentimentColor(node.sentiment);
    },
    [neighborSet, selectedChip, isDark]
  );

  const nodeValFn = useCallback(
    (node: NetworkNode) => {
      const size = getNodeSize(node.mentions, maxMentions);
      const dimmed = neighborSet && !neighborSet.has(node.id);
      const isSelected = selectedChip && node.name === selectedChip;
      if (dimmed) return size * 0.3;
      if (isSelected) return size * 2;
      return size;
    },
    [maxMentions, neighborSet, selectedChip]
  );

  const nodeLabel = useCallback(
    (node: NetworkNode) => {
      if (node.type === 'influencer') {
        return `<div style="background:rgba(139,92,246,0.9);color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600">${node.name}<br/><span style="font-weight:400;font-size:10px">Influencer</span></div>`;
      }
      return `<div style="background:var(--bg-secondary,#fff);color:var(--text-primary,#111);padding:6px 12px;border-radius:8px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid var(--border,#E5E7EB)">
        <div style="font-weight:700">${node.name}${node.fullName !== node.name ? ` <span style="font-weight:400;color:var(--text-tertiary,#9CA3AF)">${node.fullName}</span>` : ''}</div>
        <div style="margin-top:3px;font-size:10px;color:var(--text-secondary,#4B5563)">Score: ${node.score.toFixed(0)} · Mentions: ${node.mentions} · Sentiment: ${node.sentiment > 0 ? '+' : ''}${node.sentiment.toFixed(2)}</div>
      </div>`;
    },
    []
  );

  const linkColorFn = useCallback(
    (link: NetworkLink) => {
      if (!neighborSet) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (neighborSet.has(src) && neighborSet.has(tgt)) {
        return link.type === 'correlates_with'
          ? 'rgba(37, 99, 235, 0.45)'
          : 'rgba(139, 92, 246, 0.35)';
      }
      return isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)';
    },
    [neighborSet, isDark]
  );

  const linkWidthFn = useCallback(
    (link: NetworkLink) => {
      if (!neighborSet) return 0.3;
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      return neighborSet.has(src) && neighborSet.has(tgt)
        ? Math.min(link.weight * 0.5, 2.5)
        : 0.15;
    },
    [neighborSet]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      if (node.type === 'coin') onCoinSelect(node.name);
    },
    [onCoinSelect]
  );

  if (signals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-primary)] overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Signal Network
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
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
          </div>
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {topCoins.map((s) => (
              <button
                key={s.coin_symbol}
                onClick={() => handleChipClick(s.coin_symbol)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  selectedChip === s.coin_symbol
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/25'
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
          {/* 3D Force Graph */}
          <div className="relative" style={{ width: graphWidth, height: dimensions.height }}>
            {loading && nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                Loading network...
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                Network will appear after crawling
              </div>
            ) : (
              <>
                <ForceGraph3D
                  ref={graphRef}
                  width={graphWidth}
                  height={dimensions.height}
                  graphData={{ nodes, links }}
                  nodeColor={nodeColorFn as any}
                  nodeVal={nodeValFn as any}
                  nodeLabel={nodeLabel as any}
                  nodeOpacity={0.9}
                  linkColor={linkColorFn as any}
                  linkWidth={linkWidthFn as any}
                  linkOpacity={0.6}
                  onNodeClick={handleNodeClick as any}
                  onNodeHover={((node: any) => setHoveredNode(node)) as any}
                  backgroundColor={bgColor}
                  showNavInfo={false}
                  controlType="orbit"
                  enableNodeDrag={false}
                  enableNavigationControls={true}
                  warmupTicks={100}
                  cooldownTicks={0}
                />

                {/* Node name overlay for large nodes */}
                {hoveredNode && (
                  <div className="absolute top-3 right-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-2 py-1 rounded-md border border-[var(--border)]">
                    Click to view details
                  </div>
                )}
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
                        className="inline-block text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-default"
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
