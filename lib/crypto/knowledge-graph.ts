import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntityType, RelationType } from '@/types/crypto';
import {
  COIN_MAP,
  META_EDGES,
  NARRATIVE_CLUSTERS,
  EVENT_KEYWORDS,
  RELATION_DECAY_DAYS,
  ENTITY_DECAY_DAYS,
} from '@/lib/crypto/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any>;

// ── Step 1: 메타엣지 검증 ──

function validateRelation(
  sourceType: EntityType,
  targetType: EntityType,
  relationType: RelationType
): boolean {
  const rule = META_EDGES[relationType];
  if (!rule) return false;
  return rule.source === sourceType && rule.target === targetType;
}

// ── Step 4: Active Metadata 생성 ──

function buildQualityMetadata(opts: {
  sourceCount?: number;
  confidence?: number;
  mentionCount?: number;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    confidence: opts.confidence ?? (opts.mentionCount && opts.mentionCount >= 5 ? 0.9 : opts.mentionCount && opts.mentionCount >= 2 ? 0.6 : 0.3),
    source_count: opts.sourceCount ?? 1,
    last_validated_at: now,
  };
}

// ── 엔티티 upsert 헬퍼 ──

async function upsertEntity(
  supabase: SB,
  entityType: EntityType,
  name: string,
  mentionCount: number,
  extra: { symbol?: string; metadata?: Record<string, unknown> } = {}
): Promise<string | null> {
  const { data, error } = await supabase
    .from('crypto_entities')
    .upsert({
      entity_type: entityType,
      name,
      symbol: extra.symbol,
      mention_count: mentionCount,
      metadata: extra.metadata || buildQualityMetadata({ mentionCount }),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'entity_type,name' })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id;
}

// ── 관계 upsert 헬퍼 (메타엣지 검증 포함) ──

async function upsertRelation(
  supabase: SB,
  sourceId: string,
  targetId: string,
  sourceType: EntityType,
  targetType: EntityType,
  relationType: RelationType,
  weight: number,
  context?: string
): Promise<boolean> {
  if (!validateRelation(sourceType, targetType, relationType)) {
    console.warn(`   ⚠️  메타엣지 규칙 위반: ${sourceType}→${targetType} (${relationType})`);
    return false;
  }

  const { data: existing } = await supabase
    .from('crypto_relations')
    .select('id, weight')
    .eq('source_entity_id', sourceId)
    .eq('target_entity_id', targetId)
    .eq('relation_type', relationType)
    .single();

  if (existing) {
    await supabase
      .from('crypto_relations')
      .update({ weight, context, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('crypto_relations')
      .insert({
        source_entity_id: sourceId,
        target_entity_id: targetId,
        relation_type: relationType,
        weight,
        context,
      });
  }
  return true;
}

// ── 코인 엔티티 (기존 + Active Metadata 추가) ──

async function upsertCoinEntities(supabase: SB): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: mentions } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count, post_id')
    .gte('created_at', since);

  if (!mentions || mentions.length === 0) return 0;

  const coinCounts = new Map<string, number>();
  const coinSources = new Map<string, Set<string>>();

  for (const m of mentions) {
    coinCounts.set(m.coin_symbol, (coinCounts.get(m.coin_symbol) || 0) + m.mention_count);
    if (!coinSources.has(m.coin_symbol)) coinSources.set(m.coin_symbol, new Set());
    coinSources.get(m.coin_symbol)!.add(m.post_id);
  }

  // 소스 다양성 확인 (reddit/telegram/threads)
  const postIds = [...new Set(mentions.map((m: { post_id: string }) => m.post_id))];
  const { data: posts } = await supabase
    .from('crypto_posts')
    .select('id, source')
    .in('id', postIds.slice(0, 500));

  const postSourceMap = new Map<string, string>();
  for (const p of posts || []) {
    postSourceMap.set(p.id, p.source);
  }

  let upserted = 0;
  for (const [symbol, count] of coinCounts) {
    const coinInfo = COIN_MAP.get(symbol);
    const postIdsForCoin = coinSources.get(symbol) || new Set();
    const sources = new Set<string>();
    for (const pid of postIdsForCoin) {
      const src = postSourceMap.get(pid);
      if (src) sources.add(src);
    }

    const id = await upsertEntity(supabase, 'coin', coinInfo?.name || symbol, count, {
      symbol,
      metadata: buildQualityMetadata({
        mentionCount: count,
        sourceCount: sources.size,
        confidence: Math.min(0.3 + (count / 10) * 0.3 + sources.size * 0.2, 1.0),
      }),
    });

    if (id) upserted++;
  }

  return upserted;
}

// ── 인플루언서 엔티티 (기존 + Active Metadata 추가) ──

async function upsertInfluencerEntities(supabase: SB): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: authors } = await supabase
    .from('crypto_posts')
    .select('author, source')
    .gte('posted_at', since)
    .gte('score', 50)
    .not('author', 'is', null)
    .not('author', 'eq', '[deleted]');

  if (!authors || authors.length === 0) return 0;

  const authorCounts = new Map<string, number>();
  const authorSources = new Map<string, Set<string>>();
  for (const row of authors) {
    if (!row.author) continue;
    authorCounts.set(row.author, (authorCounts.get(row.author) || 0) + 1);
    if (!authorSources.has(row.author)) authorSources.set(row.author, new Set());
    authorSources.get(row.author)!.add(row.source || 'reddit');
  }

  let upserted = 0;
  for (const [author, count] of authorCounts) {
    if (count < 3) continue;
    const sources = authorSources.get(author) || new Set();

    const id = await upsertEntity(supabase, 'influencer', author, count, {
      metadata: buildQualityMetadata({
        mentionCount: count,
        sourceCount: sources.size,
        confidence: Math.min(0.4 + (count / 10) * 0.3 + sources.size * 0.15, 1.0),
      }),
    });

    if (id) upserted++;
  }

  return upserted;
}

// ── Step 3: 내러티브 엔티티 자동 생성 ──

async function upsertNarrativeEntities(supabase: SB): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: mentions } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol')
    .gte('created_at', since);

  if (!mentions || mentions.length === 0) return 0;

  const activeCoins = new Set(mentions.map((m: { coin_symbol: string }) => m.coin_symbol));
  let created = 0;

  // LLM 감지 내러티브 우선: crypto_sentiments.metadata.narratives 집계
  const { data: sentimentsWithNarratives } = await supabase
    .from('crypto_sentiments')
    .select('metadata, mentioned_coins')
    .gte('created_at', since)
    .not('metadata', 'is', null);

  const llmNarrativeCoinMap = new Map<string, Set<string>>();
  for (const s of sentimentsWithNarratives || []) {
    const meta = s.metadata as Record<string, unknown> | null;
    const narratives = meta?.narratives as string[] | undefined;
    if (!narratives || narratives.length === 0) continue;
    const coins = (s.mentioned_coins as string[]) || [];
    for (const narrative of narratives) {
      const key = narrative.trim();
      if (!key) continue;
      if (!llmNarrativeCoinMap.has(key)) llmNarrativeCoinMap.set(key, new Set());
      for (const coin of coins) {
        llmNarrativeCoinMap.get(key)!.add(coin.toUpperCase());
      }
    }
  }

  // LLM 내러티브: 2회+ 등장 시 엔티티 생성
  for (const [narrativeName, coins] of llmNarrativeCoinMap) {
    if (coins.size < 2) continue;
    const activeInNarrative = [...coins].filter((c) => activeCoins.has(c));
    if (activeInNarrative.length < 2) continue;

    const narrativeId = await upsertEntity(supabase, 'narrative', narrativeName, activeInNarrative.length, {
      metadata: {
        ...buildQualityMetadata({
          mentionCount: activeInNarrative.length,
          confidence: Math.min(0.6 + activeInNarrative.length * 0.1, 1.0),
        }),
        active_coins: activeInNarrative,
        source: 'llm',
      },
    });

    if (!narrativeId) continue;
    created++;

    for (const coinSymbol of activeInNarrative) {
      const coinInfo = COIN_MAP.get(coinSymbol);
      const { data: coinEntity } = await supabase
        .from('crypto_entities')
        .select('id')
        .eq('entity_type', 'coin')
        .eq('symbol', coinSymbol)
        .single();

      if (!coinEntity) continue;

      await upsertRelation(
        supabase, coinEntity.id, narrativeId,
        'coin', 'narrative', 'part_of', 1,
        `${coinInfo?.name || coinSymbol} → ${narrativeName} (LLM)`
      );
    }
  }

  // 하드코딩 fallback: LLM에서 못 잡은 클러스터
  const llmNarrativeNames = new Set(llmNarrativeCoinMap.keys());
  for (const cluster of NARRATIVE_CLUSTERS) {
    if (llmNarrativeNames.has(cluster.name)) continue;

    const activeInCluster = cluster.coins.filter((c) => activeCoins.has(c));
    if (activeInCluster.length < 2) continue;

    const narrativeId = await upsertEntity(supabase, 'narrative', cluster.name, activeInCluster.length, {
      metadata: {
        ...buildQualityMetadata({
          mentionCount: activeInCluster.length,
          confidence: Math.min(0.5 + activeInCluster.length * 0.1, 1.0),
        }),
        active_coins: activeInCluster,
        source: 'hardcoded',
      },
    });

    if (!narrativeId) continue;
    created++;

    for (const coinSymbol of activeInCluster) {
      const coinInfo = COIN_MAP.get(coinSymbol);
      const { data: coinEntity } = await supabase
        .from('crypto_entities')
        .select('id')
        .eq('entity_type', 'coin')
        .eq('symbol', coinSymbol)
        .single();

      if (!coinEntity) continue;

      await upsertRelation(
        supabase, coinEntity.id, narrativeId,
        'coin', 'narrative', 'part_of', 1,
        `${coinInfo?.name || coinSymbol} → ${cluster.name}`
      );
    }
  }

  return created;
}

// ── Step 5: 이벤트 엔티티 자동 생성 ──

async function upsertEventEntities(supabase: SB): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sentiments } = await supabase
    .from('crypto_sentiments')
    .select('post_id, key_phrases, mentioned_coins, metadata')
    .gte('created_at', since);

  if (!sentiments || sentiments.length === 0) return 0;

  type EventInfo = { coins: Set<string>; impact: string; source: string };
  const eventMap = new Map<string, EventInfo>();

  // LLM 감지 이벤트 우선
  for (const s of sentiments) {
    const meta = s.metadata as Record<string, unknown> | null;
    const llmEvents = meta?.events as { name: string; coins: string[]; impact: string }[] | undefined;
    if (llmEvents && llmEvents.length > 0) {
      for (const evt of llmEvents) {
        const name = evt.name?.trim();
        if (!name) continue;
        if (!eventMap.has(name)) eventMap.set(name, { coins: new Set(), impact: evt.impact || 'neutral', source: 'llm' });
        const entry = eventMap.get(name)!;
        for (const coin of evt.coins || []) entry.coins.add(coin.toUpperCase());
        for (const coin of (s.mentioned_coins as string[]) || []) entry.coins.add(coin.toUpperCase());
      }
      continue;
    }

    // 키워드 매칭 fallback
    if (!s.key_phrases || !s.mentioned_coins) continue;
    for (const phrase of s.key_phrases as string[]) {
      const lower = phrase.toLowerCase();
      for (const keyword of EVENT_KEYWORDS) {
        if (lower.includes(keyword)) {
          const eventName = phrase.trim();
          if (!eventMap.has(eventName)) eventMap.set(eventName, { coins: new Set(), impact: 'neutral', source: 'keyword' });
          const entry = eventMap.get(eventName)!;
          for (const coin of s.mentioned_coins as string[]) entry.coins.add(coin.toUpperCase());
          break;
        }
      }
    }
  }

  let created = 0;
  for (const [eventName, info] of eventMap) {
    if (info.coins.size === 0) continue;

    const eventId = await upsertEntity(supabase, 'event', eventName, info.coins.size, {
      metadata: {
        ...buildQualityMetadata({
          mentionCount: info.coins.size,
          confidence: info.source === 'llm' ? 0.75 : 0.6,
        }),
        affected_coins: [...info.coins],
        impact: info.impact,
        source: info.source,
      },
    });

    if (!eventId) continue;
    created++;

    for (const coinSymbol of info.coins) {
      const { data: coinEntity } = await supabase
        .from('crypto_entities')
        .select('id')
        .eq('entity_type', 'coin')
        .eq('symbol', coinSymbol)
        .single();

      if (!coinEntity) continue;

      await upsertRelation(
        supabase, eventId, coinEntity.id,
        'event', 'coin', 'impacts', 1,
        `${eventName} → ${coinSymbol} (${info.impact})`
      );
    }
  }

  return created;
}

// ── 코인 상관관계 (기존, 메타엣지 검증 적용) ──

async function updateCoinCorrelations(supabase: SB): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: mentions } = await supabase
    .from('crypto_mentions')
    .select('post_id, coin_symbol')
    .gte('created_at', since);

  if (!mentions || mentions.length === 0) return 0;

  const postCoins = new Map<string, Set<string>>();
  for (const m of mentions) {
    if (!postCoins.has(m.post_id)) postCoins.set(m.post_id, new Set());
    postCoins.get(m.post_id)!.add(m.coin_symbol);
  }

  const pairCounts = new Map<string, number>();
  for (const coins of postCoins.values()) {
    if (coins.size < 2) continue;
    const arr = [...coins].sort();
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = `${arr[i]}:${arr[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  let created = 0;
  for (const [key, count] of pairCounts) {
    if (count < 3) continue;

    const [symA, symB] = key.split(':');

    const { data: entityA } = await supabase
      .from('crypto_entities')
      .select('id')
      .eq('entity_type', 'coin')
      .eq('symbol', symA)
      .single();

    const { data: entityB } = await supabase
      .from('crypto_entities')
      .select('id')
      .eq('entity_type', 'coin')
      .eq('symbol', symB)
      .single();

    if (!entityA || !entityB) continue;

    const ok = await upsertRelation(
      supabase, entityA.id, entityB.id,
      'coin', 'coin', 'correlates_with', count,
      `${count}개 게시물에서 동시 언급`
    );
    if (ok) created++;
  }

  return created;
}

// ── 인플루언서→코인 관계 (기존, 메타엣지 검증 적용) ──

async function updateInfluencerRelations(supabase: SB): Promise<{ mentions: number; recommends: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: highScorePosts } = await supabase
    .from('crypto_posts')
    .select('id, author, score')
    .gte('posted_at', since)
    .gte('score', 100)
    .not('author', 'is', null)
    .not('author', 'eq', '[deleted]');

  if (!highScorePosts || highScorePosts.length === 0) return { mentions: 0, recommends: 0 };

  const postIds = highScorePosts.map((p) => p.id);
  const { data: sentiments } = await supabase
    .from('crypto_sentiments')
    .select('post_id, sentiment_label, confidence')
    .in('post_id', postIds);

  const sentimentMap = new Map<string, { sentiment_label: string; confidence: number }>();
  for (const s of sentiments || []) {
    sentimentMap.set(s.post_id, s);
  }

  let mentionCount = 0;
  let recommendCount = 0;

  for (const post of highScorePosts) {
    const { data: mentions } = await supabase
      .from('crypto_mentions')
      .select('coin_symbol')
      .eq('post_id', post.id);

    if (!mentions || mentions.length === 0) continue;

    const { data: influencer } = await supabase
      .from('crypto_entities')
      .select('id')
      .eq('entity_type', 'influencer')
      .eq('name', post.author)
      .single();

    if (!influencer) continue;

    const sentiment = sentimentMap.get(post.id);

    for (const mention of mentions) {
      const { data: coinEntity } = await supabase
        .from('crypto_entities')
        .select('id')
        .eq('entity_type', 'coin')
        .eq('symbol', mention.coin_symbol)
        .single();

      if (!coinEntity) continue;

      const ok = await upsertRelation(
        supabase, influencer.id, coinEntity.id,
        'influencer', 'coin', 'mentions', 1,
        `u/${post.author} (score: ${post.score})`
      );
      if (ok) mentionCount++;

      if (
        sentiment &&
        sentiment.sentiment_label === 'bullish' &&
        sentiment.confidence > 0.7 &&
        post.score >= 100
      ) {
        const recOk = await upsertRelation(
          supabase, influencer.id, coinEntity.id,
          'influencer', 'coin', 'recommends', post.score / 100,
          `u/${post.author} bullish (confidence: ${sentiment.confidence}, score: ${post.score})`
        );
        if (recOk) recommendCount++;
      }
    }
  }

  return { mentions: mentionCount, recommends: recommendCount };
}

// ── Step 2: 관계 weight 감쇠 (Temporal Decay) ──

async function decayStaleRelations(supabase: SB): Promise<number> {
  const staleThreshold = new Date(Date.now() - RELATION_DECAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('crypto_relations')
    .update({ weight: 0 })
    .lt('updated_at', staleThreshold)
    .gt('weight', 0)
    .select('id');

  if (error) {
    console.warn('   ⚠️  관계 감쇠 오류:', error.message);
    return 0;
  }

  return data?.length || 0;
}

async function decayStaleEntities(supabase: SB): Promise<number> {
  const staleThreshold = new Date(Date.now() - ENTITY_DECAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleEntities, error: fetchErr } = await supabase
    .from('crypto_entities')
    .select('id, metadata, last_seen_at')
    .lt('last_seen_at', staleThreshold)
    .in('entity_type', ['event', 'narrative']);

  if (fetchErr || !staleEntities || staleEntities.length === 0) {
    if (fetchErr) console.warn('   ⚠️  엔티티 감쇠 오류:', fetchErr.message);
    return 0;
  }

  const now = Date.now();
  let decayed = 0;

  for (const entity of staleEntities) {
    const daysSinceLastSeen = (now - new Date(entity.last_seen_at).getTime()) / (1000 * 60 * 60 * 24);
    const daysOverThreshold = daysSinceLastSeen - ENTITY_DECAY_DAYS;
    if (daysOverThreshold <= 0) continue;

    const originalConfidence = (entity.metadata as Record<string, unknown>)?.confidence as number || 0.6;
    const newConfidence = Math.max(0.05, originalConfidence * Math.pow(0.85, daysOverThreshold));

    const { error } = await supabase
      .from('crypto_entities')
      .update({
        metadata: {
          ...(entity.metadata as Record<string, unknown>),
          confidence: Math.round(newConfidence * 1000) / 1000,
          decayed: newConfidence < 0.15,
          last_validated_at: new Date().toISOString(),
        },
      })
      .eq('id', entity.id);

    if (!error) decayed++;
  }

  return decayed;
}

// ── 메인 오케스트레이터 ──

export async function updateKnowledgeGraph(supabase: SB): Promise<void> {
  // Step 2: 감쇠 먼저 실행
  const decayedRels = await decayStaleRelations(supabase);
  const decayedEnts = await decayStaleEntities(supabase);
  console.log(`   🕐 감쇠: 관계 ${decayedRels}개, 엔티티 ${decayedEnts}개`);

  // 기존 엔티티 (Step 4: Active Metadata 포함)
  const coinCount = await upsertCoinEntities(supabase);
  console.log(`   🪙 코인 엔티티: ${coinCount}개 upsert`);

  const influencerCount = await upsertInfluencerEntities(supabase);
  console.log(`   👤 인플루언서 엔티티: ${influencerCount}개 upsert`);

  // Step 3: 내러티브 엔티티
  const narrativeCount = await upsertNarrativeEntities(supabase);
  console.log(`   📊 내러티브 엔티티: ${narrativeCount}개 upsert`);

  // Step 5: 이벤트 엔티티
  const eventCount = await upsertEventEntities(supabase);
  console.log(`   ⚡ 이벤트 엔티티: ${eventCount}개 upsert`);

  // 관계 (Step 1: 메타엣지 검증 포함)
  const correlations = await updateCoinCorrelations(supabase);
  console.log(`   🔗 코인 상관관계: ${correlations}개`);

  const influencerRels = await updateInfluencerRelations(supabase);
  console.log(`   📝 인플루언서 관계: mentions ${influencerRels.mentions}개, recommends ${influencerRels.recommends}개`);
}
