import { BriefPanel } from 'fin-term-client';

// BriefPanel shows the AI market briefing (magenta title). Three states:
// generated text, generating, and the disabled hint when no key is set.

const BRIEF = `오늘 코스피는 외국인 순매수에 힘입어 2,610선을 회복하며 마감했습니다. 반도체 대형주가 지수를 견인했고, 2차전지는 약세를 보였습니다.

미국 증시는 연준의 금리 인하 결정 이후 혼조세로, 나스닥이 소폭 하락했습니다. 달러/원 환율은 1,378원 부근에서 등락 중입니다.

관심 종목 중 AAPL은 신제품 기대감에 1.5% 상승, NVDA는 차익 실현 매물에 2% 하락했습니다.`;

export const Generated = () => <div style={{ maxWidth: 340 }}><BriefPanel text={BRIEF} loading={false} /></div>;

export const Generating = () => <div style={{ maxWidth: 340 }}><BriefPanel text={null} loading /></div>;

export const Disabled = () => <div style={{ maxWidth: 340 }}><BriefPanel text={null} loading={false} /></div>;
