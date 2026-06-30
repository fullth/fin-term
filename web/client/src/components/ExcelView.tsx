import { useState } from 'react';
import type { Quote, NewsItem, HotItem, LabelEntry } from '../lib/types';
import { fmtPriceCompact, fmtPct, fmtChange, fmtBig, fmtTime, changeClass } from '../lib/format';

// 엑셀 위장 모드 — 앱의 실데이터(관심종목·지수·환율·뉴스·급상승)를 그대로
// 스프레드시트 골격(초록 리본·셀·시트탭) 안에 담아 보여준다. 더미·라벨 위장 없음.
// 토글은 App 에서 (` 키 / 버튼) 제어하고, 여기서는 표시만 담당한다.

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

type SheetKey = 'watch' | 'markets' | 'news' | 'hot';

interface ExcelViewProps {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  indices: Quote[];
  markets: Quote[];
  labels: { indices: LabelEntry[]; markets: LabelEntry[] };
  news: NewsItem[];
  hot: HotItem[];
}

// 한 셀 — 값 + 정렬/색/헤더 여부. 등락 색은 .up/.down 클래스로 (단색 모드면 CSS 에서 무채색 처리).
type Cell = { v: string; cls?: string; left?: boolean; head?: boolean; section?: boolean; span?: number };

function row(cells: Cell[]): Cell[] {
  return cells;
}

function buildWatch(watchlist: string[], names: Record<string, string>, quotes: Record<string, Quote>): Cell[][] {
  const header = ['종목', '종목명', '현재가', '등락률', '대비', '고가', '저가'];
  const rows: Cell[][] = [
    [{ v: '관심종목 (WATCHLIST)', section: true, span: 7 }],
    header.map((h) => ({ v: h, head: true, left: true })),
  ];
  for (const sym of watchlist) {
    const q = quotes[sym];
    const cc = changeClass(q?.change_pct ?? null);
    rows.push(
      row([
        { v: sym, left: true },
        { v: names[sym] || '', left: true },
        { v: q?.error ? 'ERR' : fmtPriceCompact(q?.price ?? null) },
        { v: q ? fmtPct(q.change_pct) : '—', cls: cc },
        { v: q ? fmtChange(q.change) : '—', cls: cc },
        { v: fmtPriceCompact(q?.high ?? null) },
        { v: fmtPriceCompact(q?.low ?? null) },
      ]),
    );
  }
  return rows;
}

function buildMarkets(indices: Quote[], markets: Quote[], labels: ExcelViewProps['labels']): Cell[][] {
  const labelOf = (sym: string, list: LabelEntry[]) => list.find((l) => l.symbol === sym)?.label ?? sym;
  const rows: Cell[][] = [
    [{ v: '지수 · 환율 · 원자재', section: true, span: 7 }],
    [
      { v: '항목', head: true, left: true },
      { v: '현재가', head: true },
      { v: '등락률', head: true },
    ],
  ];
  const push = (q: Quote, label: string) => {
    const cc = changeClass(q.change_pct);
    rows.push(
      row([
        { v: label, left: true },
        { v: fmtPriceCompact(q.price) },
        { v: fmtPct(q.change_pct), cls: cc },
      ]),
    );
  };
  for (const q of indices) push(q, labelOf(q.symbol, labels.indices));
  for (const q of markets) push(q, labelOf(q.symbol, labels.markets));
  if (indices.length + markets.length === 0) rows.push([{ v: '불러오는 중…', left: true }]);
  return rows;
}

function buildNews(news: NewsItem[]): Cell[][] {
  const rows: Cell[][] = [
    [{ v: '뉴스', section: true, span: 7 }],
    [
      { v: '시각', head: true, left: true },
      { v: '제목', head: true, left: true, span: 5 },
      { v: '출처', head: true, left: true },
    ],
  ];
  for (const n of news.slice(0, 40)) {
    rows.push(
      row([
        { v: fmtTime(n.published_at), left: true },
        { v: n.title, left: true, span: 5 },
        { v: n.source, left: true },
      ]),
    );
  }
  if (news.length === 0) rows.push([{ v: '불러오는 중…', left: true }]);
  return rows;
}

function buildHot(hot: HotItem[]): Cell[][] {
  const rows: Cell[][] = [
    [{ v: '급상승 종목', section: true, span: 7 }],
    [
      { v: '시장', head: true, left: true },
      { v: '종목', head: true, left: true },
      { v: '종목명', head: true, left: true },
      { v: '현재가', head: true },
      { v: '등락률', head: true },
      { v: '거래량', head: true },
      { v: '섹터', head: true, left: true },
    ],
  ];
  for (const it of hot) {
    const cc = changeClass(it.change_pct);
    rows.push(
      row([
        { v: it.market, left: true },
        { v: it.symbol, left: true },
        { v: it.name, left: true },
        { v: fmtPriceCompact(it.price) },
        { v: fmtPct(it.change_pct), cls: cc },
        { v: fmtBig(it.volume) },
        { v: it.sector || '', left: true },
      ]),
    );
  }
  if (hot.length === 0) rows.push([{ v: '거래 시간이 아니거나 급상승 종목이 없습니다', left: true }]);
  return rows;
}

const SHEETS: { key: SheetKey; tab: string; doc: string }[] = [
  { key: 'watch', tab: '관심종목', doc: 'watchlist.xlsx' },
  { key: 'markets', tab: '지수·환율', doc: 'watchlist.xlsx' },
  { key: 'news', tab: '뉴스', doc: 'watchlist.xlsx' },
  { key: 'hot', tab: '급상승', doc: 'watchlist.xlsx' },
];

export function ExcelView(props: ExcelViewProps) {
  const [sheet, setSheet] = useState<SheetKey>('watch');
  const [sel, setSel] = useState<string>('A1'); // 선택 셀 (수식줄 표시용)
  const [formula, setFormula] = useState<string>('WATCHLIST');

  const data: Cell[][] =
    sheet === 'watch'
      ? buildWatch(props.watchlist, props.names, props.quotes)
      : sheet === 'markets'
        ? buildMarkets(props.indices, props.markets, props.labels)
        : sheet === 'news'
          ? buildNews(props.news)
          : buildHot(props.hot);

  return (
    <div className="excel">
      <div className="excel-ribbon-tabs">
        <span className="tab">파일</span>
        <span className="tab active">홈</span>
        <span className="tab">삽입</span>
        <span className="tab">페이지 레이아웃</span>
        <span className="tab">수식</span>
        <span className="tab">데이터</span>
        <span className="tab">검토</span>
        <span className="tab">보기</span>
      </div>
      <div className="excel-ribbon">
        <div className="rg">
          <div className="rrow"><span className="rib-btn">붙여넣기</span></div>
          <div className="rlabel">클립보드</div>
        </div>
        <div className="rsep" />
        <div className="rg">
          <div className="rrow"><span className="rib-btn">맑은 고딕</span><span className="rib-btn">11</span></div>
          <div className="rrow"><span className="rib-btn"><b>가</b></span><span className="rib-btn"><i>가</i></span><span className="rib-btn">U</span></div>
          <div className="rlabel">글꼴</div>
        </div>
        <div className="rsep" />
        <div className="rg">
          <div className="rrow"><span className="rib-btn">₩</span><span className="rib-btn">%</span><span className="rib-btn">.00</span></div>
          <div className="rlabel">표시 형식</div>
        </div>
      </div>
      <div className="excel-formula-bar">
        <span className="name-box">{sel}</span>
        <span className="fx">fx</span>
        <span className="formula-input">{formula}</span>
      </div>
      <div className="excel-grid-wrap">
        <table className="excel-sheet">
          <thead>
            <tr>
              <th className="row-h" />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((cells, ri) => (
              <tr key={ri}>
                <td className="row-h">{ri + 1}</td>
                {cells.map((cell, ci) => (
                  <td
                    key={ci}
                    colSpan={cell.span}
                    className={[
                      cell.left ? 'left' : '',
                      cell.head ? 'head' : '',
                      cell.section ? 'section' : '',
                      cell.cls || '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setSel(`${COLS[ci] ?? 'A'}${ri + 1}`);
                      setFormula(cell.v || '');
                    }}
                  >
                    {cell.v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="excel-sheet-tabs">
        {SHEETS.map((s) => (
          <span
            key={s.key}
            className={`sheet-tab${sheet === s.key ? ' active' : ''}`}
            onClick={() => {
              setSheet(s.key);
              setSel('A1');
              setFormula(s.tab);
            }}
          >
            {s.tab}
          </span>
        ))}
      </div>
      <div className="excel-statusbar">
        <span>준비</span>
        <span className="right">
          <span>종목 {props.watchlist.length}</span>
          <span>뉴스 {props.news.length}</span>
          <span>100%</span>
        </span>
      </div>
    </div>
  );
}
