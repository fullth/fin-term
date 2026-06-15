# fin-term 학습 기능 5종 설계

## 목적
fin-term TUI를 단순 시세 뷰어에서 주식 학습 도구로 확장. 핫 종목 발견, 종목 상세, 용어 풀이, 예측 일지, 지수 현황을 추가한다.

## 기능 5종

### 1. 핫 종목 패널 (watchlist 분리)
- 거래량 급등 상위 5개 표시. Yahoo `day_gainers` 스크리너 사용 (키 불필요).
- `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=5`
- watchlist와 별개 패널. `:hot` 명령으로 오버레이 표시.
- poller가 60s 주기로 폴링.

### 2. 종목 상세 (QUOTE 패널 확장, 기본 내장)
- 선택 종목의 OHLC 아래에 상세 한~두 줄 추가.
- 키 없이: 거래소, 통화, 52주 고/저, 거래량 (chart meta에서).
- `FINNHUB_KEY` 있으면 보강: PER, 시총, 업종, 배당 (Finnhub `/stock/metric`, `/stock/profile2`).
- 상세는 종목 선택 시 lazy fetch + 캐시.

### 3. 용어 풀이 (`:explain`)
- `:explain PER` → Claude가 쉬운 한국어 설명. brief.ts 패턴 재사용.
- `ANTHROPIC_API_KEY` 없으면 안내만.
- ExplainPanel 오버레이로 표시, Esc 닫기.

### 4. 예측 일지 (`:predict`, AI 평가)
- `~/.fin-term/journal.json` 영속 (watchlist 영속 패턴 재사용).
- `:predict AAPL up 실적호조` → 종목/방향(up|down)/근거/현재가/날짜 저장.
- 예측 시 Claude가 근거 타당성 한 줄 피드백 (키 있으면).
- `:journal` → 목록 + 각 예측의 당시가 vs 현재가 비교 (맞춤/틀림).
- JournalPanel 오버레이.

### 5. 지수 현황판 (`:indices`)
- S&P500(^GSPC), 나스닥(^IXIC), 다우(^DJI), 코스피(^KS11), 코스닥(^KQ11).
- chart API 재사용 (quote.ts fetchQuote에 지수 심볼 그대로 통과).
- IndicesPanel 오버레이.

## 레이아웃 — 오버레이 방식
메인(watchlist + quote확장 + news)은 상시. 나머지는 명령으로 여는 오버레이.
한 번에 하나의 오버레이만 표시 (brief/search/explain/journal/hot/indices 상호 배타).
Esc로 닫기. 기존 brief/search Esc 처리 확장.

## 파일 구조
```
sources/
  hot.ts        핫종목 스크리너
  detail.ts     종목상세 (chart meta + finnhub 보강)
  explain.ts    용어풀이 (Claude)
core/
  journal.ts    예측일지 영속 + 평가
  store.ts      overlay 상태 통합 (hot/indices/journal/explain/detail)
  poller.ts     핫종목 폴링 추가
ui/
  HotPanel.tsx
  IndicesPanel.tsx
  JournalPanel.tsx
  ExplainPanel.tsx
  QuotePanel.tsx (상세 확장)
  App.tsx (명령/오버레이 라우팅)
```

## 상태 모델 (store)
기존 `brief`, `searchResults` 처럼 각 오버레이를 독립 nullable 상태로:
- `hot: HotItem[] | null`
- `indices: Quote[] | null`
- `detail: Detail | null` (선택 종목 상세, QUOTE 패널 인라인이므로 오버레이 아님)
- `explain: { term, text, loading } | null`
- `journal: JournalEntry[] | null` (패널 표시 토글)
오버레이는 "마지막에 연 것" 우선. 단순화: 새 오버레이 열면 다른 오버레이 닫음.

## 단계
- Phase A: 종목상세 + 지수현황 + 핫종목 (키 불필요, 데이터 검증 완료)
- Phase B: 용어풀이 + 예측일지 (Claude 의존)

## 데이터 검증 결과 (사전 확인)
- day_gainers 스크리너: 동작 (ROKU 등 5개 반환)
- chart meta: longName/거래소/통화/52주고저/거래량 제공 (PER/시총 없음)
- quoteSummary v10, v7 quote: crumb/auth 막힘 → 상세는 chart meta + Finnhub로

## 비기능
- 키 없는 기능(핫종목/지수/상세 일부)은 항상 동작.
- Claude 기능(explain/predict 평가)은 키 없으면 비활성 + 안내.
- 오버레이 추가로 출력 높이 늘면 measureElement 기반 newsRows가 자동 축소 (깜빡임 방지 유지).
- 영속 파일 손상/실패는 조용히 무시 (기존 persist 패턴).
