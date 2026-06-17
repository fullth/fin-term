// 코인 모드 전체 화면. bitcoin-monitor 레이아웃을 Ink 로 재현.
// 코인목록 / 시세상세 / 캔들차트 / 보유요약 / 알림로그 / 코인뉴스.
import React from 'react';
import { Box, Text } from 'ink';
import type {
  CryptoTickerMap,
  Holding,
  Candle,
  ChartTimeframe,
  FeedStatus,
  NewsItem,
} from '../core/types.js';
import { COINS, timeframe } from '../sources/upbit.js';
import { snapshot, portfolio } from '../core/holdings.js';
import { CandleChart } from './CandleChart.js';
import { fmtKrw, fmtKrwCompact, fmtPct, arrow, changeColor, fmtTime } from './format.js';
import { hyperlink } from '../core/open-url.js';

interface Props {
  tickers: CryptoTickerMap;
  holdings: Holding[];
  selected: string | null; // 코인 id
  chartTimeframe: ChartTimeframe;
  candles: Candle[];
  feedStatus: FeedStatus;
  alerts: string[];
  news: NewsItem[];
  newsRows: number; // 하단 뉴스 표시 줄 수 (App 이 화면 높이로 계산)
  selectedFocused: boolean; // 코인목록 포커스 여부
}

const FEED_LABEL: Record<FeedStatus, string> = {
  polling: '폴링',
  connecting: '연결중',
  live: '실시간',
  reconnecting: '재연결',
  error: '오류',
};

export function CryptoView({
  tickers,
  holdings,
  selected,
  chartTimeframe,
  candles,
  feedStatus,
  alerts,
  news,
  newsRows,
  selectedFocused,
}: Props) {
  const pf = portfolio(holdings, tickers);
  const sel = COINS.find((c) => c.id === selected) ?? COINS[0];
  const selTicker = selected ? tickers[selected] : undefined;
  const selHolding = holdings.find((h) => h.id === selected);
  const selSnap = selHolding ? snapshot(selHolding, selTicker?.price_krw) : null;

  return (
    <Box flexDirection="column">
      {/* 헤더 — 선택 코인 · 피드 상태 · 총 평가/손익 */}
      <Box paddingX={1} justifyContent="space-between">
        <Text>
          <Text bold color="cyan">
            {sel.symbol}
          </Text>
          <Text dimColor> {sel.name} · 시세 </Text>
          <Text color={feedStatus === 'live' ? 'green' : 'gray'}>{FEED_LABEL[feedStatus]}</Text>
        </Text>
        {holdings.length > 0 && (
          <Text>
            <Text dimColor>총 평가 </Text>
            {fmtKrw(pf.current_value_krw)}
            <Text dimColor> · 손익 </Text>
            <Text color={changeColor(pf.pnl_krw)}>
              {fmtKrw(pf.pnl_krw)} ({arrow(pf.return_pct)}
              {fmtPct(pf.return_pct)})
            </Text>
          </Text>
        )}
      </Box>

      {/* 좌: 코인 목록 / 우: 시세 상세 */}
      <Box>
        <CoinList tickers={tickers} holdings={holdings} selected={selected} focused={selectedFocused} />
        <QuoteDetail
          symbol={sel.symbol}
          name={sel.name}
          ticker={selTicker}
          holding={selHolding}
          snap={selSnap}
        />
      </Box>

      {/* 차트 + 보유요약/알림 */}
      <Box>
        <CandleChart
          symbol={sel.symbol}
          timeframeLabel={timeframe(chartTimeframe).label}
          candles={candles}
          avgBuyKrw={selHolding?.avg_buy_krw ?? null}
          width={56}
          height={9}
          focused={false}
        />
        <Box flexDirection="column" flexGrow={1}>
          <PortfolioSummary holdings={holdings} pf={pf} timeframeLabel={timeframe(chartTimeframe).label} />
          <AlertsLog alerts={alerts} />
        </Box>
      </Box>

      {/* 코인 뉴스 */}
      <CryptoNews news={news} rows={newsRows} />
    </Box>
  );
}

// 코인 목록 — holdings 없어도 4종 시세 표시. 보유 있으면 수익률 함께.
function CoinList({
  tickers,
  holdings,
  selected,
  focused,
}: {
  tickers: CryptoTickerMap;
  holdings: Holding[];
  selected: string | null;
  focused: boolean;
}) {
  return (
    <Box
      flexDirection="column"
      width={42}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Text bold color="yellow">
        관심 코인 {focused && <Text dimColor>●</Text>}
      </Text>
      {COINS.map((coin) => {
        const t = tickers[coin.id];
        const h = holdings.find((x) => x.id === coin.id);
        const snap = h ? snapshot(h, t?.price_krw) : null;
        const isSel = coin.id === selected;
        const right = snap
          ? `${arrow(snap.return_pct)}${fmtPct(snap.return_pct)}`
          : t
            ? `${arrow(t.change_pct_24h)}${fmtPct(t.change_pct_24h)}`
            : '—';
        return (
          <Box key={coin.id}>
            <Box width={6} flexShrink={0}>
              <Text color={isSel ? 'cyan' : undefined} bold={isSel} wrap="truncate">
                {isSel ? '▶ ' : '  '}
                {coin.symbol}
              </Text>
            </Box>
            <Box flexGrow={1} justifyContent="flex-end" marginRight={1}>
              <Text wrap="truncate">{t ? fmtKrwCompact(t.price_krw) : '…'}</Text>
            </Box>
            <Box width={11} flexShrink={0} justifyContent="flex-end">
              <Text color={changeColor(snap ? snap.return_pct : (t?.change_pct_24h ?? null))} wrap="truncate">
                {right}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// 시세 상세 — 현재가/24H 변동/고저/거래대금 + 보유 정보(있으면).
function QuoteDetail({
  symbol,
  name,
  ticker,
  holding,
  snap,
}: {
  symbol: string;
  name: string;
  ticker: import('../core/types.js').CryptoTicker | undefined;
  holding: Holding | undefined;
  snap: import('../core/types.js').HoldingSnapshot | null;
}) {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold>
        {symbol} <Text dimColor>{name}</Text>
      </Text>
      {!ticker ? (
        <Text dimColor>시세 불러오는 중…</Text>
      ) : (
        <>
          <Text>
            {fmtKrw(ticker.price_krw)}{' '}
            <Text color={changeColor(ticker.change_pct_24h)}>
              {arrow(ticker.change_pct_24h)}
              {fmtPct(ticker.change_pct_24h)}
            </Text>
          </Text>
          <Text dimColor>
            24H 고 {fmtKrwCompact(ticker.high_24h)} · 저 {fmtKrwCompact(ticker.low_24h)} · 거래대금{' '}
            {fmtKrwCompact(ticker.acc_trade_price_24h)}
          </Text>
          {holding && snap ? (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                <Text dimColor>보유 </Text>
                {holding.quantity} {symbol}
                <Text dimColor> · 평단 </Text>
                {fmtKrwCompact(holding.avg_buy_krw)}
              </Text>
              <Text>
                <Text dimColor>평가 </Text>
                {fmtKrw(snap.current_value_krw)}
                <Text dimColor> · 손익 </Text>
                <Text color={changeColor(snap.pnl_krw)}>
                  {fmtKrw(snap.pnl_krw)} ({arrow(snap.return_pct)}
                  {fmtPct(snap.return_pct)})
                </Text>
              </Text>
            </Box>
          ) : (
            <Text dimColor>(보유 내역 없음 — ~/.fin-term/holdings.json)</Text>
          )}
        </>
      )}
    </Box>
  );
}

function PortfolioSummary({
  holdings,
  pf,
  timeframeLabel,
}: {
  holdings: Holding[];
  pf: import('../core/holdings.js').PortfolioSummary;
  timeframeLabel: string;
}) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text bold color="magenta">
        포트폴리오 <Text dimColor>· {timeframeLabel}</Text>
      </Text>
      {holdings.length === 0 ? (
        <Text dimColor>보유 내역 없음</Text>
      ) : (
        <Text>
          <Text dimColor>매수 </Text>
          {fmtKrwCompact(pf.buy_amount_krw)}
          <Text dimColor> · 평가 </Text>
          {fmtKrwCompact(pf.current_value_krw)}
          <Text dimColor> · </Text>
          <Text color={changeColor(pf.return_pct)}>
            {arrow(pf.return_pct)}
            {fmtPct(pf.return_pct)}
          </Text>
        </Text>
      )}
    </Box>
  );
}

function AlertsLog({ alerts }: { alerts: string[] }) {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="red" paddingX={1}>
      <Text bold color="red">
        알림
      </Text>
      {alerts.length === 0 ? (
        <Text dimColor>알림 대기 중…</Text>
      ) : (
        alerts.slice(0, 5).map((a, i) => (
          <Text key={i} wrap="truncate-end" dimColor={i > 0}>
            {a}
          </Text>
        ))
      )}
    </Box>
  );
}

function CryptoNews({ news, rows }: { news: NewsItem[]; rows: number }) {
  const visible = news.slice(0, Math.max(1, rows));
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text bold color="yellow">
        코인 뉴스 <Text dimColor>[{news.length}]</Text>
      </Text>
      {visible.length === 0 && <Text dimColor>뉴스 불러오는 중…</Text>}
      {visible.map((n, i) => (
        <Box key={n.id}>
          <Text dimColor>{String(i + 1).padStart(2, ' ')} </Text>
          <Text dimColor>{fmtTime(n.published_at)} </Text>
          <Text wrap="truncate-end">{hyperlink(n.url, n.title)}</Text>
        </Box>
      ))}
    </Box>
  );
}
