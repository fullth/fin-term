import type { Quote, HotItem, LabelEntry } from '../lib/types';
import { fmtPriceCompact, fmtPct, fmtBig, arrow, changeClass } from '../lib/format';

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
        <div key={`${it.symbol}-${i}`} className="hot-row" onClick={() => onSelect(it.symbol)}>
          <div className="hot-main">
            <span className={`hot-mkt mkt-${it.market.toLowerCase()}`}>{it.market}</span>
            <span className="sym" style={{ color: 'var(--cyan)' }}>
              {i + 1}. {it.symbol}
            </span>
            <span className="name">{it.name}</span>
            <span className={`val ${changeClass(it.change_pct)}`}>
              {fmtPriceCompact(it.price)} {arrow(it.change_pct)}{fmtPct(it.change_pct)}
            </span>
          </div>
          <div className="hot-meta">
            {it.sector && <span className="hot-sector">{it.sector}</span>}
            {it.volume != null && <span className="hot-vol">거래량 {fmtBig(it.volume)}</span>}
          </div>
          {it.news.length > 0 && (
            <ul className="hot-news">
              {it.news.map((n, j) => (
                <li
                  key={j}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (n.url) window.open(n.url, '_blank', 'noopener');
                  }}
                >
                  <div className="hot-news-head">
                    <span className="hot-news-dot">·</span>
                    <span className="hot-news-title">{n.title}</span>
                  </div>
                  {n.summary && <p className="hot-news-summary">{n.summary}</p>}
                </li>
              ))}
            </ul>
          )}
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
