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
    const { image_prompt, width, height, aspect_ratio } = await req.json();

    if (!image_prompt) {
      return new Response(JSON.stringify({ error: 'image_prompt 필수' }), {
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

    const fullPrompt = `${image_prompt}, no text, no letters, no words, no watermark`;

    // aspect_ratio: "1:1", "4:5", "16:9", "9:16", "3:4"
    const imageConfig = {};
    if (aspect_ratio) imageConfig.aspectRatio = aspect_ratio;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
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
    for (let attempt = 0; attempt < 4; attempt++) {
      geminiRes = await fetch(url, { method: 'POST', headers, body: requestBody });
      if (geminiRes.status !== 429) break;
      const wait = (attempt + 1) * 15;
      console.log(`[generate-card-image] 429 retry ${attempt + 1}/4, waiting ${wait}s...`);
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
    const parts = data?.candidates?.[0]?.content?.parts;

    if (!parts) {
      return new Response(JSON.stringify({ error: '이미지 생성 실패: 빈 응답', debug: JSON.stringify(data).slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let imageBase64 = null;
    let mimeType = 'image/png';

    for (const part of parts) {
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
