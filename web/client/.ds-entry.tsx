// design-sync synthetic entry — re-exports the presentational components only.
// Not part of the app build; consumed by .ds-sync/package-build.mjs via --entry.
export { Sparkline } from './src/components/Sparkline';
export { QuotePanel } from './src/components/QuotePanel';
export { Watchlist } from './src/components/Watchlist';
export { NewsStream } from './src/components/NewsStream';
export { IndicesPanel, MarketsPanel, HotPanel, BriefPanel } from './src/components/SidePanels';
export { AlertTriggerButton } from './src/components/AlertTriggerButton';
