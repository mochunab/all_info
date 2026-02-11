import { NextRequest, NextResponse } from 'next/server';

type DeepLRequest = {
  text: string[];
  target_lang: string;
  source_lang?: string;
};

type DeepLTranslation = {
  detected_source_language: string;
  text: string;
};

type DeepLResponse = {
  translations: DeepLTranslation[];
};

export async function POST(request: NextRequest) {
  try {
    const { texts, targetLang, sourceLang = 'KO' } = await request.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts array is required' },
        { status: 400 }
      );
    }

    if (!targetLang) {
      return NextResponse.json(
        { error: 'targetLang is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPL_API_KEY not configured' },
        { status: 500 }
      );
    }

    // DeepL Free API endpoint
    const endpoint = 'https://api-free.deepl.com/v2/translate';

    const body: DeepLRequest = {
      text: texts,
      target_lang: targetLang.toUpperCase(),
      source_lang: sourceLang.toUpperCase(),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEEPL] API error:', response.status, errorText);
      return NextResponse.json(
        { error: `DeepL API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: DeepLResponse = await response.json();

    return NextResponse.json({
      translations: data.translations.map((t) => t.text),
    });
  } catch (error) {
    console.error('[DEEPL] Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
