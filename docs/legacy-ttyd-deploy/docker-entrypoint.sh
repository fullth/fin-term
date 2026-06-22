#!/bin/sh
# ttyd 로 fin-term TUI 를 웹에 서빙. Render 가 $PORT 를 주입한다.
# 웹 공개이므로 기본 인증(FIN_WEB_USER/FIN_WEB_PASS) 을 권장 — 설정 시에만 -c 적용.
set -e

PORT="${PORT:-7681}"
AUTH=""
if [ -n "$FIN_WEB_USER" ] && [ -n "$FIN_WEB_PASS" ]; then
  AUTH="-c ${FIN_WEB_USER}:${FIN_WEB_PASS}"
fi

# -W: 쓰기 허용(키 입력)  -i: 모든 인터페이스  -t: xterm 옵션
exec ttyd \
  -p "$PORT" \
  -i 0.0.0.0 \
  -W \
  $AUTH \
  -t fontSize=14 \
  -t 'theme={"background":"#000000"}' \
  node dist/index.js
