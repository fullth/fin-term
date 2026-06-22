# fin-term web

fin-term TUI 를 동일한 블룸버그 스타일 UI 로 재구현한 React DOM 웹앱.
기존 `src/sources/*` 데이터 레이어를 BFF 가 그대로 재사용하고, UI 만 HTML/CSS 로 새로 그린다.

## 구조

```
web/
  server/   BFF — Express. sources/* 를 /api 로 노출 + SSE 시세 스트림. 시크릿 보관.
  client/   Vite + React. 블룸버그 룩 패널 (Watchlist/Quote/News/지수/환율/핫/브리핑).
```

브라우저는 외부 API(Yahoo·Naver·RSS·Finnhub)를 CORS·시크릿 때문에 직접 못 부른다.
그래서 BFF 가 대신 호출해 `/api/*` 로 중계한다.

## 로컬 실행

```bash
# 1) BFF (기본 8787)
cd web/server && npm install && npm run dev

# 2) 클라이언트 (5173, /api 는 8787 로 프록시)
cd web/client && npm install && npm run dev
# → http://localhost:5173
```

키 없이 미국 주요 종목 시세 + 영문/한글 뉴스가 바로 뜬다.
`FINNHUB_KEY` / `ANTHROPIC_API_KEY` 는 서버 env 로만 주입 (브라우저 비노출).

## 운영 빌드 (단일 서비스)

```bash
cd web/client && npm run build      # client/dist 생성
cd web/server && npm start          # dist 가 있으면 BFF 가 정적까지 함께 서빙
# → http://localhost:8787  (API + 웹 한 포트)
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/quotes?symbols=AAPL,TSLA` | 시세 |
| GET | `/api/markets` | 지수·환율·원자재 (서버 공유 캐시) |
| GET | `/api/news?scope=all&watchlist=...` | RSS 뉴스 + 티커 태깅 |
| GET | `/api/detail/:symbol` | 종목 상세 (52주·거래량·PER·시총) |
| GET | `/api/search?q=...` | 종목 검색 (국내/해외) |
| GET | `/api/hot` | 거래량 급등 종목 |
| POST | `/api/brief` | AI 시장 브리핑 (키 있을 때) |
| GET (SSE) | `/api/stream/quotes?symbols=...` | 시세·마켓 실시간 push |

## 배포 (Railway)

`to-high` 레포의 Railway + Nixpacks 패턴을 차용. BFF 단일 서비스가 client 정적까지 서빙한다.
SSE 는 Railway 에서 동작 검증됨.

배포 파일:
- `web/railway.json` — 빌더(NIXPACKS), startCommand, healthcheckPath(`/health`)
- `web/nixpacks.toml` — client 빌드 → server 구동 2단계
- `web/package.json` — `build`(client 빌드) / `start`(server 구동) 오케스트레이션

Railway 설정:
1. New Project → Deploy from GitHub repo (fin-term)
2. Service Settings → **Root Directory = `web`** (server 가 레포 루트 `src/sources/*` 를 참조하므로 레포 전체가 올라가야 함)
3. 환경변수(선택): `FINNHUB_KEY`, `ANTHROPIC_API_KEY` — 없어도 무키 동작. `PORT` 는 Railway 자동 주입
4. push 시 자동 빌드·배포. 헬스체크 `/health` 통과하면 라이브

로컬에서 프로덕션 모드 확인:
```bash
cd web && npm run build && PORT=9191 npm start   # http://localhost:9191
```

## 미구현 (후속)

- 코인 모드 (업비트 WS 중계)
- 뉴스 가상 스크롤/페이지네이션 (현재 전체 렌더)
- `:command` 단축키 전체 패리티
