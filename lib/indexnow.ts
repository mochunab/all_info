const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITE_URL = 'https://aca-info.com';

export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return false;

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'aca-info.com',
        key,
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList: urls.map((u) => (u.startsWith('http') ? u : `${SITE_URL}${u}`)),
      }),
    });

    return response.ok || response.status === 202;
  } catch (error) {
    console.error('[IndexNow] Submit failed:', error);
    return false;
  }
}
