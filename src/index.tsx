#!/usr/bin/env node
// process 경고(예: NODE_TLS_REJECT_UNAUTHORIZED=0 사용 시 뜨는 TLS 경고)가
// stderr 로 나와 터미널/ttyd 화면 맨 위에 박히면 레이아웃·마우스 좌표가
// 밀린다. ink 화면을 그리기 전에 경고 리스너를 제거해 출력 자체를 막는다.
process.removeAllListeners('warning');
process.on('warning', () => {});

import React from 'react';
import { render, type Instance } from 'ink';
import { loadConfig } from './config.js';
import { Store } from './core/store.js';
import { Poller } from './core/poller.js';
import { App } from './ui/App.js';
import { startCryptoMonitor, type CryptoMonitorHandle } from './crypto-monitor/index.js';

// index 가 단일 alt-screen 을 소유한다. Ink·blessed 모두 이 한 버퍼 안에 그리고
// (blessed 는 normalBuffer 로 끌어내려 공유), 전환 시 버퍼를 완전히 비운다.
const ALT_ENTER = '\x1b[?1049h';
process.stdout.write(ALT_ENTER);

const config = loadConfig();
const store = new Store(config.initial_watchlist, config.initial_scope, config.initial_names);
const poller = new Poller(store, config);
poller.start();

// Ink(주식) 화면과 blessed(코인) 화면을 번갈아 띄운다. 두 렌더러가 동시에 stdin/
// raw mode 를 잡으면 충돌하므로, 전환 시 한쪽을 완전히 내린 뒤 다른 쪽을 올린다.
let inkApp: Instance | null = null;
let cryptoMonitor: CryptoMonitorHandle | null = null;

// 전환마다: 모든 마우스 트래킹 모드 해제(SGR 시퀀스가 입력으로 새지 않게) +
// alt-screen 재진입 + 스크롤백 비우고 커서 홈.
// 마우스 모드: 1000(클릭) 1002(드래그) 1003(모션) 1006(SGR) 1015 1005 전부 끈다.
const MOUSE_OFF = '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l';
const CLEAR = `${MOUSE_OFF}\x1b[?1049h\x1b[3J\x1b[2J\x1b[H`;

function showStock() {
  // blessed destroy 후 한 틱 뒤에 버퍼를 비우고 Ink 를 마운트.
  setImmediate(() => {
    process.stdout.write(CLEAR);
    inkApp = render(<App store={store} poller={poller} onEnterCrypto={showCrypto} />);
  });
}

function showCrypto() {
  if (inkApp) {
    inkApp.unmount();
    inkApp = null;
  }
  setImmediate(() => {
    process.stdout.write(CLEAR);
    cryptoMonitor = startCryptoMonitor(() => {
      cryptoMonitor = null;
      showStock();
    });
  });
}

const quit = () => {
  poller.stop();
  cryptoMonitor?.destroy(); // blessed alt-screen 정리 포함
  inkApp?.unmount();
  // 마우스 트래킹 해제 + alt-screen 탈출 (프롬프트 복귀 후 SGR 누수 방지)
  process.stdout.write(`${MOUSE_OFF}\x1b[?1049l`);
  process.exit(0);
};

// 초기 모드.
if (config.initial_mode === 'crypto') showCrypto();
else showStock();

process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('exit', () => process.stdout.write(`${MOUSE_OFF}\x1b[?1049l`));
