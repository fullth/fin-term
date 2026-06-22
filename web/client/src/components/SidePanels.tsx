import type { Quote, HotItem, LabelEntry } from '../lib/types';
import { fmtPriceCompact, fmtPct, arrow, changeClass } from '../lib/format';

function QuoteList({ quotes, labels, labelWidth }: { quotes: Quote[]; labels: LabelEntry[]; labelWidth: number }) {
  const labelOf = (sym: string) => labels.find((l) => l.symbol === sym)?.label ?? sym;
  return (
    <>
      {quotes.length === 0 && <div className="dim">불러오는 중…</div>}
      {quotes.map((q) => (
        <div key={q.symbol} className="row" style={{ cursor: 'default' }}>
          <span className="sym" style={{ minWidth: labelWidth }}>{labelOf(q.symbol)}</span>
          <span className={`val ${changeClass(q.change_pct)}`}>
            {q.error ? 'ERR' : `${fmtPriceCompact(q.price)} ${arrow(q.change_pct)}${fmtPct(q.change_pct)}`}
          </span>
        </div>
      ))}
    </>
  );
}

export function IndicesPanel({ quotes, labels }: { quotes: Quote[]; labels: LabelEntry[] }) {
  return (
    <div className="panel">
      <div className="ptitle t-blue">지수 현황</div>
      <QuoteList quotes={quotes} labels={labels} labelWidth={90} />
    </div>
  );
}

export function MarketsPanel({ quotes, labels }: { quotes: Quote[]; labels: LabelEntry[] }) {
  return (
    <div className="panel">
      <div className="ptitle t-magenta">환율 · 원자재</div>
      <QuoteList quotes={quotes} labels={labels} labelWidth={80} />
    </div>
  );
}

export function HotPanel({ items, onSelect }: { items: HotItem[]; onSelect: (sym: string) => void }) {
  return (
    <div className="panel">
      <div className="ptitle t-red">
        급상승 종목 <span className="sub">상승률 상위</span>
      </div>
      {items.length === 0 && <div className="dim">불러오는 중…</div>}
      {items.map((it, i) => (
        <div key={`${it.symbol}-${i}`} className="row" onClick={() => onSelect(it.symbol)}>
          <span className="sym" style={{ color: 'var(--cyan)', minWidth: 70 }}>
            {i + 1}. {it.symbol}
          </span>
          <span className="name">{it.name}</span>
          <span className={`val ${changeClass(it.change_pct)}`}>
            {fmtPriceCompact(it.price)} {arrow(it.change_pct)}{fmtPct(it.change_pct)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BriefPanel({ text, loading }: { text: string | null; loading: boolean }) {
  return (
    <div className="panel">
      <div className="ptitle t-magenta">AI 시장 브리핑</div>
      {loading && <div className="dim">생성 중…</div>}
      {!loading && text && <div style={{ fontSize: 12, lineHeight: 1.6 }}>{text}</div>}
      {!loading && !text && <div className="dim">키 입력 시 활성화 (ANTHROPIC_API_KEY)</div>}
    </div>
  );
}
