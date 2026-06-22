# fin-term 웹앱 마이그레이션 개발 계획서

> 유형: 마이그레이션 (터미널 TUI → React DOM 웹앱)
> 목적: 실행/승인 정렬용. 착수 전 리스크·의존성·작업 순서 고정.
> 작성 기준일: 2026-06-22

## 1. 배경

- fin-term 은 ink(React→터미널 렌더) + blessed 기반 TUI 금융 앱이다. 블룸버그 스타일 시세·뉴스 대시보드를 터미널에 그린다.
- 현재 웹 노출 수단은 ttyd(터미널 세션을 xterm.js 로 브라우저 송출)뿐이다. 화면은 동일하나 반응형·마우스 UI·모바일·SEO·접근성이 없다.
- "동일한 블룸버그 UI 를 진짜 React DOM 웹앱으로" 라는 요구를 충족하려면 UI 레이어를 HTML/CSS 로 재구현해야 한다.

## 2. 목표

- 현 TUI 와 동일한 정보 구조(WATCHLIST / QUOTE 상세 / NEWS / INDICES / MARKETS / HOT / BRIEF / EXPLAIN)를 DOM 기반 React 웹앱으로 제공한다.
- 블룸버그 룩(검정 배경, 노랑/시안 강조, 모노스페이스, 변동 색상 ▲▼)을 CSS 로 재현한다.
- 데스크톱 + 모바일 반응형 대응, 마우스/터치 인터랙션 지원.
- 단일 컨테이너로 배포 가능(프론트 정적 + BFF API 한 프로세스 또는 두 서비스).

### 성공 기준

- 키 없이 미국 주요 종목 시세 + 영문/한글 뉴스가 웹에서 표시된다(현 TUI 무키 동작 동등).
- watchlist 추가/삭제, 종목 선택→상세, 뉴스 열기, 종목 검색이 마우스/터치로 동작한다.
- 모바일 폭(375px)에서 패널이 깨지지 않고 세로 스택으로 재배치된다.
- Lighthouse 기준 기본 접근성/성능 통과(세부 목표치는 오픈 이슈).

## 3. 범위

### 포함 범위

- BFF(Backend-for-Frontend) 프록시: `src/sources/*` 를 HTTP 라우트로 래핑. CORS/시크릿 처리.
- 데이터 레이어 재사용·이식: `types.ts`, `format.ts`, `ticker-tag.ts` 클라이언트 공유.
- React DOM UI: TUI 패널 16개를 웹 컴포넌트로 재작성.
- 실시간 갱신: 시세/뉴스 폴링 + 업비트 WS 중계(SSE 또는 WebSocket).
- 상태관리: 현 EventEmitter store → 클라이언트 상태(zustand 등) + 서버 폴링.
- 영속화: 현 fs persist(watchlist) → 브라우저 localStorage.
- 빌드/배포: Vite 빌드 + BFF, Docker 단일 이미지화, render.yaml 갱신.

### 비범위

- 기존 TUI(`src/index.tsx`, `src/ui/*`, `src/crypto-monitor` blessed UI) 폐기/삭제 — 당분간 병존 유지(npm 패키지 그대로).
- 신규 데이터 소스·종목·차트 종류 추가.
- 사용자 계정/인증(현 ttyd basic auth 수준 외).
- AI 브리핑/용어설명 기능의 모델·프롬프트 변경.
- 결제/유료화.

## 4. 제약 및 전제

- 확정: 데이터 소스(Yahoo, Naver, Finnhub, Google News·RSS 피드, 업비트, CoinGecko)는 현행 유지.
- 확정: 시크릿(FINNHUB_KEY, ANTHROPIC_API_KEY)은 브라우저 비노출. 서버 보관 필수.
- 제약(CORS): 외부 API 대부분 브라우저 직접 호출 불가(`Access-Control-Allow-Origin` 부재). RSS 는 XML+CORS 이중 제약. → BFF 필수.
- 제약(차트): blessed-contrib 스파크라인은 DOM 미지원. 경량 웹 차트로 대체.
- 가정: 1인 개발, 풀타임 환산 약 2~3주.
- 가정: 배포 타깃은 현행과 동일하게 Render(Docker). 변경 가능.
- 미정: 디자인 시스템(Tailwind vs CSS Module vs vanilla-extract), 차트 라이브러리 선정.

## 5. 추진 방식

선택: **모노레포 내 신규 web 패키지 + 얇은 BFF**, 데이터 로직은 공유 모듈로 추출해 서버가 호출.

```
[React DOM 앱(web)] ──fetch/SSE──> [Node BFF(server)] ──fetch/ws──> 외부 API
  ui 재작성                          sources/* 재사용                 Yahoo/Naver/RSS/업비트
  format.ts·types.ts 공유            시크릿 보관
```

### 대안 비교

| 대안 | 장점 | 단점 | 채택 |
|---|---|---|---|
| A. ttyd 유지 | 작업 0 | DOM 아님, 반응형/모바일 불가 | X (요구 불충족) |
| B. 클라이언트 직접 fetch | 서버 불필요 | CORS·시크릿 노출로 사실상 불가 | X |
| **C. BFF + React DOM** | 시크릿 안전, 소스 재사용, 진짜 웹 | 서버 한 겹 운영 | **O** |
| D. Next.js 풀스택 | API Route 통합 | 도입 비용·러닝, 현 구조 대비 과함 | 보류(오픈 이슈) |

## 6. 단계별 실행 계획

### 1단계 — 데이터 레이어 분리·검증 (이정표 A)

- `src/sources/*`, `format.ts`/`types.ts`/`ticker-tag.ts` 의 순수성 확인, 공유 패키지(`shared/`)로 추출.
- Node 전용 의존(persist, update-check, notify, open-url) 은 서버/클라이언트 책임으로 분리 표기.
- 산출물: 공유 모듈, 의존성 분리표.
- 완료 조건: 서버에서 quote/news/detail/search/hot 함수 단독 호출 성공.

### 2단계 — BFF 구축 (이정표 A)

- Express/Hono 로 라우트 작성: `/api/quotes`, `/api/news`, `/api/detail`, `/api/search`, `/api/hot`, `/api/brief`, `/api/explain`.
- 시세/뉴스 서버측 폴링 → `/api/stream` (SSE) 로 push. 업비트 WS 수신→SSE 중계.
- 시크릿은 서버 env. CORS·캐시·레이트리밋 헤더 설정.
- 산출물: BFF 서비스, API 명세.
- 완료 조건: curl 로 전 라우트 200 + 실데이터, SSE 로 시세 틱 수신.

### 3단계 — 프론트 스캐폴딩·디자인 토큰 (이정표 B)

- Vite + React + TS 셋업. 블룸버그 테마 토큰(색/폰트/간격) 정의.
- API 클라이언트 + SSE 훅 + 클라이언트 store.
- 레이아웃 셸(좌:watchlist / 우상:quote / 하:news, 반응형 그리드).
- 산출물: 스캐폴딩, 테마, 레이아웃 셸.
- 완료 조건: 빈 패널이 데스크톱·모바일에서 정상 배치.

### 4단계 — 핵심 패널 구현 (이정표 B)

- Watchlist, QuotePanel(스파크라인 차트 포함), NewsStream 구현 + 실데이터 연결.
- 종목 선택→상세 fetch, watchlist add/remove(localStorage), 뉴스 열기.
- 산출물: 동작하는 메인 대시보드.
- 완료 조건: 무키 상태로 시세+뉴스 표시, 선택·추가·삭제·열기 동작.

### 5단계 — 보조 패널·검색·명령 UX (이정표 C)

- IndicesPanel, MarketsPanel, HotPanel, BriefPanel, ExplainPanel, SearchPanel/SearchBar.
- TUI 의 `:command` 키바인딩 → 웹 UX(버튼/검색창/단축키 병행) 재설계.
- 코인 모드(업비트 WS) 화면.
- 산출물: 전체 기능 패리티.
- 완료 조건: TUI 기능 목록 대비 누락 없음(패리티 체크리스트 통과).

### 6단계 — 빌드·배포·모니터링 (이정표 D)

- Vite 정적 빌드 + BFF 단일 Docker 이미지. render.yaml 갱신(또는 web/api 2서비스).
- 헬스체크, 외부 API 실패 시 그레이스풀 디그레이드 확인.
- 산출물: 배포된 웹앱, 갱신된 배포 정의.
- 완료 조건: 공개 URL 에서 무키 동작 + 모바일 확인.

## 7. 일정 및 이정표

| 이정표 | 내용 | 상대 일정 |
|---|---|---|
| A | 데이터 레이어 분리 + BFF 동작 | 1주차 |
| B | 스캐폴딩 + 메인 대시보드 패리티 | 2주차 |
| C | 보조 패널·검색·코인모드 패리티 | 2~3주차 |
| D | 배포·검증 | 3주차 |

- 주요 의사결정 시점: 1단계 착수 전 — 디자인 스택/차트 라이브러리/Next.js 여부 확정.

## 8. 의존성

- 선행: 디자인 스택·차트 라이브러리 선정(오픈 이슈). 배포 타깃 확정.
- 외부 시스템: Yahoo·Naver·Finnhub·RSS 피드·업비트·CoinGecko(가용성·레이트리밋·스키마 변경 위험은 현 TUI 와 동일).
- 협업: 단독. (디자인 검수 필요 시 외부 인입)

## 9. 리스크 및 대응

| 리스크 | 영향도 | 대응/관찰 |
|---|---|---|
| 외부 API CORS·차단(IP/UA) — 서버 경유해도 일부 거부 가능 | 높음 | BFF 에서 현 TUI 와 동일 UA/Referer 헤더 유지. 라우트별 통합테스트로 조기 탐지 |
| 업비트 WS→SSE 중계 시 다중 클라이언트 fan-out·재연결 | 중 | 서버 단일 WS 구독→메모리 브로드캐스트. 재연결/하트비트 구현 |
| RSS 스키마/피드 폐지(블룸버그 RSS 폐지 전례 있음) | 중 | 피드 실패를 부분 실패로 처리(한 소스 죽어도 나머지 표시) |
| blessed-contrib 차트 시각 동등성 미달 | 중 | 경량 라이브러리(예: lightweight-charts/sparkline)로 룩 매칭. 디자인 토큰 선고정 |
| 폴링 다중 클라이언트 시 외부 API 레이트리밋 초과 | 중 | 서버측 단일 폴링→캐시→공유 push 구조로 호출량을 클라이언트 수와 분리 |
| 시크릿 노출(클라 번들 유입) | 높음 | 시크릿은 BFF 전용. 빌드 시 클라 env 화이트리스트 점검 |
| 모바일에서 정보 밀도 높은 표 깨짐 | 중 | 반응형 우선 설계, 375px 기준 QA 를 4단계 완료 조건에 포함 |

## 10. 검증 계획

- BFF: 라우트별 통합테스트(실데이터 200 + 스키마), SSE 수신 테스트.
- 프론트: 핵심 컴포넌트 렌더/상호작용 테스트. 무키 시나리오 E2E(Playwright).
- 패리티 체크리스트: TUI 키/명령 표 대비 웹 기능 1:1 매핑 확인.
- 반응형 QA: 375 / 768 / 1440 폭 수기 확인.

## 11. 배포 계획

- 롤아웃: 신규 web 서비스로 별도 배포(기존 npm CLI·ttyd 영향 없음). 점진 공개.
- 모니터링: BFF 외부 API 에러율·응답시간, SSE 연결수, 컨테이너 헬스.
- 롤백: 신규 서비스 비활성화 시 기존 ttyd 경로로 즉시 복귀(병존 유지).

## 12. 오픈 이슈 (착수 전 결정 필요)

1. **디자인 스택**: Tailwind / CSS Module / vanilla-extract 중 택1.
2. **차트 라이브러리**: 스파크라인·인트라데이용 경량 선정(lightweight-charts vs uPlot vs 직접 SVG).
3. **프레임워크**: 순수 Vite+React(대안 C) vs Next.js 풀스택(대안 D).
4. **실시간 방식**: SSE vs WebSocket(업비트 중계 포함 일관성).
5. **배포 형태**: 단일 Docker(정적+BFF 한 프로세스) vs web/api 2서비스 분리.
6. **기존 TUI 처리**: 영구 병존 vs 단계적 deprecate.
7. **성공 지표 수치**: Lighthouse·응답시간 목표치 확정.
