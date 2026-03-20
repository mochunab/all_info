'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { CryptoSignal, TrendingExplainResponse, TimeWindow } from '@/types/crypto';
import { useIsDark } from '@/lib/hooks/useIsDark';
import { t } from '@/lib/i18n';
import WhyTrendingPanel from '@/components/crypto/WhyTrendingPanel';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

type NetworkNode = {
  id: string;
  name: string;
  fullName: string;
  type: 'coin' | 'influencer' | 'narrative' | 'event';
  mentions: number;
  sentiment: number;
  score: number;
  label: string;
  velocity: number;
  confidence: number;
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

type SignalNetworkProps = {
  signals: CryptoSignal[];
  onCoinSelect: (symbol: string) => void;
  language?: 'ko' | 'en' | 'vi' | 'zh' | 'ja';
  timeWindow?: TimeWindow;
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

const MD3_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export default function SignalNetwork({ signals, onCoinSelect, language = 'ko', timeWindow = '24h' }: SignalNetworkProps) {
  const isDark = useIsDark();
  const [isOpen, setIsOpen] = useState(false);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef<any>(null);
  const hoverTipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });

  // WHY panel state
  const [explainData, setExplainData] = useState<TrendingExplainResponse | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const explainCache = useRef<Map<string, TrendingExplainResponse>>(new Map());

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

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || nodes.length === 0) return;

    fg.cameraPosition({ x: 0, y: 0, z: 200 });

    const timer = setTimeout(() => {
      fg.zoomToFit(600, 10);
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
      const rawNodes: NetworkNode[] = data.nodes || [];
      const rawLinks: NetworkLink[] = data.links || [];

      const connectedIds = new Set<string>();
      for (const l of rawLinks) {
        connectedIds.add(typeof l.source === 'string' ? l.source : l.source.id);
        connectedIds.add(typeof l.target === 'string' ? l.target : l.target.id);
      }

      const connected = rawNodes.filter((n) => connectedIds.has(n.id));
      const connectedCount = connected.length;

      const positioned = connected.map((n, idx) => {
        const phi = Math.acos(1 - (2 * (idx + 0.5)) / connectedCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
        const r = 30 + Math.random() * 10;
        return { ...n, x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi) };
      });

      setNodes(positioned);
      setLinks(rawLinks);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && topCoins.length > 0) {
      const firstCoin = topCoins[0].coin_symbol;
      setSelectedChip(firstCoin);
      fetchNetwork(firstCoin);
      fetchExplain(firstCoin);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchExplain = useCallback(async (coin: string) => {
    const cached = explainCache.current.get(`${coin}-${timeWindow}`);
    if (cached) {
      setExplainData(cached);
      return;
    }
    setExplainLoading(true);
    try {
      const res = await fetch(`/api/crypto/trending-explain?coin=${coin}&window=${timeWindow}`);
      if (res.ok) {
        const data: TrendingExplainResponse = await res.json();
        explainCache.current.set(`${coin}-${timeWindow}`, data);
        setExplainData(data);
      } else {
        setExplainData(null);
      }
    } catch {
      setExplainData(null);
    } finally {
      setExplainLoading(false);
    }
  }, [timeWindow]);

  const handleChipClick = useCallback(
    (symbol: string) => {
      const next = selectedChip === symbol ? null : symbol;
      setSelectedChip(next);
      fetchNetwork(next || undefined);
      if (next) {
        fetchExplain(next);
      } else {
        setExplainData(null);
      }
    },
    [selectedChip, fetchNetwork, fetchExplain]
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
    if (selectedChip) return Math.floor(dimensions.width * 0.6);
    return dimensions.width;
  }, [selectedChip, dimensions.width]);

  const bgColor = useMemo(() => isDark ? '#111827' : '#FAFAFA', [isDark]);

  const nodeColorFn = useCallback(
    (node: NetworkNode) => {
      const dimmed = neighborSet && !neighborSet.has(node.id);
      if (dimmed) return isDark ? 'rgba(100,100,100,0.2)' : 'rgba(180,180,180,0.3)';
      const alpha = Math.max(0.3, node.confidence ?? 1.0);
      if (node.type === 'influencer') return `rgba(139,92,246,${alpha})`;
      if (node.type === 'narrative') return `rgba(245,158,11,${alpha})`;
      if (node.type === 'event') return `rgba(244,63,94,${alpha})`;
      if (selectedChip && node.name === selectedChip) return '#2563EB';
      const base = getSentimentColor(node.sentiment);
      if (alpha < 1) {
        const hex = base.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      }
      return base;
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
      const typeLabels: Record<string, { bg: string; label: string }> = {
        influencer: { bg: 'rgba(139,92,246,0.9)', label: 'Influencer' },
        narrative: { bg: 'rgba(245,158,11,0.9)', label: 'Narrative' },
        event: { bg: 'rgba(244,63,94,0.9)', label: 'Event' },
      };
      const meta = typeLabels[node.type];
      if (meta) {
        return `<div style="background:${meta.bg};color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600">${node.name}<br/><span style="font-weight:400;font-size:10px">${meta.label}</span></div>`;
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
      const typeColor = (alpha: number) => {
        if (link.type === 'correlates_with') return `rgba(37, 99, 235, ${alpha})`;
        if (link.type === 'part_of') return `rgba(245, 158, 11, ${alpha})`;
        if (link.type === 'impacts') return `rgba(244, 63, 94, ${alpha})`;
        return `rgba(139, 92, 246, ${alpha})`;
      };
      if (!neighborSet) return typeColor(isDark ? 0.35 : 0.3);
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (neighborSet.has(src) && neighborSet.has(tgt)) return typeColor(0.7);
      return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    },
    [neighborSet, isDark]
  );

  const linkWidthFn = useCallback(
    (link: NetworkLink) => {
      if (!neighborSet) return Math.max(0.8, Math.min(link.weight * 0.6, 2.5));
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      return neighborSet.has(src) && neighborSet.has(tgt)
        ? Math.max(1.2, Math.min(link.weight * 0.8, 3.5))
        : 0.3;
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
        {/* Accordion Header */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-300"
              style={{
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transitionTimingFunction: MD3_EASING,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Signal Network
            </h2>
          </div>
          {!isOpen && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {t(language, 'crypto.signalNetworkDesc')}
            </span>
          )}
        </button>

        {/* Accordion Content */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            maxHeight: isOpen ? '900px' : '0px',
            opacity: isOpen ? 1 : 0,
            transitionTimingFunction: MD3_EASING,
          }}
        >
          {/* Legend + Filter Chips */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-3">
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
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Narrative
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />
                  Event
                </span>
              </div>
            </div>
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

          {/* Graph + WHY Panel (split layout) */}
          <div className="flex flex-col md:flex-row" ref={containerRef}>
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
                    onNodeHover={((node: any) => {
                      if (hoverTipRef.current) {
                        hoverTipRef.current.style.display = node ? 'block' : 'none';
                      }
                    }) as any}
                    backgroundColor={bgColor}
                    showNavInfo={false}
                    controlType="orbit"
                    enableNodeDrag={false}
                    enableNavigationControls={true}
                    nodeRelSize={4}
                    warmupTicks={80}
                    cooldownTicks={0}
                    d3AlphaDecay={0.04}
                    d3VelocityDecay={0.3}
                  />
                  <div
                    ref={hoverTipRef}
                    className="absolute top-3 right-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-2 py-1 rounded-md border border-[var(--border)]"
                    style={{ display: 'none' }}
                  >
                    Click to view details
                  </div>
                </>
              )}
            </div>

            {/* WHY Trending Panel (right side) */}
            {selectedChip ? (
              <div
                className="border-t md:border-t-0 md:border-l border-[var(--border)]"
                style={{ width: dimensions.width - graphWidth, minHeight: dimensions.height }}
              >
                {explainLoading ? (
                  <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                ) : explainData ? (
                  <WhyTrendingPanel data={explainData} language={language} />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)] px-4 text-center">
                    {t(language, 'crypto.selectCoinHint')}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="hidden md:flex border-l border-[var(--border)] items-center justify-center"
                style={{ width: dimensions.width - graphWidth, height: dimensions.height }}
              >
                {/* Empty state only shows when no chip selected on desktop — graph takes full width */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
