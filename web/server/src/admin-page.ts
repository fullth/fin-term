// 관리자 대시보드 — 빌드 불필요한 독립 HTML 1장. 메인 PWA/SW 와 완전 분리.
// /api/admin/stats 를 주기 폴링해 실시간 동시접속·재방문을 갱신한다.
// Basic Auth 통과 후에만 서빙되므로 인증 로직은 여기 없다.
export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>fin-term · 방문 통계</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0e14; color: #d8dee9; font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #88c0d0; }
  .sub { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: #11151f; border: 1px solid #1f2733; border-radius: 8px; padding: 14px 16px; }
  .card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; color: #eceff4; }
  .card.live .value { color: #a3be8c; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #1f2733; }
  th { color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .hash { color: #81a1c1; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 13px; color: #88c0d0; margin: 0 0 8px; }
  .muted { color: #4b5563; }
  .err { color: #bf616a; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #a3be8c; margin-right: 6px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
</style>
</head>
<body>
  <h1>fin-term 방문 통계</h1>
  <div class="sub"><span class="dot"></span><span id="updated">불러오는 중…</span></div>

  <div class="cards">
    <div class="card live"><div class="label">실시간 연결</div><div class="value" id="live-conn">–</div></div>
    <div class="card live"><div class="label">실시간 사용자</div><div class="value" id="live-users">–</div></div>
    <div class="card"><div class="label">오늘 방문</div><div class="value" id="today">–</div></div>
    <div class="card"><div class="label">고유 방문자</div><div class="value" id="unique">–</div></div>
    <div class="card"><div class="label">누적 방문</div><div class="value" id="total">–</div></div>
  </div>

  <div class="section">
    <h2>현재 접속 중</h2>
    <table>
      <thead><tr><th>IP (해시 앞 8자리)</th><th>접속 시각</th></tr></thead>
      <tbody id="live-rows"><tr><td colspan="2" class="muted">–</td></tr></tbody>
    </table>
  </div>

  <div class="section">
    <h2>재방문 (2회 이상)</h2>
    <table>
      <thead><tr><th>IP (해시 앞 8자리)</th><th class="num">방문 횟수</th><th>최초</th><th>최근</th></tr></thead>
      <tbody id="returning-rows"><tr><td colspan="4" class="muted">–</td></tr></tbody>
    </table>
  </div>

<script>
  const fmt = (ms) => { if (!ms) return '–'; const d = new Date(ms); return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const short = (h) => h ? h.slice(0, 8) : '–';
  const set = (id, v) => { document.getElementById(id).textContent = v; };

  async function load() {
    try {
      const r = await fetch('/api/admin/stats', { headers: { 'Cache-Control': 'no-cache' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const s = await r.json();
      set('live-conn', s.live.connections);
      set('live-users', s.live.uniqueUsers);
      set('today', s.today);
      set('unique', s.uniqueIps);
      set('total', s.total);

      const lr = document.getElementById('live-rows');
      lr.innerHTML = s.live.sessions.length
        ? s.live.sessions.map((x) => '<tr><td class="hash">' + short(x.ipHash) + '</td><td>' + fmt(x.connectedAt) + '</td></tr>').join('')
        : '<tr><td colspan="2" class="muted">접속자 없음</td></tr>';

      const rr = document.getElementById('returning-rows');
      rr.innerHTML = s.returning.length
        ? s.returning.map((x) => '<tr><td class="hash">' + short(x.ip_hash) + '</td><td class="num">' + x.visit_count + '</td><td>' + fmt(x.first_at) + '</td><td>' + fmt(x.last_at) + '</td></tr>').join('')
        : '<tr><td colspan="4" class="muted">재방문 없음</td></tr>';

      document.getElementById('updated').textContent = '갱신 ' + new Date().toLocaleTimeString('ko-KR');
    } catch (e) {
      document.getElementById('updated').innerHTML = '<span class="err">갱신 실패: ' + e.message + '</span>';
    }
  }
  load();
  setInterval(load, 5000);
</script>
</body>
</html>`;
