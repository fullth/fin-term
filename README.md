# fin-term

블룸버그 터미널 스타일 TUI. 실시간 시세 + 뉴스 스트림. 무료 데이터 소스만 사용.

## 데이터 소스

| 데이터 | 소스 | 키 |
|----|----|----|
| 시세/차트 | Yahoo 공개 chart API | 불필요 |
| 시세 (우선) | Finnhub | `FINNHUB_KEY` 있으면 |
| 영문 뉴스 | RSS (Yahoo / CNBC / MarketWatch) | 불필요 |
| 한글 뉴스 | RSS (한경 / 매경증권 / 연합경제) | 불필요 |
| 영문→한글 번역 | DeepL | `DEEPL_KEY` 있으면 |

키 없어도 전부 동작함. 한글 뉴스는 키 없이 원문 한글 그대로. DeepL 키 있으면 영문 헤드라인도 `:lang ko` 로 번역 표시.

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
DEEPL_KEY=xxx            # 있으면 영문 헤드라인 한글 번역 (:lang ko)
FIN_WATCHLIST=AAPL,TSLA  # 초기 관심종목
FIN_LANG=ko              # 시작 표시 언어 (en|ko, 기본 en)
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
| `:lang ko` | 한글 표시 (영문 헤드라인 번역, DeepL 키 필요) |
| `:lang en` | 영문 표시 |
| `:lang` | en↔ko 토글 |
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
