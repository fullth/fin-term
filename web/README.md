# fin-term web

fin-term TUI 를 동일한 블룸버그 스타일 UI 로 재구현한 React DOM 웹앱.
같은 데이터 레이어(`src/sources/*`)를 BFF 가 재사용하고, UI 만 HTML/CSS 로 새로 그린다.
반응형·마우스·모바일·테마(다크/라이트)를 지원한다.

## 구조

```
web/
  server/   BFF — Express. sources/* 를 /api 로 노출 + SSE(시세·업비트) 중계.
  client/   Vite + React. 블룸버그 룩 패널 (주식: Watchlist/Quote/News/지수/환율/급상승/AI · 코인 모드).
```

브라우저는 외부 API(Yahoo·Naver·RSS·업비트)를 CORS·시크릿 때문에 직접 못 부른다.
그래서 BFF 가 대신 호출해 `/api/*` 로 중계한다.

## 기능

- **주식 모드**: 관심종목 시세(SSE 실시간), 종목 상세+스파크라인, 영문/한글 뉴스(국내/해외/전체), 지수·환율·급상승 종목
- **코인 모드**: 업비트 KRW 시세(웹소켓 실시간)·1h/24h/7d 변동·7일 스파크라인, 코인 검색(업비트 상장), 코인 뉴스
- **AI 기능**: 시장 브리핑·용어 풀이 (Anthropic 키 필요 — 브라우저에 입력, localStorage 보관)
- **웹 전용**: 종목별 뉴스 필터, URL 상태 공유(`?mode=&sym=`), 키보드 단축키(`/` 검색·`j/k` 이동·`m` 모드·`Esc`), 다크/라이트 테마
- 관심종목·코인 목록·테마는 localStorage 에 저장돼 유지된다.

## 로컬 실행

```bash
# 1) BFF (기본 8787)
cd web/server && npm install && npm run dev

# 2) 클라이언트 (5173, /api 는 8787 로 프록시)
cd web/client && npm install && npm run dev
# → http://localhost:5173
```

키 없이 미국 주요 종목 시세 + 영문/한글 뉴스 + 코인 시세가 바로 뜬다.
AI 키(Anthropic)는 앱 상단 "AI 키" 칩에서 입력하며 브라우저에만 저장된다.
`FINNHUB_KEY`(시세 보강)·`ANTHROPIC_API_KEY`(AI fallback)는 서버 env 로도 주입 가능.

## 운영 빌드 (단일 서비스)

BFF 가 client 정적 빌드까지 한 포트로 서빙한다.

```bash
# 레포 루트에서
npm install                              # 루트 의존성 (server 가 src/sources 를 참조)
npm --prefix web/client install && npm --prefix web/client run build
PORT=9191 npm --prefix web/server start  # → http://localhost:9191
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| GET | `/api/quotes?symbols=AAPL,TSLA` | 시세 |
| GET | `/api/markets` | 지수·환율·원자재 (서버 공유 캐시) |
| GET | `/api/news?scope=all&watchlist=...` | RSS 뉴스 + 티커 태깅 |
| GET | `/api/detail/:symbol` | 종목 상세 (52주·거래량·PER·시총) |
| GET | `/api/search?q=...` | 종목 검색 (국내/해외) |
| GET | `/api/hot` | 급상승 종목 (상승률 상위) |
| GET | `/api/crypto?coins=id:SYM:KRW-SYM,...` | 코인 시세·변동·스파크라인 (업비트) |
| GET | `/api/crypto/search?q=...` | 코인 검색 (업비트 KRW 상장) |
| GET | `/api/crypto/news` | 코인 뉴스 (구글 뉴스 RSS) |
| POST | `/api/brief` | AI 시장 브리핑 (`X-AI-Key` 헤더 또는 서버 키) |
| GET | `/api/explain?term=...` | AI 용어 풀이 (`X-AI-Key`) |
| GET | `/api/ai-status` | 서버 env AI 키 보유 여부 |
| GET (SSE) | `/api/stream/quotes?symbols=...` | 시세·마켓 실시간 push |
| GET (SSE) | `/api/stream/crypto?markets=...` | 업비트 실시간 체결가 중계 |

## 배포 (Railway)

Railway + Nixpacks 단일 서비스. BFF 가 client 정적까지 서빙하고, SSE 도 Railway 에서 동작한다.

배포 파일 (레포 루트):
- `railway.json` — 빌더(NIXPACKS), startCommand, healthcheckPath(`/health`)
- `nixpacks.toml` — 루트 의존성 설치 → client(Vite) 빌드 → server(tsx) 구동

루트에 배포 파일이 있어 **Root Directory 설정 없이** 동작한다 (Railway 가 레포 루트의
`nixpacks.toml` 을 인식). server 가 `src/sources/*` 를 import 하므로 루트 의존성 설치가 필요하다.

Railway 설정:
1. New Project → Deploy from GitHub repo (fin-term)
2. 환경변수(선택): `FINNHUB_KEY`, `ANTHROPIC_API_KEY` — 없어도 무키 동작. `PORT` 자동 주입
3. push 시 자동 빌드·배포. 헬스체크 `/health` 통과하면 라이브

## 미구현 (후속)

- 코인 차트 기간 전환(1분/1시간/일/주), 보유자산·알림 (TUI 코인 모드 고급 기능)
- 뉴스 가상 스크롤/페이지네이션 (현재 전체 렌더)
