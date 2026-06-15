// 용어 풀이 + 예측 근거 평가 (Claude). ANTHROPIC_API_KEY 없으면 null.
import Anthropic from '@anthropic-ai/sdk';

export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function ask(prompt: string, maxTokens: number): Promise<string | null> {
  if (!hasAiKey()) return null;
  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: maxTokens,
      output_config: { effort: 'low' },
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

const PLAIN = ' 마크다운 기호(**, #, -, ` 등)를 절대 쓰지 말고 평문으로만 작성하라. 강조가 필요하면 따옴표를 써라.';

// 주식/금융 용어를 쉬운 한국어로 설명.
export function explainTerm(term: string): Promise<string | null> {
  return ask(
    `주식·금융 초보자에게 "${term}" 용어를 쉬운 한국어로 설명하라. ` +
      `정의 한 줄, 왜 중요한지 한 줄, 간단한 예시 한 줄, 총 3~5줄. 군더더기 없이.` +
      PLAIN,
    400,
  );
}

// 예측 근거의 타당성을 한 줄로 평가.
export function evaluatePrediction(
  symbol: string,
  direction: 'up' | 'down',
  reason: string,
): Promise<string | null> {
  return ask(
    `한 투자 초보자가 ${symbol} 종목이 ${direction === 'up' ? '오를' : '내릴'} 것으로 예측했다. ` +
      `근거: "${reason}". 이 근거가 타당한지, 빠진 관점은 없는지 한국어 한 줄로만 코멘트하라. ` +
      `매수/매도 권유는 하지 말 것.` +
      PLAIN,
    200,
  );
}
