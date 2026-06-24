// AI 헬퍼 — 클라이언트가 보낸 키(우선) 또는 서버 env 키로 Anthropic 호출.
// sources/brief·explain 은 env 키만 보므로(TUI 용), 웹은 키 주입형으로 여기서 직접 호출한다.
// 프롬프트는 sources 의 것과 동일 취지로 BFF 에 둔다.
import Anthropic from '@anthropic-ai/sdk';

const PLAIN = ' 마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조가 필요하면 따옴표를 써라.';

// 용어 풀이용 키 — 사용자가 보낸 헤더 키만 사용. 서버 env 로 fallback 하지 않는다(임의 질의 악용 방지).
export function resolveUserKey(headerKey?: string): string | null {
  const k = (headerKey ?? '').trim();
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

// 시장 전반(주식+코인) 브리핑 입력 — 개인화(관심종목) 없이 시장 데이터만.
export interface BriefInput {
  indices: { label: string; change_pct: number | null }[]; // 주요 지수
  markets: { label: string; change_pct: number | null }[]; // 환율·원자재
  hot: { name: string; change_pct: number | null }[]; // 급상승 종목
  coins: { symbol: string; change_24h: number | null }[]; // 코인
  news: { title: string; source: string }[];
}

function pctLines(items: { label?: string; name?: string; symbol?: string; change_pct?: number | null; change_24h?: number | null }[]): string {
  return items
    .map((it) => {
      const label = it.label ?? it.name ?? it.symbol ?? '';
      const pct = it.change_pct ?? it.change_24h;
      return `- ${label}: ${pct == null ? '?' : pct.toFixed(2) + '%'}`;
    })
    .join('\n');
}

function buildBriefPrompt(input: BriefInput): string {
  const newsLines = input.news.slice(0, 25).map((n) => `- ${n.title} (${n.source})`).join('\n');
  return [
    '## 주요 지수',
    pctLines(input.indices),
    '',
    '## 환율·원자재',
    pctLines(input.markets),
    '',
    '## 급상승 종목',
    pctLines(input.hot.slice(0, 8)),
    '',
    '## 코인 시세(24h)',
    pctLines(input.coins.slice(0, 8)),
    '',
    '## 최근 뉴스',
    newsLines,
    '',
    '위 정보를 바탕으로 한국어 데일리 시장 브리핑을 작성하라. 주식 시장과 코인 시장 두 가지를 모두 다룬다. 형식:',
    '1. 한 줄 요약: 오늘 전체 시장 분위기를 한 문장으로',
    '2. 주식 시장: 지수·환율·급상승·관련 뉴스 흐름 2~3줄',
    '3. 코인 시장: 주요 코인 등락·관련 뉴스 흐름 1~2줄',
    '',
    '특정 종목 추천/매수·매도 권유는 하지 말 것. 사실과 흐름 요약만. 전체 12줄 이내.',
    '마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조는 따옴표로.',
  ].join('\n');
}

export function generateBriefWith(apiKey: string, input: BriefInput): Promise<string | null> {
  return ask(apiKey, buildBriefPrompt(input), 1024, 'medium');
}
