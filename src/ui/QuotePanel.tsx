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
          {d && (
            <Box marginTop={1} flexWrap="wrap">
              {d.week52_high != null && (
                <Field label="52주" value={`${fmtPrice(d.week52_low)}~${fmtPrice(d.week52_high)}`} />
              )}
              {d.volume != null && <Field label="거래량" value={fmtBig(d.volume)} />}
              {d.pe != null && <Field label="PER" value={d.pe.toFixed(1)} />}
              {d.market_cap != null && <Field label="시총" value={`${fmtBig(d.market_cap * 1e6)}`} />}
              {d.industry && <Field label="업종" value={d.industry} />}
              {d.exchange && !d.industry && <Field label="거래소" value={d.exchange} />}
            </Box>
          )}
          {quote.spark.length > 1 && (
            <Box marginTop={1}>
              <Text color={changeColor(quote.change_pct)}>{sparkline(quote.spark, 40)}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>updated {fmtTime(quote.updated_at)}</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
