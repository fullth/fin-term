# fin-term

[![npm version](https://img.shields.io/npm/v/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![npm downloads](https://img.shields.io/npm/dm/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![node](https://img.shields.io/node/v/fin-term.svg)](https://www.npmjs.com/package/fin-term)
[![license](https://img.shields.io/npm/l/fin-term.svg)](https://github.com/fullth/fin-term/blob/master/LICENSE)

터미널에서 보는 블룸버그 스타일 금융 대시보드. 실시간 시세 + 영문/한글 뉴스 스트림을 한 화면에. **API 키 없이 바로 동작**합니다.

<img width="1392" height="1522" alt="image" src="https://github.com/user-attachments/assets/16b8f636-d83c-4b3f-9f24-b92eeac872ce" />

- 좌상단: 관심종목 시세 (가격 / 변동% / ▲▼)
- 우상단: 선택 종목 상세 (시가·고가·저가·전일종가 + 인트라데이 스파크라인)
- 하단: 영문/한글 뉴스 스트림 (최신순, `[MKT]` / `[종목]` 태그)

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

| 명령 | 동작 |
|----|----|
| `:search apple` | 회사명/심볼로 종목 검색 → 결과에서 ↑↓ 선택 후 Enter 로 추가 |
| `:add NVDA` | 심볼 직접 추가 |
| `:rm NVDA` | 관심종목 제거 |
| `:news AAPL` | 특정 종목 뉴스만 필터 |
| `:news` | 필터 해제 (전체 뉴스) |
| `:lang ko` | 한글 표시 (영문 헤드라인도 번역, DeepL 키 필요) |
| `:lang en` | 영문 표시 |
| `:lang` | 한↔영 전환 |
| `:open N` | N번째 뉴스를 브라우저로 열기 |
| `:brief` | AI 시장 브리핑 생성 (Claude, `ANTHROPIC_API_KEY` 필요) |
| `:hot` | 핫 종목 패널 새로고침 (거래량 급등, 하단 상시 표시) |
| `:indices` | 지수 패널 새로고침 (S&P / 나스닥 / 다우 / 코스피 / 코스닥, 하단 상시) |
| `:explain PER` | 용어 풀이 (Claude, `ANTHROPIC_API_KEY` 필요) |
| `:predict AAPL up 실적호조` | 예측 일지에 기록 (방향 up/down + 근거) |
| `:journal` | 예측 일지 패널 새로고침 (하단 상시) |
| `:q` | 종료 |

핫 종목·지수 현황·예측 일지는 **화면 하단에 가로 3분할로 상시 표시**됩니다 (핫종목/지수는 60초마다 자동 갱신). 뉴스 스트림은 그 아래로 스크롤해서 봅니다.

화면 상단에는 **종목 검색칸 / 용어 풀이칸** 이 상시 표시됩니다. `Tab` 으로 검색칸에 포커스를 옮긴 뒤 바로 입력하고 `Enter` 를 누르면 됩니다 (콜론 명령 `:search` / `:explain` 도 그대로 동작). 종목을 선택하면 QUOTE 패널에 회사명·52주 고저·거래량이 함께 표시됩니다. `FINNHUB_KEY` 가 있으면 PER·시총·업종도 보강됩니다. `:predict` 로 예측을 기록하면 `ANTHROPIC_API_KEY` 가 있을 때 Claude 가 근거를 한 줄 평가하고, `:journal` 에서 나중에 실제가와 비교해 적중 여부를 봅니다.

`:brief` 는 관심종목 시세와 최근 뉴스를 묶어 Claude 가 "오늘 시장 한 줄 요약 + 주요 테마 + 내 종목 영향" 을 한국어로 생성합니다. `ANTHROPIC_API_KEY` 환경변수가 있어야 동작하며, 호출 비용이 발생합니다. `Esc` 로 닫습니다.

종목 심볼을 모르면 `:search 회사명` (예: `:search tesla`, `:search 005930`) 으로 찾아 추가하세요. 한국 종목은 6자리 코드(`005930`)로 검색됩니다.

뉴스 헤드라인은 **클릭하면 바로 기사로 이동**합니다 (iTerm2 / WezTerm / 최신 macOS 터미널 등 하이퍼링크 지원 터미널). 클릭이 안 되는 터미널이면 NEWS 패널에서 `Tab` → `↑↓` → `Enter`, 또는 왼쪽 번호로 `:open 3`.

## 옵션 (환경변수, 전부 선택)

키 없이도 동작하지만, 넣으면 기능이 늘어납니다.

```bash
# 예: 한글 모드로 시작 + 관심종목 지정
FIN_LANG=ko FIN_WATCHLIST=AAPL,TSLA,NVDA fin-term
```

| 환경변수 | 효과 |
|----|----|
| `FIN_WATCHLIST` | 시작 관심종목 (쉼표 구분, 예: `AAPL,TSLA`). 기본 `AAPL,TSLA,NVDA,MSFT` |
| `FIN_LANG` | 시작 표시 언어 `en` 또는 `ko` (기본 `en`) |
| `FINNHUB_KEY` | 있으면 시세를 [Finnhub](https://finnhub.io) 우선 사용 (무료 가입) |
| `DEEPL_KEY` | 있으면 `:lang ko` 에서 영문 헤드라인을 한글로 번역 ([DeepL 무료](https://www.deepl.com/pro-api)) |
| `ANTHROPIC_API_KEY` | 있으면 `:brief` AI 시장 브리핑 활성화 ([Claude API](https://console.anthropic.com), 유료) |
| `FIN_QUOTE_MS` | 시세 갱신 주기(ms), 기본 10000 |
| `FIN_NEWS_MS` | 뉴스 갱신 주기(ms), 기본 60000 |

## 데이터 출처

| 데이터 | 출처 | 키 |
|----|----|----|
| 시세 / 차트 | Yahoo 공개 chart API | 불필요 |
| 시세 (우선) | Finnhub | `FINNHUB_KEY` 있을 때 |
| 영문 뉴스 | RSS (Yahoo / CNBC / MarketWatch) | 불필요 |
| 한글 뉴스 | RSS (한경 / 매경증권 / 연합경제) | 불필요 |
| 영문→한글 번역 | DeepL | `DEEPL_KEY` 있을 때 |

한글 뉴스는 키 없이 원문 그대로 나옵니다. 영문 헤드라인까지 한글로 보려면 DeepL 키를 넣고 `:lang ko`.

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
  sources/   quote.ts (Yahoo/Finnhub), rss.ts (뉴스), translate.ts (DeepL)
  core/      store.ts (상태), poller.ts (폴링), ticker-tag.ts (종목 매칭), open-url.ts, types.ts
  ui/        App.tsx + Watchlist / QuotePanel / NewsStream / CommandBar
  config.ts  환경변수 로딩
  index.tsx  진입점
```

## 라이선스

MIT
