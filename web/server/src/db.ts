// 방문자 추적 영속 저장 — SQLite 파일 한 개(better-sqlite3, 동기 API).
// 원시 IP 는 저장하지 않고 해시만 보관한다(db.ts 외부에서 해시해서 넘김).
// User-Agent 는 저장 시점에 os/device/browser 로 파싱해 함께 보관한다.
// DB_PATH 로 파일 경로 주입(Railway Volume). 미지정 시 web/server/data 아래.
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../data/fin-term.db');

// 파일이 들어갈 디렉터리 보장(최초 실행 시 data/ 없을 수 있음).
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // 동시 읽기/쓰기 안정성

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash    TEXT    NOT NULL,
    user_agent TEXT,
    os         TEXT,
    device     TEXT,
    browser    TEXT,
    path       TEXT,
    visited_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visits_ip_hash    ON visits (ip_hash);
  CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits (visited_at);

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL,   -- 'brief' 등 이벤트 종류
    ip_hash    TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type       ON events (type);
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at);
`);

// 기존 DB(컬럼 없던 시절) 호환 — 없으면 추가, 이미 있으면 무시.
for (const col of ['os', 'device', 'browser']) {
  try {
    db.exec(`ALTER TABLE visits ADD COLUMN ${col} TEXT`);
  } catch {
    /* 이미 존재 */
  }
}

interface VisitInput {
  ipHash: string;
  userAgent: string | null;
  os: string | null;
  device: string | null;
  browser: string | null;
  path: string | null;
}

const insertVisit = db.prepare(
  `INSERT INTO visits (ip_hash, user_agent, os, device, browser, path, visited_at)
   VALUES (@ipHash, @userAgent, @os, @device, @browser, @path, @visitedAt)`,
);

// 방문 1건 기록. visitedAt 은 호출 시점 epoch ms.
export function recordVisit(input: VisitInput, now: number): void {
  insertVisit.run({ ...input, visitedAt: now });
}

const insertEvent = db.prepare(
  'INSERT INTO events (type, ip_hash, created_at) VALUES (?, ?, ?)',
);

// 이벤트 1건 기록 (브리핑 이용 등). createdAt 은 호출 시점 epoch ms.
export function recordEvent(type: string, ipHash: string, now: number): void {
  insertEvent.run(type, ipHash, now);
}

interface ReturningVisitor {
  ip_hash: string;
  visit_count: number;
  first_at: number;
  last_at: number;
}

interface Breakdown {
  label: string;
  count: number;
}

interface EventStat {
  type: string;
  total: number; // 누적
  today: number; // 오늘
  uniqueUsers: number; // 고유 ip_hash
}

interface VisitStats {
  total: number; // 누적 방문 수
  uniqueIps: number; // 고유 ip_hash 수
  todayCount: number; // 오늘(자정 이후) 방문 수
  returning: ReturningVisitor[]; // 2회 이상 방문한 ip 상위(재방문)
  os: Breakdown[]; // OS 별 방문 분포
  device: Breakdown[]; // 기기(desktop/mobile/tablet) 분포
  browser: Breakdown[]; // 브라우저 분포
  events: EventStat[]; // 이벤트(브리핑 등) 집계
}

const countTotal = db.prepare('SELECT COUNT(*) AS c FROM visits');
const countUnique = db.prepare('SELECT COUNT(DISTINCT ip_hash) AS c FROM visits');
const countSince = db.prepare('SELECT COUNT(*) AS c FROM visits WHERE visited_at >= ?');
const selectReturning = db.prepare(`
  SELECT ip_hash,
         COUNT(*)        AS visit_count,
         MIN(visited_at) AS first_at,
         MAX(visited_at) AS last_at
  FROM visits
  GROUP BY ip_hash
  HAVING COUNT(*) > 1
  ORDER BY visit_count DESC, last_at DESC
  LIMIT 50
`);

// 컬럼별 분포 집계 — NULL/빈값은 '(unknown)' 으로 묶는다.
function breakdownQuery(col: 'os' | 'device' | 'browser') {
  return db.prepare(`
    SELECT COALESCE(NULLIF(${col}, ''), '(unknown)') AS label, COUNT(*) AS count
    FROM visits
    GROUP BY label
    ORDER BY count DESC
  `);
}
const selectOs = breakdownQuery('os');
const selectDevice = breakdownQuery('device');
const selectBrowser = breakdownQuery('browser');

const selectEventStats = db.prepare(`
  SELECT type,
         COUNT(*)                                       AS total,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
         COUNT(DISTINCT ip_hash)                        AS uniqueUsers
  FROM events
  GROUP BY type
  ORDER BY total DESC
`);

// 대시보드 집계. startOfToday 는 호출자가 계산해 넘긴 자정 epoch ms.
export function getStats(startOfToday: number): VisitStats {
  return {
    total: (countTotal.get() as { c: number }).c,
    uniqueIps: (countUnique.get() as { c: number }).c,
    todayCount: (countSince.get(startOfToday) as { c: number }).c,
    returning: selectReturning.all() as ReturningVisitor[],
    os: selectOs.all() as Breakdown[],
    device: selectDevice.all() as Breakdown[],
    browser: selectBrowser.all() as Breakdown[],
    events: selectEventStats.all(startOfToday) as EventStat[],
  };
}

export type { VisitStats, ReturningVisitor, Breakdown, EventStat };
