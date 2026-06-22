// AI 헬퍼 — 클라이언트가 보낸 키(우선) 또는 서버 env 키로 Anthropic 호출.
// sources/brief·explain 은 env 키만 보므로(TUI 용), 웹은 키 주입형으로 여기서 직접 호출한다.
// 프롬프트는 sources 의 것과 동일 취지로 BFF 에 둔다.
import Anthropic from '@anthropic-ai/sdk';

const PLAIN = ' 마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조가 필요하면 따옴표를 써라.';

// 사용할 키 결정: 클라 헤더 키 > 서버 env. 둘 다 없으면 null.
export function resolveKey(headerKey?: string): string | null {
  const k = (headerKey ?? '').trim() || process.env.ANTHROPIC_API_KEY || '';
  return k || null;
}

async function ask(apiKey: string, prompt: string, maxTokens: number, effort: 'low' | 'medium'): Promise<string | null> {
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: maxTokens,
      output_config: { effort },
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

export function explainTermWith(apiKey: string, term: string): Promise<string | null> {
  return ask(
    apiKey,
    `주식·금융 초보자에게 "${term}" 용어를 쉬운 한국어로 설명하라. ` +
      `정의 한 줄, 왜 중요한지 한 줄, 간단한 예시 한 줄, 총 3~5줄. 군더더기 없이.` +
      PLAIN,
    400,
    'low',
  );
}

export interface BriefInput {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, { price: number | null; change_pct: number | null }>;
  news: { title: string; source: string }[];
}

function buildBriefPrompt(input: BriefInput): string {
  const quoteLines = input.watchlist
    .map((sym) => {
      const q = input.quotes[sym];
      const name = input.names[sym] ?? '';
      if (!q || q.price == null) return `- ${sym} ${name}: 데이터 없음`;
      const pct = q.change_pct?.toFixed(2) ?? '?';
      return `- ${sym} ${name}: ${q.price} (${pct}%)`;
    })
    .join('\n');
  const newsLines = input.news.slice(0, 25).map((n) => `- ${n.title} (${n.source})`).join('\n');
  return [
    '## 관심종목 시세',
    quoteLines,
    '',
    '## 최근 뉴스',
    newsLines,
    '',
    '위 정보를 바탕으로 한국어로 간결한 시장 브리핑을 작성하라. 형식:',
    '1. 한 줄 요약: 오늘 시장 분위기를 한 문장으로',
    '2. 주요 테마: 2~3개 불릿, 각 한 줄',
    '3. 내 종목 영향: 관심종목 중 뉴스와 관련된 것만 한 줄씩 (없으면 "직접 관련 뉴스 없음")',
    '',
    '투자 조언이나 매수/매도 권유는 하지 말 것. 사실과 흐름 요약만. 전체 12줄 이내.',
    '마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조는 따옴표로.',
  ].join('\n');
}

export function generateBriefWith(apiKey: string, input: BriefInput): Promise<string | null> {
  return ask(apiKey, buildBriefPrompt(input), 1024, 'medium');
}
