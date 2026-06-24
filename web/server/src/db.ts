// 방문자 추적 영속 저장 — SQLite 파일 한 개(better-sqlite3, 동기 API).
// 원시 IP 는 저장하지 않고 해시만 보관한다(db.ts 외부에서 해시해서 넘김).
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
    path       TEXT,
    visited_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visits_ip_hash    ON visits (ip_hash);
  CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits (visited_at);
`);

interface VisitInput {
  ipHash: string;
  userAgent: string | null;
  path: string | null;
}

const insertVisit = db.prepare(
  'INSERT INTO visits (ip_hash, user_agent, path, visited_at) VALUES (?, ?, ?, ?)',
);

// 방문 1건 기록. visited_at 은 호출 시점 epoch ms.
export function recordVisit(input: VisitInput, now: number): void {
  insertVisit.run(input.ipHash, input.userAgent, input.path, now);
}

interface ReturningVisitor {
  ip_hash: string;
  visit_count: number;
  first_at: number;
  last_at: number;
}

interface VisitStats {
  total: number; // 누적 방문 수
  uniqueIps: number; // 고유 ip_hash 수
  todayCount: number; // 오늘(자정 이후) 방문 수
  returning: ReturningVisitor[]; // 2회 이상 방문한 ip 상위(재방문)
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

// 대시보드 집계. startOfToday 는 호출자가 계산해 넘긴 자정 epoch ms.
export function getStats(startOfToday: number): VisitStats {
  return {
    total: (countTotal.get() as { c: number }).c,
    uniqueIps: (countUnique.get() as { c: number }).c,
    todayCount: (countSince.get(startOfToday) as { c: number }).c,
    returning: selectReturning.all() as ReturningVisitor[],
  };
}

export type { VisitStats, ReturningVisitor };
