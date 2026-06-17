# fin-term

[![npm version](https://img.shields.io/npm/v/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![npm downloads](https://img.shields.io/npm/dm/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![node](https://img.shields.io/node/v/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![license](https://img.shields.io/npm/l/fin-term.svg)](https://github.com/fullth/fin-term/blob/master/LICENSE)

블룸버그 터미널 스타일의 TUI를 구현하였습니다.  
실시간 시세 + 영문/한글 뉴스 스트림을 한 화면에 확인할 수 있습니다.

## 대시보드 화면
**API 키 없이 바로 동작**합니다.
<img width="1392" height="1522" alt="image" src="https://github.com/user-attachments/assets/16b8f636-d83c-4b3f-9f24-b92eeac872ce" />
- 좌상단: 관심종목 시세 (가격 / 변동% / ▲▼)
- 우상단: 선택 종목 상세 (시가·고가·저가·전일종가 + 인트라데이 스파크라인)
- 하단: 영문/한글 뉴스 스트림 (최신순, `[MKT]` / `[종목]` 태그)
## 브리핑 화면
**요약은 API 키를 필요로 합니다**
<img width="1392" height="1522" alt="image" src="https://github.com/user-attachments/assets/864a22bd-b6c0-4b7e-90a3-020a48129f3d" />

## 빠른 시작
Node.js 18 이상 필요. ([설치 안 됐으면 nodejs.org](https://nodejs.org))

```bash
# 한 번만 실행 (설치 없이)
npx fin-term
```

```bash
# 자주 쓸 거면 전역 설치
npm install -g fin-term
fin-term
```

실행하면 바로 시세와 뉴스가 뜹니다. 종료는 `:q` 또는 `q`.

> 키 없이도 미국 주요 종목 시세 + 영문/한글 뉴스가 다 나옵니다. 키는 전부 선택입니다(아래 참조).

## 사용법

`Tab` 으로 **WATCHLIST ↔ NEWS** 패널을 오가고, 포커스된 패널에서 `↑` `↓` 로 이동합니다 (포커스된 패널은 테두리가 하늘색 ●). 화면 하단 입력줄에서 `:` 를 누르면 명령 입력.

### 키

| 키 | 동작 |
|----|----|
| `Tab` | WATCHLIST ↔ NEWS 패널 포커스 전환 |
| `↑` `↓` (또는 `j` `k`) | 포커스된 패널에서 커서 이동 (종목 / 뉴스) |
| `Enter` | NEWS 포커스면 선택 뉴스 열기 · 검색 결과면 종목 추가 |
| `/` | 빠른 종목 검색 (`:search ` 프리필) |
| `Esc` | 검색 패널 닫기 |
| `q` | 종료 |

### 명령

약어(첫 글자)와 전체 명령 둘 다 동작합니다. 예: `:b` = `:brief`.

| 약어 | 전체 | 동작 |
|----|----|----|
| `:s apple` | `:search` | 회사명/심볼로 종목 검색 → 결과에서 ↑↓ 선택 후 Enter 로 추가 |
| `:a NVDA` | `:add` | 심볼 직접 추가 |
| `:rm NVDA` | `:remove` | 관심종목 제거 |
| `:n AAPL` | `:news` | 특정 종목 뉴스만 필터 (`:n` 만 치면 해제) |
| `:sc` | `:scope` | 국내→해외→전체 순환 (`:sc domestic`/`foreign`/`all` 직접 지정) |
| `:o N` | `:open` | N번째 뉴스를 브라우저로 열기 |
| `:b` | `:brief` | AI 시장 브리핑 생성 (Claude, `ANTHROPIC_API_KEY` 필요) |
| `:h` | `:hot` | 핫 종목 패널 새로고침 (거래량 급등, 하단 상시 표시) |
| `:i` | `:indices` | 지수 패널 새로고침 (S&P / 나스닥 / 다우 / 코스피 / 코스닥, 하단 상시) |
| `:e PER` | `:explain` | 용어 풀이 (Claude, `ANTHROPIC_API_KEY` 필요) |
| `:r` | `:refresh` | 시세·뉴스 즉시 새로고침 |
| `:crypto` | `:coin` | 코인 모드 진입 (`m` 키 / 좌상단 `[코인]` 탭 클릭도 가능) |
| `:q` | `:quit` | 종료 |

해외(영문) 뉴스는 번역 없이 원문 그대로 표시됩니다.

핫 종목·지수 현황·환율/원자재는 **화면 하단에 가로 3분할로 상시 표시**됩니다 (60초마다 자동 갱신). 환율/원자재 패널은 달러/원·달러인덱스·WTI 유가·금·비트코인 시세를 키 없이 보여줍니다. 뉴스 스트림은 그 아래로 스크롤해서 봅니다.

화면 상단에는 **종목 검색칸 / 용어 풀이칸** 이 상시 표시됩니다. `Tab` 으로 검색칸에 포커스를 옮긴 뒤 바로 입력하고 `Enter` 를 누르면 됩니다 (콜론 명령 `:search` / `:explain` 도 그대로 동작). 종목을 선택하면 QUOTE 패널에 회사명·52주 고저·거래량이 함께 표시됩니다. `FINNHUB_KEY` 가 있으면 PER·시총·업종도 보강됩니다.

`:brief` 는 관심종목 시세와 최근 뉴스를 묶어 Claude 가 "오늘 시장 한 줄 요약 + 주요 테마 + 내 종목 영향" 을 한국어로 생성합니다. `ANTHROPIC_API_KEY` 환경변수가 있어야 동작하며, 호출 비용이 발생합니다. `Esc` 로 닫습니다.

종목 심볼을 모르면 `:search 회사명` (예: `:search tesla`, `:search 005930`) 으로 찾아 추가하세요. 한국 종목은 한글 회사명(예: `삼성`, `카카오`)이나 6자리 코드(`005930`)로도 검색됩니다.

뉴스 헤드라인은 **클릭하면 바로 기사로 이동**합니다 (iTerm2 / WezTerm / 최신 macOS 터미널 등 하이퍼링크 지원 터미널). 클릭이 안 되는 터미널이면 NEWS 패널에서 `Tab` → `↑↓` → `Enter`, 또는 왼쪽 번호로 `:open 3`.

## 코인 모드 (업비트 KRW)

좌상단 **`[코인]` 탭**(클릭 또는 `m` 키, `:crypto` 명령)을 누르면 화면 전체가 코인 모니터로 바뀝니다. 코인목록 · 시세상세 · 캔들차트 · 보유요약 · 알림 · 코인뉴스를 한 화면에 보여주며, 업비트 웹소켓으로 BTC·ETH·XRP·BCH 원화 시세를 실시간 수신합니다. 키 불필요.

코인 모드 키:

| 키 | 동작 |
|----|----|
| `↑` `↓` | 코인 선택 |
| `←` `→` | 차트 기간 (1분 / 1시간 / 24시간 / 7일 / 1달) |
| `1`~`4` | 코인 바로가기 |
| `r` | 새로고침 · `s` 금액 마스킹 |
| `q` 또는 `m` | 주식 모드로 복귀 |

보유 내역은 `~/.fin-term/holdings.json` 에 둡니다 (없으면 시세만, 손익 없이 동작):

```json
[
  { "id": "bitcoin",      "symbol": "BTC", "quantity": 0.1234, "avg_buy_krw": 110000000, "buy_amount_krw": 13580246 },
  { "id": "ethereum",     "symbol": "ETH", "quantity": 1.2345, "avg_buy_krw": 3500000,   "buy_amount_krw": 4320988 },
  { "id": "ripple",       "symbol": "XRP", "quantity": 1234.5,  "avg_buy_krw": 2300 },
  { "id": "bitcoin-cash", "symbol": "BCH", "quantity": 4.5678,  "avg_buy_krw": 550000 }
]
```

- `id` 는 업비트 마켓 매핑 키 (`bitcoin`/`ethereum`/`ripple`/`bitcoin-cash`)
- `buy_amount_krw` 를 생략하면 `quantity × avg_buy_krw` 로 자동 계산
- 보유 수익률이 5% 단위(±5%, ±10%, …)를 돌파하면 macOS 데스크톱 알림 + 패널 알림 로그. macOS 외 환경은 알림 로그만.

## 옵션 (환경변수, 전부 선택)

키 없이도 동작하지만, 넣으면 기능이 늘어납니다.

```bash
# 예: 국내 뉴스만 보기 + 관심종목 지정
FIN_NEWS_SCOPE=domestic FIN_WATCHLIST=AAPL,TSLA,NVDA fin-term
```

| 환경변수 | 효과 |
|----|----|
| `FIN_WATCHLIST` | 시작 관심종목 (쉼표 구분, 예: `AAPL,TSLA`). 기본 `AAPL,TSLA,NVDA,MSFT` |
| `FIN_NEWS_SCOPE` | 시작 뉴스 범위 `domestic` / `foreign` / `all` (기본 `all`) |
| `FINNHUB_KEY` | 있으면 시세를 [Finnhub](https://finnhub.io) 우선 사용 (무료 가입) |
| `ANTHROPIC_API_KEY` | 있으면 `:brief` AI 시장 브리핑 활성화 ([Claude API](https://console.anthropic.com), 유료) |
| `FIN_QUOTE_MS` | 시세 갱신 주기(ms), 기본 10000 |
| `FIN_NEWS_MS` | 뉴스 갱신 주기(ms), 기본 60000 |
| `FIN_MODE` | `crypto` 면 코인 모드로 바로 시작 (기본 `stock`) |

## 데이터 출처

| 데이터 | 출처 | 키 |
|----|----|----|
| 시세 / 차트 | Yahoo 공개 chart API | 불필요 |
| 시세 (우선) | Finnhub | `FINNHUB_KEY` 있을 때 |
| 해외 뉴스 | RSS (Yahoo / CNBC / MarketWatch) | 불필요 |
| 국내 뉴스 | RSS (한경 / 동아경제 / 연합경제) | 불필요 |
| 코인 KRW 시세 / 캔들 | 업비트 (웹소켓 실시간 + REST 캔들) | 불필요 |
| 코인 시총·ATH | CoinGecko | 불필요 |
| 코인 뉴스 | 구글 뉴스 RSS (한국어) | 불필요 |

뉴스는 모두 원문 그대로 나옵니다 (번역 없음). `:scope` 로 국내·해외·전체를 즉시 전환합니다.

> 참고: 무료 공개 데이터라 블룸버그 대비 분 단위 지연이 있고, 채권·파생 등은 다루지 않습니다.

---

## 개발

소스에서 직접 실행하거나 고치려면:

```bash
git clone https://github.com/fullth/fin-term.git
cd fin-term
npm install
npm run dev        # tsx 로 바로 실행
# 빌드 후 실행
npm run build && npm start
```

```
src/
  sources/        quote.ts (Yahoo/Finnhub), rss.ts (뉴스)
  core/           store.ts (상태), poller.ts (폴링), ticker-tag.ts, open-url.ts, types.ts
  ui/             App.tsx + Watchlist / QuotePanel / NewsStream / CommandBar (주식 모드, Ink)
  crypto-monitor/ index.ts (코인 모드 — 업비트 실시간·캔들·보유·알림·뉴스, blessed)
  config.ts       환경변수 로딩
  index.tsx       진입점 — 주식(Ink)↔코인(blessed) 화면 전환 오케스트레이션
```

> 주식 모드는 Ink(React), 코인 모드는 blessed 로 그립니다. 두 렌더러가 stdin 을 동시에
> 잡지 않도록, 모드 전환 시 한쪽을 완전히 내린 뒤 다른 쪽을 띄웁니다.

## 라이선스

MIT
