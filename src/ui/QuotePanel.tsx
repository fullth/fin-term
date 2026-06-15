import React from 'react';
import { Box, Text } from 'ink';
import type { Quote } from '../core/types.js';
import type { Detail } from '../sources/detail.js';
import { fmtPrice, fmtPct, fmtChange, arrow, changeColor, sparkline, fmtTime, fmtBig } from './format.js';

interface Props {
  quote: Quote | undefined;
  detail: Detail | null; // 선택 종목 상세 (같은 종목일 때만 표시)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box marginRight={2}>
      <Text dimColor>{label} </Text>
      <Text>{value}</Text>
    </Box>
  );
}

export function QuotePanel({ quote, detail }: Props) {
  // detail 이 현재 종목과 같을 때만 사용
  const d = quote && detail && detail.symbol === quote.symbol ? detail : null;
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold color="yellow">
        QUOTE
      </Text>
      {!quote && <Text dimColor>select a symbol</Text>}
      {quote && quote.error && (
        <Text color="red">
          {quote.symbol}: {quote.error}
        </Text>
      )}
      {quote && !quote.error && (
        <>
          <Box>
            <Text bold>{quote.symbol} </Text>
            {d?.name && <Text dimColor>{d.name} </Text>}
            <Text bold color={changeColor(quote.change_pct)}>
              {fmtPrice(quote.price)} {arrow(quote.change_pct)} {fmtChange(quote.change)} (
              {fmtPct(quote.change_pct)})
            </Text>
          </Box>
          <Box marginTop={1}>
            <Field label="시가" value={fmtPrice(quote.open)} />
            <Field label="고가" value={fmtPrice(quote.high)} />
            <Field label="저가" value={fmtPrice(quote.low)} />
            <Field label="전일" value={fmtPrice(quote.prev_close)} />
          </Box>
          {/* 상세는 항상 고정 1줄로 렌더 (종목 변경 시 높이 변동 → 깜빡임 방지).
              detail 미도착이면 placeholder, wrap 없이 truncate. */}
          <Box marginTop={1}>
            <Text wrap="truncate-end">
              {d ? (
                <>
                  {d.week52_high != null && (
                    <Text>
                      <Text dimColor>52주 </Text>
                      {fmtPrice(d.week52_low)}~{fmtPrice(d.week52_high)}{'  '}
                    </Text>
                  )}
                  {d.volume != null && (
                    <Text>
                      <Text dimColor>거래량 </Text>
                      {fmtBig(d.volume)}{'  '}
                    </Text>
                  )}
                  {d.pe != null && (
                    <Text>
                      <Text dimColor>PER </Text>
                      {d.pe.toFixed(1)}{'  '}
                    </Text>
                  )}
                  {d.market_cap != null && (
                    <Text>
                      <Text dimColor>시총 </Text>
                      {fmtBig(d.market_cap * 1e6)}{'  '}
                    </Text>
                  )}
                  {d.industry ? (
                    <Text>
                      <Text dimColor>업종 </Text>
                      {d.industry}
                    </Text>
                  ) : d.exchange ? (
                    <Text>
                      <Text dimColor>거래소 </Text>
                      {d.exchange}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text dimColor>상세 불러오는 중…</Text>
              )}
            </Text>
          </Box>
          {/* 스파크라인도 항상 1줄 차지 (없으면 빈 줄) — 높이 고정으로 깜빡임 방지 */}
          <Box marginTop={1}>
            <Text color={changeColor(quote.change_pct)}>
              {quote.spark.length > 1 ? sparkline(quote.spark, 40) : ' '}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>updated {fmtTime(quote.updated_at)}</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
