# fin-term

터미널에서 보는 블룸버그 스타일 금융 대시보드. 실시간 시세 + 영문/한글 뉴스 스트림을 한 화면에. **API 키 없이 바로 동작**합니다.

<img width="1392" height="1522" alt="image" src="https://github.com/user-attachments/assets/2377850b-20ff-4f5c-93f9-0c398b4018fa" />

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

화면 하단 입력줄에서 `:` 를 누르면 명령 입력. 종목 이동은 방향키.

| 명령 | 동작 |
|----|----|
| `:add NVDA` | 관심종목 추가 |
| `:rm NVDA` | 관심종목 제거 |
| `:news AAPL` | 특정 종목 뉴스만 필터 |
| `:news` | 필터 해제 (전체 뉴스) |
| `:lang ko` | 한글 표시 (영문 헤드라인도 번역, DeepL 키 필요) |
| `:lang en` | 영문 표시 |
| `:lang` | 한↔영 전환 |
| `:open N` | N번째 뉴스를 브라우저로 열기 |
| `:q` | 종료 |
| `↑` `↓` (또는 `j` `k`) | 종목 선택 이동 |

뉴스 헤드라인은 **클릭하면 바로 기사로 이동**합니다 (iTerm2 / WezTerm / 최신 macOS 터미널 등 하이퍼링크 지원 터미널). 클릭이 안 되는 터미널이면 뉴스 왼쪽 번호를 보고 `:open 3` 처럼 여세요.

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
