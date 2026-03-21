'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import type { CryptoSignal, TrendingExplainResponse, TimeWindow } from '@/types/crypto';
import { useIsDark } from '@/lib/hooks/useIsDark';
import { t } from '@/lib/i18n';
import TimeWindowSelector from '@/components/crypto/TimeWindowSelector';
import WhyTrendingPanel from '@/components/crypto/WhyTrendingPanel';

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
  signalType?: 'fomo' | 'fud';
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

export default function SignalNetwork({ signals, onCoinSelect, language = 'ko', signalType = 'fomo' }: SignalNetworkProps) {
  const isDark = useIsDark();
  const [isOpen, setIsOpen] = useState(false);
  const [ForceGraph3D, setForceGraph3D] = useState<any>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [ownSignals, setOwnSignals] = useState<CryptoSignal[]>(signals);

  useEffect(() => {
    import('react-force-graph-3d').then(mod => setForceGraph3D(() => mod.default));
  }, []);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const graphRef = useRef<any>(null);
  const hoverTipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420, mobile: false });

  // WHY panel state
  const [explainData, setExplainData] = useState<TrendingExplainResponse | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const explainCache = useRef<Map<string, TrendingExplainResponse>>(new Map());

  const fetchOwnSignals = useCallback(async (tw: TimeWindow) => {
    try {
      const res = await fetch(`/api/crypto/signals?window=${tw}&signal_type=${signalType}&limit=100`);
      const data = await res.json();
      setOwnSignals(data.signals || []);
    } catch { /* silent */ }
  }, [signalType]);

  const topCoins = useMemo(() => ownSignals.slice(0, 8), [ownSignals]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const mob = w < 640;
      setDimensions({ width: Math.max(300, w), height: mob ? 300 : 420, mobile: mob });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Custom lighting — replace default lights with prettier ones
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || nodes.length === 0) return;
    try {
      const scene = fg.scene();
      const existingLights = scene.children.filter(
        (c: THREE.Object3D) => c instanceof THREE.Light
      );
      existingLights.forEach((l: THREE.Object3D) => scene.remove(l));

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
      dir1.position.set(100, 200, 150);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xe8eaf6, 0.3);
      dir2.position.set(-100, -50, -100);
      scene.add(dir2);
      const point = new THREE.PointLight(0xdbeafe, 0.4, 500);
      point.position.set(0, 0, 0);
      scene.add(point);
    } catch { /* scene not ready */ }
  }, [nodes]);

  // D3 force config + camera auto-fit
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || nodes.length === 0) return;

    fg.d3Force('charge')?.strength(-300);
    fg.d3Force('link')?.distance(60);
    fg.d3Force('center')?.strength(2);

    fg.cameraPosition({ x: 0, y: 0, z: 120 });
    const zoomFit = () => {
      try { fg.zoomToFit(600, 10); } catch { /* ignore */ }
    };
    const t1 = setTimeout(zoomFit, 500);
    const t2 = setTimeout(zoomFit, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [nodes]);

  const fetchNetwork = useCallback(async (coin?: string) => {
    setLoading(true);
    try {
      const base = coin
        ? `/api/crypto/network?coin=${coin}&limit=30`
        : '/api/crypto/network?limit=30';
      const url = `${base}&window=${timeWindow}&signal_type=${signalType}`;
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

      setNodes(connected);
      setLinks(rawLinks);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [timeWindow, signalType]);

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
    const cacheKey = `${coin}-${timeWindow}-${signalType}`;
    const cached = explainCache.current.get(cacheKey);
    if (cached) {
      setExplainData(cached);
      return;
    }
    setExplainLoading(true);
    try {
      const res = await fetch(`/api/crypto/trending-explain?coin=${coin}&window=${timeWindow}&signal_type=${signalType}`);
      if (res.ok) {
        const data: TrendingExplainResponse = await res.json();
        explainCache.current.set(cacheKey, data);
        setExplainData(data);
      } else {
        setExplainData(null);
      }
    } catch {
      setExplainData(null);
    } finally {
      setExplainLoading(false);
    }
  }, [timeWindow, signalType]);

  const handleTimeWindowChange = useCallback((tw: TimeWindow) => {
    setTimeWindow(tw);
  }, []);

  // 시간 윈도우 또는 시그널 타입 변경 시 자체 시그널 재조회
  useEffect(() => {
    if (!isOpen) return;
    fetchOwnSignals(timeWindow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, signalType]);

  // ownSignals 갱신 후 첫 번째 코인 자동 선택
  useEffect(() => {
    if (!isOpen || topCoins.length === 0) return;
    const first = topCoins[0].coin_symbol;
    setSelectedChip(first);
    fetchNetwork(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownSignals]);

  // selectedChip 변경 시 explain 재조회
  useEffect(() => {
    if (selectedChip) fetchExplain(selectedChip);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChip, timeWindow]);

  const handleChipClick = useCallback(
    (symbol: string) => {
      const next = selectedChip === symbol ? null : symbol;
      setSelectedChip(next);
      if (next) {
        fetchNetwork(next);
        fetchExplain(next);
      } else {
        setExplainData(null);
        fetchNetwork();
      }
    },
    [selectedChip, fetchExplain, fetchNetwork]
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

  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  const focusNeighborSet = useMemo(() => {
    if (!focusedNode) return null;
    const node = nodes.find((n) => n.id === focusedNode);
    if (!node) return null;
    const ids = new Set<string>([node.id]);
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : l.source.id;
      const tgt = typeof l.target === 'string' ? l.target : l.target.id;
      if (src === node.id) ids.add(tgt);
      if (tgt === node.id) ids.add(src);
    }
    return ids;
  }, [focusedNode, nodes, links]);

  const activeNeighborSet = focusNeighborSet || neighborSet;

  const isMobile = dimensions.mobile;

  const graphWidth = useMemo(() => {
    if (isMobile) return dimensions.width;
    if (selectedChip) return Math.floor(dimensions.width * 0.6);
    return dimensions.width;
  }, [selectedChip, dimensions.width, isMobile]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || nodes.length === 0) return;
    const t = setTimeout(() => { try { fg.zoomToFit(300, 10); } catch {} }, 100);
    return () => clearTimeout(t);
  }, [graphWidth, nodes.length]);

  const bgColor = useMemo(() => isDark ? '#111827' : '#FAFAFA', [isDark]);

  const getNodeColor = useCallback(
    (node: NetworkNode): string => {
      if (node.type === 'influencer') return '#8B5CF6';
      if (node.type === 'narrative') return '#F59E0B';
      if (node.type === 'event') return '#F43F5E';
      return getSentimentColor(node.sentiment);
    },
    []
  );

  const nodeThreeObject = useCallback(
    (node: NetworkNode) => {
      const group = new THREE.Group();
      const baseSize = getNodeSize(node.mentions, maxMentions);
      const radius = baseSize * 0.8;
      const hexColor = getNodeColor(node);
      const color = new THREE.Color(hexColor);

      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color,
        shininess: 80,
        specular: new THREE.Color(0xffffff),
        emissive: color.clone().multiplyScalar(0.15),
        transparent: true,
        opacity: 0.92,
      });
      group.add(new THREE.Mesh(geometry, material));

      const glowGeometry = new THREE.SphereGeometry(radius * 1.3, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.06,
      });
      group.add(new THREE.Mesh(glowGeometry, glowMaterial));

      if (node.type === 'coin') {
        const label = node.name.length > 8 ? node.name.slice(0, 7) + '..' : node.name;
        const sprite = new SpriteText(label, 1.8, isDark ? '#E5E7EB' : '#374151');
        sprite.fontWeight = '600';
        sprite.backgroundColor = isDark ? 'rgba(17,24,39,0.75)' : 'rgba(255,255,255,0.75)';
        sprite.borderRadius = 3;
        sprite.padding = [1.5, 3] as any;
        (sprite as any).position.set(0, -(radius + 2.5), 0);
        group.add(sprite as any);
      }

      return group;
    },
    [maxMentions, getNodeColor, isDark]
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
        if (link.type === 'recommends') return `rgba(34, 197, 94, ${alpha})`;
        return `rgba(139, 92, 246, ${alpha})`;
      };
      if (!activeNeighborSet) return typeColor(isDark ? 0.35 : 0.3);
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (activeNeighborSet.has(src) && activeNeighborSet.has(tgt)) return typeColor(0.7);
      return isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    },
    [activeNeighborSet, isDark]
  );

  const linkWidthFn = useCallback(
    (link: NetworkLink) => {
      if (!activeNeighborSet) return Math.max(0.8, Math.min(link.weight * 0.6, 2.5));
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      return activeNeighborSet.has(src) && activeNeighborSet.has(tgt)
        ? Math.max(1.2, Math.min(link.weight * 0.8, 3.5))
        : 0.3;
    },
    [activeNeighborSet]
  );

  const handleNodeClick = useCallback(
    (node: NetworkNode) => {
      if (node.type === 'coin') {
        setFocusedNode(null);
        onCoinSelect(node.name);
      } else {
        setFocusedNode((prev) => (prev === node.id ? null : node.id));
      }
    },
    [onCoinSelect]
  );

  if (signals.length === 0) return null;

  return (
    <div className="mb-3">
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
          className="transition-all duration-300"
          style={{
            maxHeight: isOpen ? '80vh' : '0px',
            opacity: isOpen ? 1 : 0,
            overflow: isOpen ? 'auto' : 'hidden',
            transitionTimingFunction: MD3_EASING,
          }}
        >
          {/* Filter Chips + Time Window */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-2">
                {topCoins.map((s) => (
                  <button
                    key={s.coin_symbol}
                    onClick={() => handleChipClick(s.coin_symbol)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                      selectedChip === s.coin_symbol
                        ? 'bg-[var(--accent)] text-white shadow-sm shadow-blue-500/15'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {s.coin_symbol}
                  </button>
                ))}
              </div>
              <TimeWindowSelector selected={timeWindow} onChange={handleTimeWindowChange} language={language} />
            </div>
          </div>

          {/* Graph + WHY Panel (split layout) */}
          <div className="flex flex-col md:flex-row" ref={containerRef}>
            {/* 3D Force Graph */}
            <div className="relative" style={{ width: graphWidth, height: dimensions.height }}>
              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-primary)]/80 backdrop-blur-sm rounded-md px-2 py-1.5">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Bullish</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-400 inline-block" /> Neutral</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Bearish</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500 inline-block" style={{ transform: 'rotate(45deg)', width: 7, height: 7 }} /> Influencer</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Narrative</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> Event</span>
              </div>
              {!ForceGraph3D || (loading && nodes.length === 0) ? (
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
                    ref={graphRef as any}
                    width={graphWidth}
                    height={dimensions.height}
                    graphData={{ nodes, links }}
                    nodeThreeObject={nodeThreeObject as any}
                    nodeLabel={nodeLabel as any}
                    nodeOpacity={1}
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
                    warmupTicks={150}
                    cooldownTicks={0}
                    d3AlphaDecay={0.04}
                    d3VelocityDecay={0.3}
                    onEngineStop={() => {
                      const fg = graphRef.current;
                      if (fg) setTimeout(() => { try { fg.zoomToFit(600, 10); } catch {} }, 200);
                    }}
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

            {/* WHY Trending Panel (right side / below on mobile) */}
            {selectedChip ? (
              <div
                className="border-t md:border-t-0 md:border-l border-[var(--border)]"
                style={{ width: isMobile ? '100%' : dimensions.width - graphWidth, minHeight: isMobile ? 'auto' : dimensions.height }}
              >
                {explainLoading ? (
                  <div className="flex items-center justify-center py-8 md:h-full text-sm text-[var(--text-tertiary)]">
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                ) : explainData ? (
                  <WhyTrendingPanel data={explainData} language={language} isMobile={isMobile} />
                ) : (
                  <div className="flex items-center justify-center py-8 md:h-full text-xs text-[var(--text-tertiary)] px-4 text-center">
                    {t(language, 'crypto.selectCoinHint')}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="hidden md:flex border-l border-[var(--border)] items-center justify-center"
                style={{ width: dimensions.width - graphWidth, height: dimensions.height }}
              >
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
