import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPPORTED_LANGUAGES = ['en', 'vi', 'zh', 'ja'] as const;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { post_id, target_languages } = await req.json();
  if (!post_id) {
    return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', post_id)
    .single();

  if (error || !post) {
    return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404 });
  }

  const apiKey = Deno.env.get('google_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const langs = target_languages || SUPPORTED_LANGUAGES;
  const results: Record<string, string> = {};

  for (const lang of langs) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) continue;

    const prompt = `Translate the following blog post to ${lang}. Preserve HTML structure and formatting. Return only the translated content as JSON with keys: title, description, content, tags (array).

Title: ${post.title}
Description: ${post.description}
Content: ${post.content}
Tags: ${JSON.stringify(post.tags)}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const translated = JSON.parse(text);
      const slug = `${post.slug}-${lang}`;

      await supabase.from('blog_posts').upsert({
        slug,
        title: translated.title,
        description: translated.description,
        content: translated.content,
        tags: translated.tags || post.tags,
        category: post.category,
        cover_image: post.cover_image,
        published: false,
        language: lang,
        translation_group_id: post.translation_group_id,
      }, { onConflict: 'slug' });

      results[lang] = slug;
    } catch (e) {
      results[lang] = `error: ${(e as Error).message}`;
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
