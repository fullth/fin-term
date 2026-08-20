export type ConnectionState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stale';

export interface ConnectionInfo {
  state: ConnectionState;
  lastUpdated: number | null;
  issue: string | null;
}

export const INITIAL_CONNECTION: ConnectionInfo = {
  state: 'connecting',
  lastUpdated: null,
  issue: null,
};
