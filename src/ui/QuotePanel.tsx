import React from 'react';
import { Box, Text } from 'ink';
import type { Quote } from '../core/types.js';
import { fmtPrice, fmtPct, fmtChange, arrow, changeColor, sparkline, fmtTime } from './format.js';

interface Props {
  quote: Quote | undefined;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box marginRight={2}>
      <Text dimColor>{label} </Text>
      <Text>{value}</Text>
    </Box>
  );
}

export function QuotePanel({ quote }: Props) {
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
            <Text bold color={changeColor(quote.change_pct)}>
              {fmtPrice(quote.price)} {arrow(quote.change_pct)} {fmtChange(quote.change)} (
              {fmtPct(quote.change_pct)})
            </Text>
          </Box>
          <Box marginTop={1}>
            <Field label="O" value={fmtPrice(quote.open)} />
            <Field label="H" value={fmtPrice(quote.high)} />
            <Field label="L" value={fmtPrice(quote.low)} />
            <Field label="PC" value={fmtPrice(quote.prev_close)} />
          </Box>
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
