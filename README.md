# fin-term

블룸버그 터미널 스타일 TUI. 실시간 시세 + 뉴스 스트림. 무료 데이터 소스만 사용.

## 데이터 소스

| 데이터 | 소스 | 키 |
|----|----|----|
| 시세/차트 | Yahoo 공개 chart API | 불필요 |
| 시세 (우선) | Finnhub | `FINNHUB_KEY` 있으면 |
| 뉴스 | RSS (Yahoo / CNBC / MarketWatch) | 불필요 |

키 없어도 전부 동작함. Finnhub 키는 시세 우선순위만 바꿈.

## 실행

```bash
npm install
npm run dev          # tsx 로 바로 실행
# 또는
npm run build && npm start
```

## 환경변수 (전부 선택)

```bash
FINNHUB_KEY=xxx          # 있으면 시세 우선
FIN_WATCHLIST=AAPL,TSLA  # 초기 관심종목
FIN_QUOTE_MS=10000       # 시세 폴링 주기
FIN_NEWS_MS=60000        # 뉴스 폴링 주기
```

## 명령 (블룸버그식 `:` prefix)

| 명령 | 동작 |
|----|----|
| `:add NVDA` | 관심종목 추가 |
| `:rm NVDA` | 관심종목 제거 |
| `:news AAPL` | 뉴스 종목 필터 |
| `:news` | 필터 해제 |
| `:q` | 종료 |
| `↑↓` / `j` `k` | 종목 선택 이동 |

## 구조

```
src/
  sources/   quote.ts (Yahoo/Finnhub), rss.ts (뉴스)
  core/      store.ts (상태), poller.ts (폴링), ticker-tag.ts (종목 매칭), types.ts
  ui/        App.tsx + Watchlist/QuotePanel/NewsStream/CommandBar
  config.ts  env 로딩
  index.tsx  진입점
```
