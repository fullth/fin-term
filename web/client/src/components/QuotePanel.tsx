import type { Quote, Detail } from '../lib/types';
import { fmtPrice, fmtPct, fmtChange, arrow, changeClass, fmtBig, fmtTime } from '../lib/format';
import { Sparkline } from './Sparkline';

interface Props {
  quote: Quote | undefined;
  detail: Detail | null;
}

export function QuotePanel({ quote, detail }: Props) {
  const d = quote && detail && detail.symbol === quote.symbol ? detail : null;
  return (
    <div className="panel area-quote">
      <div className="ptitle t-yellow">QUOTE</div>
      {!quote && <div className="dim">종목을 선택하세요</div>}
      {quote && quote.error && (
        <div className="down">
          {quote.symbol}: {quote.error}
        </div>
      )}
      {quote && !quote.error && (
        <>
          <div className="quote-head">
            <span className="qsym">{quote.symbol}</span>
            {d?.name && <span className="qname">{d.name}</span>}
            <span className={`qprice ${changeClass(quote.change_pct)}`}>
              {fmtPrice(quote.price)} {arrow(quote.change_pct)} {fmtChange(quote.change)} ({fmtPct(quote.change_pct)})
            </span>
          </div>
          <div className="fields">
            <span className="field"><span className="l">시가</span>{fmtPrice(quote.open)}</span>
            <span className="field"><span className="l">고가</span>{fmtPrice(quote.high)}</span>
            <span className="field"><span className="l">저가</span>{fmtPrice(quote.low)}</span>
            <span className="field"><span className="l">전일</span>{fmtPrice(quote.prev_close)}</span>
          </div>
          <div className="meta">
            {d ? (
              <>
                {d.week52_high != null && (
                  <><span className="l">52주 </span><b>{fmtPrice(d.week52_low ?? null)}~{fmtPrice(d.week52_high)}</b>{'  '}</>
                )}
                {d.volume != null && (<><span className="l">거래량 </span><b>{fmtBig(d.volume)}</b>{'  '}</>)}
                {d.pe != null && (<><span className="l">PER </span><b>{d.pe.toFixed(1)}</b>{'  '}</>)}
                {d.market_cap != null && (<><span className="l">시총 </span><b>{fmtBig(d.market_cap * 1e6)}</b>{'  '}</>)}
                {d.industry ? (<><span className="l">업종 </span><b>{d.industry}</b></>) :
                  d.exchange ? (<><span className="l">거래소 </span><b>{d.exchange}</b></>) : null}
              </>
            ) : (
              <span className="dim">상세 불러오는 중…</span>
            )}
          </div>
          <Sparkline values={quote.spark} positive={(quote.change_pct ?? 0) >= 0} />
          <div className="updated">updated {fmtTime(quote.updated_at)}</div>
        </>
      )}
    </div>
  );
}
