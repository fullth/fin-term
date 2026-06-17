#!/usr/bin/env node
// process 경고(예: NODE_TLS_REJECT_UNAUTHORIZED=0 사용 시 뜨는 TLS 경고)가
// stderr 로 나와 터미널/ttyd 화면 맨 위에 박히면 레이아웃·마우스 좌표가
// 밀린다. ink 화면을 그리기 전에 경고 리스너를 제거해 출력 자체를 막는다.
process.removeAllListeners('warning');
process.on('warning', () => {});

import React from 'react';
import { render } from 'ink';
import { loadConfig } from './config.js';
import { Store } from './core/store.js';
import { Poller } from './core/poller.js';
import { CryptoFeed } from './core/crypto-feed.js';
import { loadHoldings } from './core/holdings.js';
import { App } from './ui/App.js';

// alternate screen 버퍼로 진입 + 화면 초기화.
// node 경고(stderr)나 셸 잔상이 ink 출력 위에 남아 레이아웃·마우스 좌표가
// 밀리는 것을 막는다 (특히 ttyd 등 웹 터미널에서 두드러짐).
const ALT_ENTER = '\x1b[?1049h\x1b[2J\x1b[H';
const ALT_EXIT = '\x1b[?1049l';
process.stdout.write(ALT_ENTER);

const config = loadConfig();
const holdings = loadHoldings();
const store = new Store(config.initial_watchlist, config.initial_scope, config.initial_names, holdings);
const poller = new Poller(store, config);
poller.start();

// 보유 코인이 있으면 실시간 KRW 피드 시동 (보유 없으면 웹소켓 안 띄움).
const cryptoFeed = new CryptoFeed(store);
if (holdings.length) cryptoFeed.start();

const { waitUntilExit } = render(<App store={store} poller={poller} />);

const cleanup = () => {
  poller.stop();
  cryptoFeed.stop();
  process.stdout.write(ALT_EXIT);
};

waitUntilExit().then(() => {
  cleanup();
  process.exit(0);
});

// 비정상 종료(Ctrl+C, SIGTERM)에도 메인 화면으로 복귀.
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('exit', () => process.stdout.write(ALT_EXIT));
