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

// alternate screen 버퍼로 진입 + 화면 초기화.
const ALT_ENTER = '\x1b[?1049h\x1b[2J\x1b[H';
const ALT_EXIT = '\x1b[?1049l';
process.stdout.write(ALT_ENTER);

const config = loadConfig();
const store = new Store(config.initial_watchlist, config.initial_scope, config.initial_names);
const poller = new Poller(store, config);
poller.start();

// Ink(주식) 화면과 blessed(코인) 화면을 번갈아 띄운다. 두 렌더러가 동시에 stdin/
// raw mode 를 잡으면 충돌하므로, 전환 시 한쪽을 완전히 내린 뒤 다른 쪽을 올린다.
let inkApp: Instance | null = null;
let cryptoMonitor: CryptoMonitorHandle | null = null;

function showStock() {
  // 화면 초기화 후 Ink 마운트. App 의 onEnterCrypto 로 코인 모드 요청을 받는다.
  process.stdout.write('\x1b[2J\x1b[H');
  inkApp = render(<App store={store} poller={poller} onEnterCrypto={showCrypto} />);
}

function showCrypto() {
  // Ink 를 완전히 내리고(입력·raw mode 해제) blessed 화면을 띄운다.
  if (inkApp) {
    inkApp.unmount();
    inkApp.cleanup();
    inkApp = null;
  }
  process.stdout.write('\x1b[2J\x1b[H');
  // blessed 모니터. q/m → showStock 으로 복귀.
  cryptoMonitor = startCryptoMonitor(() => {
    cryptoMonitor = null;
    showStock();
  });
}

const quit = () => {
  poller.stop();
  cryptoMonitor?.destroy();
  inkApp?.unmount();
  process.stdout.write(ALT_EXIT);
  process.exit(0);
};

// 초기 모드.
if (config.initial_mode === 'crypto') showCrypto();
else showStock();

process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('exit', () => process.stdout.write(ALT_EXIT));
