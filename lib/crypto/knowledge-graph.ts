import type { SupabaseClient } from '@supabase/supabase-js';
import { COIN_MAP } from '@/lib/crypto/config';

// 최근 24시간 내 멘션된 코인 → 엔티티 upsert
async function upsertCoinEntities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: mentions } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count')
    .gte('created_at', since);

  if (!mentions || mentions.length === 0) return 0;

  // 코인별 총 멘션 수 집계
  const coinCounts = new Map<string, number>();
  for (const m of mentions) {
    coinCounts.set(m.coin_symbol, (coinCounts.get(m.coin_symbol) || 0) + m.mention_count);
  }

  let upserted = 0;
  for (const [symbol, count] of coinCounts) {
    const coinInfo = COIN_MAP.get(symbol);
    const { error } = await supabase
      .from('crypto_entities')
      .upsert({
        entity_type: 'coin',
        name: coinInfo?.name || symbol,
        symbol,
        mention_count: count,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'entity_type,name' });

    if (!error) upserted++;
  }

  return upserted;
}

// 고빈도 작성자 → influencer 엔티티
async function upsertInfluencerEntities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 최근 7일간 3개 이상 고점수 게시물을 작성한 저자
  const { data: authors } = await supabase
    .from('crypto_posts')
    .select('author')
    .gte('posted_at', since)
    .gte('score', 50)
    .not('author', 'is', null)
    .not('author', 'eq', '[deleted]');

  if (!authors || authors.length === 0) return 0;

  const authorCounts = new Map<string, number>();
  for (const row of authors) {
    if (row.author) {
      authorCounts.set(row.author, (authorCounts.get(row.author) || 0) + 1);
    }
  }

  let upserted = 0;
  for (const [author, count] of authorCounts) {
    if (count < 3) continue;

    const { error } = await supabase
      .from('crypto_entities')
      .upsert({
        entity_type: 'influencer',
        name: author,
        mention_count: count,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'entity_type,name' });

    if (!error) upserted++;
  }

  return upserted;
}

// 같은 게시물에 동시 언급된 코인 쌍 → correlates_with 관계
async function updateCoinCorrelations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 게시물별 멘션된 코인 심볼 그룹
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

  // 코인 쌍별 동시 출현 횟수
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

    // 엔티티 ID 조회
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

    // 기존 관계 확인 후 upsert
    const { data: existing } = await supabase
      .from('crypto_relations')
      .select('id')
      .eq('source_entity_id', entityA.id)
      .eq('target_entity_id', entityB.id)
      .eq('relation_type', 'correlates_with')
      .single();

    if (existing) {
      await supabase
        .from('crypto_relations')
        .update({ weight: count, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('crypto_relations')
        .insert({
          source_entity_id: entityA.id,
          target_entity_id: entityB.id,
          relation_type: 'correlates_with',
          weight: count,
          context: `${count}개 게시물에서 동시 언급`,
        });
    }
    created++;
  }

  return created;
}

// influencer → coin 관계: 고점수 게시물에서 코인을 언급한 경우
async function updateInfluencerRelations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: highScorePosts } = await supabase
    .from('crypto_posts')
    .select('id, author, score')
    .gte('posted_at', since)
    .gte('score', 100)
    .not('author', 'is', null)
    .not('author', 'eq', '[deleted]');

  if (!highScorePosts || highScorePosts.length === 0) return 0;

  let created = 0;
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

    for (const mention of mentions) {
      const { data: coinEntity } = await supabase
        .from('crypto_entities')
        .select('id')
        .eq('entity_type', 'coin')
        .eq('symbol', mention.coin_symbol)
        .single();

      if (!coinEntity) continue;

      const { data: existing } = await supabase
        .from('crypto_relations')
        .select('id, weight')
        .eq('source_entity_id', influencer.id)
        .eq('target_entity_id', coinEntity.id)
        .eq('relation_type', 'mentions')
        .single();

      if (existing) {
        await supabase
          .from('crypto_relations')
          .update({ weight: (existing.weight || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('crypto_relations')
          .insert({
            source_entity_id: influencer.id,
            target_entity_id: coinEntity.id,
            relation_type: 'mentions',
            weight: 1,
            context: `u/${post.author} (score: ${post.score})`,
          });
        created++;
      }
    }
  }

  return created;
}

export async function updateKnowledgeGraph(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<void> {
  const coinCount = await upsertCoinEntities(supabase);
  console.log(`   🪙 코인 엔티티: ${coinCount}개 upsert`);

  const influencerCount = await upsertInfluencerEntities(supabase);
  console.log(`   👤 인플루언서 엔티티: ${influencerCount}개 upsert`);

  const correlations = await updateCoinCorrelations(supabase);
  console.log(`   🔗 코인 상관관계: ${correlations}개`);

  const influencerRels = await updateInfluencerRelations(supabase);
  console.log(`   📝 인플루언서 관계: ${influencerRels}개`);
}
