import type { Quote } from '../lib/types';
import { fmtPriceCompact, fmtPct, arrow, changeClass } from '../lib/format';

interface Props {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  selected: string | null;
  newsFilter: string | null;
  onSelect: (sym: string) => void;
  onRemove: (sym: string) => void;
  onFilterNews: (sym: string) => void;
}

export function Watchlist({ watchlist, names, quotes, selected, newsFilter, onSelect, onRemove, onFilterNews }: Props) {
  return (
    <div className="panel area-watch focused">
      <div className="ptitle t-yellow">
        WATCHLIST <span className="dot">●</span>
      </div>
      {watchlist.length === 0 && <div className="dim">empty — 검색으로 추가</div>}
      {watchlist.map((sym) => {
        const q = quotes[sym];
        const pct = q?.change_pct ?? null;
        const isSel = sym === selected;
        const right = q?.error ? 'ERR' : `${fmtPriceCompact(q?.price ?? null)} ${arrow(pct)}${fmtPct(pct)}`;
        return (
          <div
            key={sym}
            className={`listrow${isSel ? ' sel' : ''}`}
            onClick={() => onSelect(sym)}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemove(sym);
            }}
            title="클릭 선택 · 우클릭 삭제"
          >
            <div className="listrow-top">
              <span className="caret">{isSel ? '▶' : ''}</span>
              <span className="sym">{sym}</span>
              <button
                className={`newsbtn${newsFilter === sym ? ' on' : ''}`}
                title="이 종목 뉴스만 보기"
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterNews(sym);
                }}
              >
                뉴스
              </button>
              <span className={`val ${changeClass(pct)}`}>{right}</span>
            </div>
            {names[sym] && <div className="listrow-sub">{names[sym]}</div>}
          </div>
        );
      })}
    </div>
  );
}
