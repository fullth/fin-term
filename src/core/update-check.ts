// 업데이트 자동확인. 실행 시 npm registry 에서 최신 버전을 조회해 현재 버전과 비교한다.
// 하루 1회만 네트워크 조회하도록 결과를 캐시하고, 실패/오프라인은 조용히 무시한다.
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const REGISTRY = 'https://registry.npmjs.org/fin-term/latest';
const DIR = join(homedir(), '.fin-term');
const CACHE = join(DIR, 'update-check.json');
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

// 현재 설치 버전을 package.json 에서 읽는다 (dist 기준 상위 디렉토리).
function currentVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url)); // dist/core
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// semver 단순 비교: a < b 이면 true (major.minor.patch 만 비교, 프리릴리스 무시)
function isOlder(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

interface Cache {
  checkedAt: number;
  latest: string;
}

function readCache(): Cache | null {
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8')) as Cache;
  } catch {
    return null;
  }
}

function writeCache(latest: string, now: number) {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(CACHE, JSON.stringify({ checkedAt: now, latest }), 'utf8');
  } catch {
    // 무시
  }
}

// 최신 버전 확인. 하루 안에 확인했으면 캐시 사용, 아니면 registry 조회.
// now 는 호출측에서 Date.now() 를 주입 (workflow 호환).
export async function checkForUpdate(now: number): Promise<UpdateInfo | null> {
  const current = currentVersion();
  const cached = readCache();

  let latest: string | undefined;
  if (cached && now - cached.checkedAt < DAY_MS) {
    latest = cached.latest;
  } else {
    try {
      const res = await fetch(REGISTRY, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = (await res.json()) as { version?: string };
        if (data.version) {
          latest = data.version;
          writeCache(latest, now);
        }
      }
    } catch {
      return null; // 오프라인/실패 → 조용히 무시
    }
  }

  if (!latest) return null;
  return { current, latest, hasUpdate: isOlder(current, latest) };
}
