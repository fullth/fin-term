# fin-term 웹 송출용 (ttyd). 터미널 TUI 를 브라우저에 그대로 띄운다.
# Render 등 Docker 호스팅에서 단일 HTTP 포트($PORT)로 ttyd 를 서빙.

# --- build: TypeScript 컴파일 ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime: ttyd + 컴파일된 dist ---
FROM node:20-alpine
WORKDIR /app
# ttyd: alpine community 저장소
RUN apk add --no-cache ttyd
# 런타임 의존성만 설치
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# node 경고가 화면 맨 위에 박히는 것 방지 (ttyd 가 stderr 도 머지)
ENV NODE_NO_WARNINGS=1
ENTRYPOINT ["docker-entrypoint.sh"]
