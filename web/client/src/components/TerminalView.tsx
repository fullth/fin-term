import { useEffect, useRef, useState, useCallback } from 'react';
import type { Quote, NewsItem, HotItem, LabelEntry, Detail, SearchResult, CoinMeta, CoinQuote, UpbitTick, CoinNewsItem, CoinSearchResult } from '../lib/types';
import { fmtPriceCompact, fmtPct, fmtChange, fmtBig, fmtTime, changeClass, arrow } from '../lib/format';
import { api } from '../lib/api';

// 터미널 모드 — 앱을 개발자 콘솔(zsh)처럼. 단일 스트림.
// 기본 상태: 여러 명령(watch/idx/hot/brief/search) 실행 후, 맨 아래 news --tail 5 -f 가 스트리밍 중.
// 스트리밍 중엔 프롬프트를 숨기고, Ctrl+X 로 중단해야 입력이 열린다(진짜 tail -f).
// 종목 클릭 = 관심목록 추가, 명령어 입력 + 명령 버튼 바(마우스)로도 실행.

interface TerminalViewProps {
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  indices: Quote[];
  markets: Quote[];
  labels: { indices: LabelEntry[]; markets: LabelEntry[] };
  news: NewsItem[];
  hot: HotItem[];
  onOpenBrief: () => void; // brief 명령/버튼 → 브리핑 모달 열기 (App 이 히스토리·생성 관리)
  coins: CoinMeta[];
  coinQuotes: CoinQuote[];
  coinLive: Record<string, UpbitTick>;
  coinNews: CoinNewsItem[];
  onAddSymbol: (sym: string, name: string) => void;
  onRemoveSymbol: (sym: string) => void;
  onAddCoin: (c: CoinMeta) => void;
  onRemoveCoin: (id: string) => void;
}

// 스트림 블록 — 명령 에코 / 명령별 출력. 데이터는 렌더 시점에 최신 props 로 그린다.
type Block =
  | { kind: 'cmd'; raw: string }
  | { kind: 'out'; render: 'watch' | 'idx' | 'hot' | 'help' | 'coin' | 'coinnews' }
  | { kind: 'news' } // news --tail N -f (스트리밍 여부는 streaming 상태로)
  | { kind: 'search'; q: string; results: SearchResult[]; loading?: boolean; err?: string }
  | { kind: 'coinsearch'; q: string; results: CoinSearchResult[]; loading?: boolean; err?: string }
  | { kind: 'info'; symbol: string; detail: Detail | null; loading?: boolean; err?: string }
  | { kind: 'text'; html: string; cls?: string };

const NEWS_TAIL = 5;

const HELP_LINES = [
  ['search <종목>', '종목 검색·추가', 'add <종목>', '관심목록 추가'],
  ['watch', '관심종목 실시간', 'rm <심볼>', '관심목록 제거'],
  ['info <심볼>', '종목 상세', 'idx', '지수·환율'],
  ['hot', '급상승 종목', 'brief', 'AI 브리핑'],
  ['news', '뉴스 스트림(^X 중단)', 'clear', '화면 정리'],
  ['coin', '코인 관심목록 시세', 'coin search <이름>', '코인 검색·추가'],
  ['coin news', '코인 뉴스', '', ''],
];

// 명령 버튼 바 — 마우스로도 실행. label 은 표시, cmd 는 실행할 명령.
const CMD_BUTTONS: { label: string; cmd: string }[] = [
  { label: 'watch', cmd: 'watch' },
  { label: 'idx', cmd: 'idx' },
  { label: 'hot', cmd: 'hot' },
  { label: 'brief', cmd: 'brief' },
  { label: 'news', cmd: `news --tail ${NEWS_TAIL} -f` },
  { label: 'search', cmd: 'search ' },
  { label: 'coin', cmd: 'coin' },
  { label: 'coin search', cmd: 'coin search ' },
  { label: 'help', cmd: 'help' },
  { label: 'clear', cmd: 'clear' },
];

export function TerminalView(props: TerminalViewProps) {
  const { watchlist, names, quotes, indices, markets, labels, news, hot, onOpenBrief, coins, coinQuotes, coinLive, coinNews, onAddSymbol, onRemoveSymbol, onAddCoin, onRemoveCoin } = props;

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(true); // 기본: 뉴스 스트리밍 중 → 프롬프트 숨김
  const historyRef = useRef<string[]>([]);
  const hidxRef = useRef(-1);
  const seededRef = useRef(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 시딩 — 여러 명령 실행된 상태 + search 하이닉스 결과 + 맨 아래 뉴스 스트리밍
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setBlocks([
      { kind: 'cmd', raw: `watch ${watchlist.join(' ')} --sse` },
      { kind: 'out', render: 'watch' },
      { kind: 'cmd', raw: 'idx' },
      { kind: 'out', render: 'idx' },
      { kind: 'cmd', raw: 'hot' },
      { kind: 'out', render: 'hot' },
      { kind: 'cmd', raw: 'search 하이닉스' },
      { kind: 'search', q: '하이닉스', results: [], loading: true },
      { kind: 'cmd', raw: `news --tail ${NEWS_TAIL} -f` },
      { kind: 'news' },
    ]);
    // 하이닉스 검색 실제 호출 → 결과 블록(인덱스 7) 갱신
    void (async () => {
      try {
        const { results } = await api.search('하이닉스');
        setBlocks((prev) => prev.map((b, i) => (i === 7 ? { kind: 'search', q: '하이닉스', results } : b)));
      } catch {
        setBlocks((prev) => prev.map((b, i) => (i === 7 ? { kind: 'search', q: '하이닉스', results: [], err: '검색 실패' } : b)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 새 블록마다 하단으로 스크롤
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [blocks]);

  // 스트리밍 중지되면 입력창 포커스
  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  // Ctrl+X — 스트리밍 중단(프롬프트 열기). 뉴스 흐름을 멈춘 시점으로 고정한다.
  // 물리 키(e.code)로 잡아 한글 IME·레이아웃·대소문자 영향을 피한다. Esc 로도 중단 가능.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!streaming) return;
      const isCtrlX = e.ctrlKey && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X');
      const isEsc = e.key === 'Escape';
      if (isCtrlX || isEsc) {
        e.preventDefault();
        setStreaming(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streaming]);

  const runInfo = useCallback(async (symbol: string, idx: number) => {
    try {
      const r = await api.detail(symbol);
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'info', symbol, detail: r.detail } : b)));
    } catch {
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'info', symbol, detail: null, err: '상세 조회 실패' } : b)));
    }
  }, []);

  const runSearch = useCallback(async (q: string, idx: number) => {
    try {
      const { results } = await api.search(q);
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'search', q, results } : b)));
    } catch {
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'search', q, results: [], err: '검색 실패' } : b)));
    }
  }, []);

  const runCoinSearch = useCallback(async (q: string, idx: number) => {
    try {
      const { results } = await api.cryptoSearch(q);
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'coinsearch', q, results } : b)));
    } catch {
      setBlocks((prev) => prev.map((b, i) => (i === idx ? { kind: 'coinsearch', q, results: [], err: '검색 실패' } : b)));
    }
  }, []);

  // 명령 실행
  const run = useCallback(
    (raw: string) => {
      const parts = raw.trim().split(/\s+/);
      const cmd = (parts[0] || '').toLowerCase();
      const args = parts.slice(1);
      setBlocks((prev) => {
        const next = [...prev, { kind: 'cmd', raw } as Block];
        switch (cmd) {
          case '':
            return next;
          case 'watch':
            return [...next, { kind: 'out', render: 'watch' }];
          case 'idx':
            return [...next, { kind: 'out', render: 'idx' }];
          case 'hot':
            return [...next, { kind: 'out', render: 'hot' }];
          case 'brief':
            // 스트림에 텍스트를 박지 않고 모달로 표시(지난 브리핑 탭 조회 + 새 생성).
            onOpenBrief();
            return [...next, { kind: 'text', html: '→ AI 시장 브리핑 모달을 열었습니다', cls: 'dim' }];
          case 'news':
            // 뉴스 스트리밍 재개 → 프롬프트 숨김
            setStreaming(true);
            return [...next, { kind: 'news' }];
          case 'coin': {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'search' || sub === 's') {
              const q = args.slice(1).join(' ');
              if (!q) return [...next, { kind: 'text', html: '✗ 사용법: coin search &lt;이름 또는 심볼&gt;', cls: 'err' }];
              const withPh = [...next, { kind: 'coinsearch', q, results: [], loading: true } as Block];
              void runCoinSearch(q, withPh.length - 1);
              return withPh;
            }
            if (sub === 'news') return [...next, { kind: 'out', render: 'coinnews' }];
            if (sub === 'rm' || sub === 'remove') {
              const sym = (args[1] || '').toUpperCase();
              const target = coins.find((c) => c.symbol.toUpperCase() === sym);
              if (!target) return [...next, { kind: 'text', html: `✗ <span class="cyan">${esc(sym)}</span> 코인 목록에 없음`, cls: 'err' }];
              onRemoveCoin(target.id);
              return [...next, { kind: 'text', html: `<span class="ok">✓</span> <span class="cyan">${esc(target.symbol)}</span> 코인 목록 제거`, cls: '' }];
            }
            // 인자 없음 → 코인 관심목록 시세
            return [...next, { kind: 'out', render: 'coin' }];
          }
          case 'help':
            return [...next, { kind: 'out', render: 'help' }];
          case 'clear':
            return [];
          case 'add': {
            const name = args.join(' ');
            if (!name) return [...next, { kind: 'text', html: '✗ 사용법: add &lt;종목명 또는 심볼&gt;', cls: 'err' }];
            if (/^[A-Za-z0-9.\-]+$/.test(name)) {
              onAddSymbol(name.toUpperCase(), name.toUpperCase());
              return [...next, { kind: 'text', html: `<span class="ok">✓</span> <span class="cyan">${esc(name.toUpperCase())}</span> 관심목록 추가`, cls: '' }];
            }
            const withPh = [...next, { kind: 'search', q: name, results: [], loading: true } as Block];
            void (async () => {
              try {
                const { results } = await api.search(name);
                if (results[0]) onAddSymbol(results[0].symbol, results[0].name);
                setBlocks((p) => p.map((b, i) => (i === withPh.length - 1 ? { kind: 'search', q: name, results } : b)));
              } catch {
                setBlocks((p) => p.map((b, i) => (i === withPh.length - 1 ? { kind: 'search', q: name, results: [], err: '추가 실패' } : b)));
              }
            })();
            return withPh;
          }
          case 'rm':
          case 'remove': {
            const sym = (args[0] || '').toUpperCase();
            if (!sym) return [...next, { kind: 'text', html: '✗ 사용법: rm &lt;심볼&gt;', cls: 'err' }];
            const target = watchlist.find((s) => s.toUpperCase() === sym || s.split('.')[0].toUpperCase() === sym);
            if (!target) return [...next, { kind: 'text', html: `✗ <span class="cyan">${esc(sym)}</span> 관심목록에 없음`, cls: 'err' }];
            onRemoveSymbol(target);
            return [...next, { kind: 'text', html: `<span class="ok">✓</span> <span class="cyan">${esc(target)}</span> 관심목록 제거`, cls: '' }];
          }
          case 'info':
          case 'q': {
            const sym = (args[0] || '').toUpperCase();
            if (!sym) return [...next, { kind: 'text', html: '✗ 사용법: info &lt;심볼&gt;', cls: 'err' }];
            const withPh = [...next, { kind: 'info', symbol: sym, detail: null, loading: true } as Block];
            void runInfo(sym, withPh.length - 1);
            return withPh;
          }
          case 'search':
          case 's': {
            const q = args.join(' ');
            if (!q) return [...next, { kind: 'text', html: '✗ 사용법: search &lt;종목명 또는 심볼&gt;', cls: 'err' }];
            const withPh = [...next, { kind: 'search', q, results: [], loading: true } as Block];
            void runSearch(q, withPh.length - 1);
            return withPh;
          }
          default:
            return [...next, { kind: 'text', html: `✗ 알 수 없는 명령: ${esc(cmd)} · <span class="dim">help 입력</span>`, cls: 'err' }];
        }
      });
    },
    [watchlist, coins, onOpenBrief, onAddSymbol, onRemoveSymbol, onRemoveCoin, runInfo, runSearch, runCoinSearch],
  );

  // 명령 버튼 클릭 — search 처럼 인자가 필요한 건 입력창에 채우고 커서를 끝으로, 나머지는 즉시 실행
  const onCmdButton = (cmd: string) => {
    if (streaming) setStreaming(false); // 버튼 누르면 스트리밍 중단하고 진행
    if (cmd.endsWith(' ')) {
      setInput(cmd);
      // streaming 해제 시 input 이 새로 렌더되므로 다음 프레임에 포커스 + 커서를 맨 끝(공백 뒤)으로
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    } else {
      historyRef.current.push(cmd);
      run(cmd);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const raw = input;
      if (raw.trim()) historyRef.current.push(raw);
      hidxRef.current = -1;
      run(raw);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = historyRef.current;
      if (!h.length) return;
      const ni = hidxRef.current < 0 ? h.length - 1 : Math.max(0, hidxRef.current - 1);
      hidxRef.current = ni;
      setInput(h[ni] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = historyRef.current;
      if (hidxRef.current < 0) return;
      const ni = hidxRef.current + 1;
      if (ni >= h.length) {
        hidxRef.current = -1;
        setInput('');
      } else {
        hidxRef.current = ni;
        setInput(h[ni] ?? '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cmds = ['search', 'watch', 'add', 'rm', 'info', 'idx', 'news', 'hot', 'brief', 'clear', 'help'];
      const m = cmds.filter((c) => c.startsWith(input.trim()));
      if (m.length === 1) setInput(m[0] + ' ');
    }
  };

  const focusInput = () => {
    if (!streaming) inputRef.current?.focus();
  };

  return (
    <div className="tv" onClick={focusInput}>
      <div className="tv-main" ref={streamRef}>
        {blocks.map((b, i) => (
          <BlockView
            key={i}
            b={b}
            streaming={streaming}
            watchlist={watchlist}
            names={names}
            quotes={quotes}
            indices={indices}
            markets={markets}
            labels={labels}
            news={news}
            hot={hot}
            coins={coins}
            coinQuotes={coinQuotes}
            coinLive={coinLive}
            coinNews={coinNews}
            onPick={onAddSymbol}
            onPickCoin={onAddCoin}
          />
        ))}

        {/* 스트리밍 중이면 프롬프트 대신 중단 안내 · 아니면 입력 프롬프트 */}
        {streaming ? (
          <div className="tv-streamhint">
            <span className="tv-blink">▮</span> 실시간 스트리밍 중… <span className="k">Ctrl+X</span> 또는 <span className="k">Esc</span> 눌러 중단하고 검색
          </div>
        ) : (
          <div className="tv-inputline">
            <span className="tv-prompt">fin@term</span>&nbsp;<span className="tv-caret">❯</span>&nbsp;
            <input
              ref={inputRef}
              value={input}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="종목명 입력 후 Enter (예: 삼성 · AAPL) · help 로 명령 목록"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        )}
      </div>

      {/* 명령 버튼 바 — 마우스로도 모든 명령 실행 */}
      <div className="tv-cmdbar" onClick={(e) => e.stopPropagation()}>
        <span className="tv-cmdbar-label">명령:</span>
        {CMD_BUTTONS.map((btn) => (
          <button key={btn.label} className="tv-cmdbtn" onClick={() => onCmdButton(btn.cmd)}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function BlockView(props: {
  b: Block;
  streaming: boolean;
  watchlist: string[];
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  indices: Quote[];
  markets: Quote[];
  labels: { indices: LabelEntry[]; markets: LabelEntry[] };
  news: NewsItem[];
  hot: HotItem[];
  coins: CoinMeta[];
  coinQuotes: CoinQuote[];
  coinLive: Record<string, UpbitTick>;
  coinNews: CoinNewsItem[];
  onPick: (sym: string, name: string) => void;
  onPickCoin: (c: CoinMeta) => void;
}) {
  const { b, streaming, watchlist, names, quotes, indices, markets, labels, news, hot, coins, coinQuotes, coinLive, coinNews, onPick, onPickCoin } = props;

  if (b.kind === 'cmd')
    return (
      <div className="tv-cmd">
        <span className="tv-prompt">fin@term</span> <span className="tv-caret">❯</span> {b.raw}
      </div>
    );

  if (b.kind === 'text') return <div className={`tv-ln ${b.cls || ''}`} dangerouslySetInnerHTML={{ __html: b.html }} />;

  if (b.kind === 'out' && b.render === 'watch') {
    return (
      <>
        <div className="tv-ln dim">
          → <span className="cyan">{watchlist.length} symbols</span> streaming (SSE) · <span className="dim">종목 클릭 = 추가</span>
        </div>
        <div className="tv-tbl q5 head">
          <span className="dim">SYM</span>
          <span className="dim">LAST</span>
          <span className="dim">CHG</span>
          <span className="dim">CHG%</span>
          <span className="dim">NAME · H/L</span>
        </div>
        {watchlist.map((s) => {
          const q = quotes[s];
          const cc = changeClass(q?.change_pct ?? null);
          return (
            <div className="tv-pick tv-tbl q5" key={s} onClick={() => onPick(s, names[s] || '')}>
              <span className="hl">{s}</span>
              <span>{q?.error ? 'ERR' : fmtPriceCompact(q?.price ?? null)}</span>
              <span className={cc}>{q ? fmtChange(q.change) : '—'}</span>
              <span className={cc}>{q ? `${arrow(q.change_pct)}${fmtPct(q.change_pct)}` : '—'}</span>
              <span className="dim">
                {names[s] || ''}
                {q?.high != null && q?.low != null ? ` · H${fmtPriceCompact(q.high)} L${fmtPriceCompact(q.low)}` : ''}
                {q?.halted ? ' · 거래정지' : ''}
              </span>
            </div>
          );
        })}
      </>
    );
  }

  if (b.kind === 'out' && b.render === 'idx') {
    const labelOf = (sym: string, list: LabelEntry[]) => list.find((l) => l.symbol === sym)?.label ?? sym;
    const all = [
      ...indices.map((q) => ({ q, label: labelOf(q.symbol, labels.indices) })),
      ...markets.map((q) => ({ q, label: labelOf(q.symbol, labels.markets) })),
    ];
    if (!all.length) return <div className="tv-ln dim">불러오는 중…</div>;
    return (
      <div className="tv-idx">
        {all.map(({ q, label }, i) => (
          <div className="tv-idx-row" key={`${q.symbol}-${i}`}>
            <span className="dim">{label}</span>
            <span className="v">{fmtPriceCompact(q.price)}</span>
            <span className={`p ${changeClass(q.change_pct)}`}>{fmtPct(q.change_pct)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (b.kind === 'out' && b.render === 'hot') {
    if (!hot.length) return <div className="tv-ln dim">거래 시간이 아니거나 급상승 종목이 없습니다</div>;
    return (
      <>
        <div className="tv-ln dim">급상승 · 클릭으로 추가</div>
        {hot.map((it, i) => (
          <div className="tv-pick tv-hot" key={`${it.symbol}-${i}`} onClick={() => onPick(it.symbol, it.name)}>
            <span className="dim">{i + 1}</span>
            <span className="cyan">{it.symbol}</span>
            <span>{fmtPriceCompact(it.price)}</span>
            <span className={changeClass(it.change_pct)}>
              {arrow(it.change_pct)}
              {fmtPct(it.change_pct)}
            </span>
            <span className="dim">{it.name}</span>
          </div>
        ))}
      </>
    );
  }

  if (b.kind === 'out' && b.render === 'help') {
    return (
      <>
        {HELP_LINES.map((row, i) => (
          <div className="tv-ln dim tv-help" key={i}>
            <span className="hcmd">{row[0]}</span>
            <span>{row[1]}</span>
            <span className="hcmd">{row[2]}</span>
            <span>{row[3]}</span>
          </div>
        ))}
      </>
    );
  }

  if (b.kind === 'news') {
    return (
      <>
        <div className="tv-ln dim">
          → 최근 뉴스 {NEWS_TAIL}건{streaming ? <span className="tv-live"> · ● live</span> : <span className="dim"> · 중단됨</span>}
        </div>
        {news.slice(0, NEWS_TAIL).map((n) => (
          <div className="tv-nrow" key={n.id}>
            <span className="tt">{fmtTime(n.published_at)}</span>{' '}
            <span className={/속보|긴급/.test(n.title) ? 'tag b' : 'tag'}>[{n.lang === 'ko' ? '국내' : 'MKT'}]</span>{' '}
            {n.title}
            {n.url && (
              <>
                {' '}
                <a className="tv-link" href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  [link]
                </a>
              </>
            )}
            <span className="src"> · {n.source}</span>
          </div>
        ))}
      </>
    );
  }

  if (b.kind === 'info') {
    if (b.loading) return <div className="tv-ln dim">→ {b.symbol} 조회 중…</div>;
    if (b.err || !b.detail) return <div className="tv-ln err">✗ {b.symbol} {b.err || '상세 없음'}</div>;
    const d = b.detail;
    const q = quotes[b.symbol];
    const cc = changeClass(q?.change_pct ?? null);
    const cell = (k: string, v: string | number | null | undefined) =>
      v == null || v === '' ? null : (
        <div>
          <span className="k">{k}</span> {typeof v === 'number' ? fmtPriceCompact(v) : v}
        </div>
      );
    return (
      <>
        <div className="tv-ln">
          <span className="hl">{b.symbol}</span> <span className="dim">{d.name || ''} · {d.exchange || ''}</span>
        </div>
        {q && (
          <div className="tv-ln">
            <span className="hl big">{fmtPriceCompact(q.price)}</span>{' '}
            <span className={cc}>
              {arrow(q.change_pct)} {fmtChange(q.change)} ({fmtPct(q.change_pct)})
            </span>
          </div>
        )}
        <div className="tv-detail">
          {cell('52W-H', d.week52_high)}
          {cell('52W-L', d.week52_low)}
          {cell('VOL', d.volume != null ? fmtBig(d.volume) : null)}
          {cell('PER', d.pe)}
          {cell('MKT', d.market_cap != null ? fmtBig(d.market_cap) : null)}
          {cell('업종', d.industry)}
        </div>
      </>
    );
  }

  if (b.kind === 'search') {
    if (b.loading) return <div className="tv-ln dim">→ "{b.q}" 검색 중…</div>;
    if (b.err) return <div className="tv-ln err">✗ "{b.q}" {b.err}</div>;
    if (!b.results.length) return <div className="tv-ln dim">→ "{b.q}" 검색 결과 없음</div>;
    return (
      <>
        <div className="tv-ln dim">
          → "{b.q}" 검색 · <span className="dim">클릭하면 관심목록에 추가</span>
        </div>
        <div className="tv-tbl q5s head">
          <span className="dim">SYM</span>
          <span className="dim">TYPE</span>
          <span className="dim">EXCH</span>
          <span className="dim">NAME</span>
        </div>
        {b.results.map((r) => (
          <div className="tv-pick tv-tbl q5s" key={r.symbol} onClick={() => onPick(r.symbol, r.name)}>
            <span className="hl">{r.symbol}</span>
            <span className="dim">{r.type}</span>
            <span className="dim">{r.exchange}</span>
            <span className="dim">{r.name}</span>
          </div>
        ))}
      </>
    );
  }

  if (b.kind === 'out' && b.render === 'coin') {
    if (!coins.length) return <div className="tv-ln dim">코인 관심목록이 비어 있음 · coin search &lt;이름&gt; 으로 추가</div>;
    const priceOf = (c: CoinMeta) => coinLive[c.upbitMarket]?.trade_price ?? coinQuotes.find((q) => q.symbol === c.symbol)?.price_krw ?? null;
    const rateOf = (c: CoinMeta) => {
      const t = coinLive[c.upbitMarket];
      if (t) return t.change_rate * 100;
      return coinQuotes.find((q) => q.symbol === c.symbol)?.change_24h ?? null;
    };
    return (
      <>
        <div className="tv-ln dim">
          → <span className="cyan">{coins.length} coins</span> streaming (업비트) · <span className="dim">클릭 = 유지</span>
        </div>
        <div className="tv-tbl q4c head">
          <span className="dim">SYM</span>
          <span className="dim">PRICE(₩)</span>
          <span className="dim">24H</span>
          <span className="dim">NAME</span>
        </div>
        {coins.map((c) => {
          const p = priceOf(c);
          const r = rateOf(c);
          const cc = changeClass(r);
          return (
            <div className="tv-pick tv-tbl q4c" key={c.id} onClick={() => onPickCoin(c)}>
              <span className="hl">{c.symbol}</span>
              <span>{p == null ? '—' : `₩${p.toLocaleString('ko-KR')}`}</span>
              <span className={cc}>{r == null ? '—' : `${arrow(r)}${fmtPct(r)}`}</span>
              <span className="dim">{c.name}</span>
            </div>
          );
        })}
      </>
    );
  }

  if (b.kind === 'out' && b.render === 'coinnews') {
    if (!coinNews.length) return <div className="tv-ln dim">코인 뉴스 불러오는 중…</div>;
    return (
      <>
        <div className="tv-ln dim">→ 코인 뉴스</div>
        {coinNews.slice(0, 10).map((n) => (
          <div className="tv-nrow" key={n.id}>
            <span className="tt">{fmtTime(n.published_at)}</span> {n.title}
            {n.url && (
              <>
                {' '}
                <a className="tv-link" href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  [link]
                </a>
              </>
            )}
            <span className="src"> · {n.source}</span>
          </div>
        ))}
      </>
    );
  }

  if (b.kind === 'coinsearch') {
    if (b.loading) return <div className="tv-ln dim">→ "{b.q}" 코인 검색 중…</div>;
    if (b.err) return <div className="tv-ln err">✗ "{b.q}" {b.err}</div>;
    if (!b.results.length) return <div className="tv-ln dim">→ "{b.q}" 업비트 상장 코인 없음</div>;
    return (
      <>
        <div className="tv-ln dim">
          → "{b.q}" 코인 검색 · <span className="dim">클릭하면 코인 목록에 추가</span>
        </div>
        <div className="tv-tbl q4c head">
          <span className="dim">SYM</span>
          <span className="dim">MARKET</span>
          <span className="dim"></span>
          <span className="dim">NAME</span>
        </div>
        {b.results.map((r) => (
          <div className="tv-pick tv-tbl q4c" key={r.id} onClick={() => onPickCoin({ id: r.id, symbol: r.symbol, name: r.name, upbitMarket: r.upbitMarket })}>
            <span className="hl">{r.symbol}</span>
            <span className="dim">{r.upbitMarket}</span>
            <span></span>
            <span className="dim">{r.name}</span>
          </div>
        ))}
      </>
    );
  }

  return null;
}
