import React from 'react';
import { render } from 'ink';
import { loadConfig } from './config.js';
import { Store } from './core/store.js';
import { Poller } from './core/poller.js';
import { App } from './ui/App.js';

const config = loadConfig();
const store = new Store(config.initial_watchlist, config.initial_lang);
const poller = new Poller(store, config);
poller.start();

const { waitUntilExit } = render(<App store={store} poller={poller} />);

waitUntilExit().then(() => {
  poller.stop();
  process.exit(0);
});
