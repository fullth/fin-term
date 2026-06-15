// DeepL 번역. 키 없으면 noop(원문 반환). 같은 제목 중복 호출 방지용 캐시.
const FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

const cache = new Map<string, string>(); // 원문 → 번역

export function hasTranslator(key?: string): boolean {
  return Boolean(key);
}

// 미번역 텍스트만 골라 한 번에 DeepL 호출. 결과를 캐시에 채움.
export async function translateBatch(texts: string[], key?: string): Promise<void> {
  if (!key) return;
  const pending = [...new Set(texts)].filter((t) => t && !cache.has(t));
  if (!pending.length) return;

  // DeepL: text 파라미터 반복 → 순서대로 응답
  const params = new URLSearchParams();
  params.set('target_lang', 'KO');
  for (const t of pending) params.append('text', t);

  try {
    const res = await fetch(FREE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) return; // 한도초과/오류 시 조용히 패스 (원문 표시)
    const data = (await res.json()) as { translations?: { text: string }[] };
    const out = data.translations ?? [];
    pending.forEach((src, i) => {
      const translated = out[i]?.text;
      if (translated) cache.set(src, translated);
    });
  } catch {
    // 네트워크 오류 → 무시, 원문 유지
  }
}

export function getTranslation(text: string): string | undefined {
  return cache.get(text);
}
