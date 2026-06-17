import React from 'react';
import { Box, Text } from 'ink';
import type { Candle } from '../core/types.js';
import { fmtKrwCompact, fmtPct } from './format.js';

interface Props {
  symbol: string;
  timeframeLabel: string;
  candles: Candle[];
  avgBuyKrw: number | null; // 평균 매수가 (있으면 차트에 라인 라벨)
  width: number; // 셀 너비 (열 수)
  height: number; // 캔들 플롯 행 수
  focused: boolean;
}

// ASCII 캔들차트. 양봉=green, 음봉=red (fin-term 색상 규약).
export function CandleChart({
  symbol,
  timeframeLabel,
  candles,
  avgBuyKrw,
  width,
  height,
  focused,
}: Props) {
  const plotRows = Math.max(4, height);
  const innerWidth = Math.max(12, width);

  if (candles.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={1}
      >
        <Text bold color="yellow">
          {symbol} {timeframeLabel} 캔들
        </Text>
        <Text dimColor>차트 불러오는 중… (←→ 기간)</Text>
      </Box>
    );
  }

  const first = candles[0].open;
  const last = candles[candles.length - 1].close;
  const highPrice = Math.max(...candles.map((c) => c.high));
  const lowPrice = Math.min(...candles.map((c) => c.low));
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const trendColor = changePct >= 0 ? 'green' : 'red';

  // 캔들은 두 칸당 하나(본문+간격). 폭에 맞춰 최근 것 위주 샘플링.
  const slots = Math.max(6, Math.floor(innerWidth / 2));
  let sampled = candles;
  if (candles.length > slots) {
    const step = Math.max(1, Math.ceil(candles.length / slots));
    sampled = candles.filter((_, i) => i % step === 0).slice(-slots);
  }

  const span = highPrice - lowPrice;
  const padding = span === 0 ? Math.max(last * 0.01, 1) : span * 0.08;
  const minPrice = Math.max(0, lowPrice - padding);
  const maxPrice = highPrice + padding;
  const range = Math.max(maxPrice - minPrice, 1);

  const toRow = (price: number) => {
    const scaled = ((maxPrice - price) / range) * (plotRows - 1);
    return Math.max(0, Math.min(plotRows - 1, Math.round(scaled)));
  };

  // 셀 = { 문자, 색 }. 색이 없으면 흰색 위크.
  type Cell = { ch: string; color: string };
  const cells: Cell[][] = Array.from({ length: plotRows }, () =>
    Array.from({ length: innerWidth }, () => ({ ch: ' ', color: 'gray' })),
  );

  sampled.forEach((candle, i) => {
    const x = Math.min(innerWidth - 1, i * 2);
    const wickTop = toRow(candle.high);
    const wickBottom = toRow(candle.low);
    const openRow = toRow(candle.open);
    const closeRow = toRow(candle.close);
    const color = candle.close >= candle.open ? 'green' : 'red';
    const bodyTop = Math.min(openRow, closeRow);
    const bodyBottom = Math.max(openRow, closeRow);

    for (let r = wickTop; r <= wickBottom; r += 1) cells[r][x] = { ch: '│', color: 'white' };
    if (bodyTop === bodyBottom) {
      cells[bodyTop][x] = { ch: '■', color };
    } else {
      for (let r = bodyTop; r <= bodyBottom; r += 1) cells[r][x] = { ch: '█', color };
    }
  });

  return (
    <Box
      flexDirection="column"
      width={innerWidth + 4} // 셀 폭 + border(2) + paddingX(2) — 그리드와 박스 폭 일치
      borderStyle="round"
      borderColor={focused ? 'cyan' : trendColor}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="yellow">
          {symbol} {timeframeLabel} {focused && <Text dimColor>●</Text>}
        </Text>
        <Text color={trendColor}>
          {fmtKrwCompact(last)} {fmtPct(changePct)}
        </Text>
      </Box>
      <Text dimColor>
        고 {fmtKrwCompact(highPrice)} · 저 {fmtKrwCompact(lowPrice)}
        {avgBuyKrw != null ? ` · 평단 ${fmtKrwCompact(avgBuyKrw)}` : ''}
      </Text>
      {cells.map((row, ri) => (
        <Text key={ri}>
          {row.map((cell, ci) => (
            <Text key={ci} color={cell.color}>
              {cell.ch}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}
