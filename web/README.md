# fin-term web
<img width="1819" height="1522" alt="image" src="https://github.com/user-attachments/assets/225d3442-a5dc-4c16-88c7-3d544303364f" />

fin-term TUI 를 동일한 블룸버그 스타일 UI 로 재구현한 React DOM 웹앱.
같은 데이터 레이어(`src/sources/*`)를 BFF 가 재사용하고, UI 만 HTML/CSS 로 새로 그린다.
반응형, 마우스, 모바일, 업무 화면, Excel 위장, Terminal 화면을 지원한다.

## 구조

```
web/
  server/   BFF — Express. sources/* 를 /api 로 노출 + SSE(시세·업비트) 중계.
  client/   Vite + React. 블룸버그 룩 패널 (대시보드, 투자일지, Terminal, Excel).
```

브라우저는 외부 API(Yahoo·Naver·RSS·업비트)를 CORS·시크릿 때문에 직접 못 부른다.
그래서 BFF 가 대신 호출해 `/api/*` 로 중계한다.

## 기능

- **대시보드**: 주식과 코인의 관심목록, 선택 자산 상세, 시장 지표, 뉴스를 두 레인으로 나란히 표시하고 상단에 교차시장 신호 요약 제공
- **주식**: 관심종목 시세(SSE, 약 1분 간격 갱신), 종목 상세와 스파크라인, 영문/한글 뉴스(국내/해외/전체), 지수, 환율·원자재
- **코인**: 업비트 KRW 시세(웹소켓 실시간, 구독한 코인만 중계), 1h/24h/7d 변동, 7일 스파크라인, 코인 검색(업비트 상장), 코인 뉴스
- **오늘의 AI 브리핑**: 서버가 매일 오전 7시(KST) 이후 하루 한 번 생성해 모든 사용자에게 공개. 생성에 실패하면 10분 뒤 다시 시도
- **투자일지**: 브리핑별로 내 판단, 실행 계획, 생각을 바꿀 조건을 기록. 브라우저에만 저장하며 JSON 내보내기 제공
- **Terminal**: 오늘 브리핑, 주식·코인 시세, 뉴스로 시작하는 명령형 화면과 명령 버튼
- **업무 화면**: 상승과 하락 색상을 차분한 회색 계열로 낮추고 문의·후원 버튼을 숨기는 보기 옵션
- **Excel 위장**: 종합, 주식, 코인, 뉴스, 급상승 시트에 실제 데이터를 표시하고 리본에서 주식과 코인을 통합 검색 및 추가
- **연결 상태**: SSE 연결, 재연결, 데이터 지연, 마지막 갱신 시각 표시
- **뉴스 정리**: 중복 제목 제거, 중요도 정렬, 핵심/속보/최신 보기와 렌더 개수 제한
- **알림**: 도구 / 설정 메뉴에서 주식·코인 가격 변동 알림을 종목별로 설정. 속보는 소리 없이 화면 알림만 표시
- **키보드 단축키**: `/` 종목 검색, `j/k` 관심종목 이동, `` ` `` Excel 위장, `Esc` 뉴스 필터 해제
- 관심종목, 코인 목록, 마지막 선택 자산, 뉴스 범위, Terminal 및 업무 화면 사용 상태는 localStorage 에 저장돼 유지된다.

## 로컬 실행

```bash
# 1) BFF (기본 8787)
cd web/server && npm install && npm run dev

# 2) 클라이언트 (5173, /api 는 8787 로 프록시)
cd web/client && npm install && npm run dev
# → http://localhost:5173
```

키 없이 미국 주요 종목 시세 + 영문/한글 뉴스 + 코인 시세가 바로 뜬다.
`FINNHUB_KEY`(시세 보강)와 `ANTHROPIC_API_KEY`(오늘의 AI 브리핑 생성)는 서버 env 로 주입한다. 키가 없으면 브리핑 없이 동작한다.

`npm --prefix web/client run test:ui` 스모크 스크립트는 예전 화면 구성(시장 모드 전환, 화면 비율 조절) 기준이라 현재 화면과 맞지 않는다.

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
| GET | `/api/quotes?symbols=AAPL,TSLA` | 시세 (심볼 최대 50개) |
| GET | `/api/markets` | 지수·환율·원자재 (서버 공유 캐시) |
| GET | `/api/news?scope=all&watchlist=...` | RSS 뉴스 + 티커 태깅 |
| GET | `/api/detail/:symbol` | 종목 상세 (52주·거래량·PER·시총) |
| GET | `/api/search?q=...` | 종목 검색 (국내/해외) |
| GET | `/api/hot` | 급상승 종목 (상승률 상위) |
| GET | `/api/crypto?coins=id:SYM:KRW-SYM,...` | 코인 시세·변동·스파크라인 (업비트) |
| GET | `/api/crypto/search?q=...` | 코인 검색 (업비트 KRW 상장) |
| GET | `/api/crypto/news` | 코인 뉴스 (구글 뉴스 RSS) |
| GET | `/api/brief` | 공개된 AI 브리핑 목록 (최근 90일) |
| POST | `/api/visit` | 방문 기록 (IP 는 해시만 저장) |
| GET (SSE) | `/api/stream/quotes?symbols=...` | 시세·마켓 실시간 push |
| GET (SSE) | `/api/stream/crypto?markets=...` | 업비트 실시간 체결가 중계 (요청한 마켓만) |

## 배포 (Railway)

Railway + Nixpacks 단일 서비스. BFF 가 client 정적까지 서빙하고, SSE 도 Railway 에서 동작한다.

배포 파일 (레포 루트):
- `railway.json` — 빌더(NIXPACKS), startCommand, healthcheckPath(`/health`)
- `nixpacks.toml` — 루트 의존성 설치 → client(Vite) 빌드 → server(tsx) 구동

루트에 배포 파일이 있어 **Root Directory 설정 없이** 동작한다 (Railway 가 레포 루트의
`nixpacks.toml` 을 인식). server 가 `src/sources/*` 를 import 하므로 루트 의존성 설치가 필요하다.

Railway 설정:
1. New Project → Deploy from GitHub repo (fin-term)
2. 환경변수(선택): `FINNHUB_KEY`, `ANTHROPIC_API_KEY`, `DB_PATH`, `IP_HASH_SALT` 등 — `web/server/.env.example` 참고. 없어도 무키 동작. `PORT` 자동 주입
3. push 시 자동 빌드·배포. 헬스체크 `/health` 통과하면 라이브

## 미구현 (후속)

- 코인 차트 기간 전환(1분/1시간/일/주), 보유자산·알림 (TUI 코인 모드 고급 기능)
- UI 스모크 스크립트를 현재 화면 구성에 맞게 갱신
- 투자일지 가져오기(내보낸 JSON 복원)
