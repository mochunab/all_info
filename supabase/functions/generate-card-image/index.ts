// @ts-nocheck
// Supabase Edge Function: 카드뉴스 배경 이미지 생성 (Gemini Image Generation)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_prompt, width, height, aspect_ratio, reference_image, slide_context } = await req.json();

    if (!image_prompt && !slide_context) {
      return new Response(JSON.stringify({ error: 'image_prompt 또는 slide_context 필수' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('google_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'google_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalPrompt = image_prompt;

    // slide_context가 있으면 새로운 이미지 컨셉을 직접 구상
    if (slide_context) {
      const { headline, body, type, topic } = slide_context;
      const typeGuide = type === 'cover'
        ? 'This is a COVER slide — create the most impactful, curiosity-provoking hero image that captures the core theme in one powerful scene.'
        : type === 'cta'
        ? 'This is a CTA (call-to-action) slide — create a warm, inviting, or empowering image that encourages engagement.'
        : 'This is a CONTENT slide — create an image that visually represents the key message of this specific point.';

      finalPrompt = `You are a creative director for social media card news. Generate a background image that looks like real editorial photography.

Topic: "${topic}"
Slide headline: "${headline}"
${body ? `Slide body: "${body}"` : ''}
${typeGuide}

Requirements:
- Focus on a specific, grounded scene with real people, objects, or spaces — NOT abstract or futuristic visuals
- NO text, NO letters, NO words, NO watermarks

Anti-AI style guide (CRITICAL):
- NO robot hands, holograms, neon circuits, floating icons, glowing orbs — these are AI clichés
- All objects must be grounded (on tables, floors, hands) — NEVER floating in mid-air
- Avoid heavy purple+blue neon combos. Use desaturated tones and natural textures instead
- Lighting: use "ambient lighting", "soft glow", "backlight" — NOT "glowing", "magic sparkles"
- Background: use "depth of field", "blurred background" — NOT "mystical", "cosmic"
- Style: editorial photography, natural lighting, subtle film grain, shot on real camera feel
- Overall: the image should be indistinguishable from a real photograph or tasteful illustration`;
    }

    const imageConfig = {};
    if (aspect_ratio) imageConfig.aspectRatio = aspect_ratio;

    const parts = [];

    if (reference_image) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: reference_image,
        },
      });
      parts.push({
        text: `Use the attached image as a style/tone reference. Generate a NEW image with the same visual style, color palette, lighting, and mood. ${finalPrompt}, no text, no letters, no words, no watermark`,
      });
    } else {
      const antiAiSuffix = ', editorial photography style, natural lighting, grounded objects, no floating elements, no neon glow, no robot hands, subtle film grain, no text, no letters, no words, no watermark';
      parts.push({ text: slide_context ? finalPrompt : `${finalPrompt}${antiAiSuffix}` });
    }

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
      },
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`;
    const headers = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    };

    let geminiRes;
    for (let attempt = 0; attempt < 3; attempt++) {
      geminiRes = await fetch(url, { method: 'POST', headers, body: requestBody });
      if (geminiRes.status !== 429) break;
      const wait = (attempt + 1) * 10;
      console.log(`[generate-card-image] 429 retry ${attempt + 1}/3, waiting ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-card-image] Gemini error:', geminiRes.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: `Gemini API 오류: ${geminiRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiRes.json();
    console.log('[generate-card-image] Response:', JSON.stringify(data).slice(0, 500));
    const responseParts = data?.candidates?.[0]?.content?.parts;

    if (!responseParts) {
      return new Response(JSON.stringify({ error: '이미지 생성 실패: 빈 응답', debug: JSON.stringify(data).slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let imageBase64 = null;
    let mimeType = 'image/png';

    for (const part of responseParts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
        break;
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: '이미지 데이터가 없습니다' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ image: imageBase64, mimeType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-card-image] Error:', err);
    return new Response(JSON.stringify({ error: `이미지 생성 실패: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
