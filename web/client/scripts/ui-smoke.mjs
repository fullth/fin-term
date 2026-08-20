import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173';
const CHROME_PATH = process.env.CHROME_PATH ?? (
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForPage(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = pages.find((item) => item.type === 'page' && item.url.startsWith(BASE_URL));
      if (page) return page;
    } catch {
      // Chrome이 디버깅 포트를 열 때까지 대기한다.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chrome 디버깅 페이지를 열지 못했습니다');
}

async function run() {
  await fetch(BASE_URL).then((response) => {
    if (!response.ok) throw new Error(`개발 서버 응답 실패: ${response.status}`);
  });
  const port = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'fin-term-ui-smoke-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    BASE_URL,
  ], { stdio: 'ignore' });

  try {
    const page = await waitForPage(port);
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    let requestId = 0;
    const pending = new Map();
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    await new Promise((resolve) => { socket.onopen = resolve; });
    const call = (method, params = {}) => new Promise((resolve) => {
      requestId += 1;
      pending.set(requestId, resolve);
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    await call('Runtime.enable');
    await call('Page.enable');
    const expectedOrigin = new URL(BASE_URL).origin;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const ready = await call('Runtime.evaluate', {
        expression: '`${location.origin}|${document.readyState}`',
        returnByValue: true,
      });
      if (!ready.result.exceptionDetails && ready.result.result.value === `${expectedOrigin}|complete`) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const evaluate = async (expression) => {
      const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.result.exceptionDetails) {
        throw new Error(response.result.exceptionDetails.exception?.description ?? response.result.exceptionDetails.text);
      }
      return response.result.result.value;
    };
    const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
    const click = async (label) => {
      await evaluate(`Array.from(document.querySelectorAll("button, summary")).find((element) => element.textContent.trim().startsWith(${JSON.stringify(label)}) || element.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`);
      await wait();
    };
    const activeModes = () => evaluate(`Array.from(document.querySelectorAll(".mode-btn.active")).map((element) => element.textContent.trim())`);

    await evaluate(`localStorage.removeItem("fin-term:state"); localStorage.removeItem("fin-term:welcome-seen")`);
    await call('Page.reload');
    await wait(350);
    assert((await evaluate(`Boolean(document.querySelector('.welcome-landing'))`)), '첫 방문 시작 화면이 표시되지 않았습니다');
    assert((await evaluate(`Boolean(document.querySelector('.welcome-brand img'))`)), '첫 방문 시작 화면에 브랜드 로고가 없습니다');
    await click('종합 화면 시작');
    assert(!(await evaluate(`Boolean(document.querySelector('.welcome-landing'))`)), '시작 후 첫 방문 화면이 닫히지 않았습니다');
    assert((await evaluate(`localStorage.getItem('fin-term:welcome-seen')`)) === '1', '첫 방문 완료 상태가 저장되지 않았습니다');
    assert((await activeModes()).includes('종합'), '신규 사용자의 기본 종합 모드가 표시되지 않았습니다');
    assert(!(await evaluate(`Array.from(document.querySelectorAll("button, summary")).some((element) => element.textContent.trim() === 'view')`)), 'View 드롭다운이 남아 있습니다');
    assert((await evaluate(`['Terminal','Excel','업무 화면'].every((label) => Boolean(document.querySelector('[aria-label="' + label + '"]')))`)), '보기 도구가 독립 버튼으로 분리되지 않았습니다');
    assert(!(await evaluate(`Array.from(document.querySelectorAll("button")).some((element) => element.textContent.trim().startsWith('단색 화면'))`)), '단색 화면 옵션이 남아 있습니다');

    await click('코인');
    assert((await evaluate(`JSON.parse(localStorage.getItem("fin-term:state")).marketMode`)) === 'crypto', '코인 모드가 저장되지 않았습니다');
    await call('Page.reload');
    await wait(350);
    assert((await activeModes()).includes('코인'), '새로고침 후 코인 모드가 복원되지 않았습니다');

    await click('Terminal');
    const terminalButtons = await evaluate(`Array.from(document.querySelectorAll(".tv-cmdbtn")).map((element) => element.textContent.trim())`);
    assert(terminalButtons.includes('coin news') && !terminalButtons.includes('watch'), '코인 Terminal 명령 구성이 올바르지 않습니다');

    await click('Terminal');
    await click('종합');

    await click('Excel');
    const excelTabs = await evaluate(`Array.from(document.querySelectorAll(".excel .sheet-tab")).map((element) => element.textContent.trim())`);
    assert(excelTabs.includes('종합') && excelTabs.includes('주식') && excelTabs.includes('코인'), '엑셀 위장에 종합 주식 코인 시트가 없습니다');
    assert((await evaluate(`document.documentElement.hasAttribute('data-stealth')`)), '엑셀 위장에서 개인 위젯 숨김 상태가 적용되지 않았습니다');
    assert((await evaluate(`Boolean(document.querySelector('.excel-search input'))`)), '엑셀 리본에 통합 자산 검색이 없습니다');
    await evaluate(`(() => { const input=document.querySelector('.excel-search input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'AAPL'); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
    await wait(700);
    assert((await evaluate(`Array.from(document.querySelectorAll('.excel-search-results button')).some((element) => element.textContent.includes('주식') && element.textContent.includes('AAPL'))`)), '엑셀 검색에서 주식 결과를 찾지 못했습니다');
    await evaluate(`Array.from(document.querySelectorAll('.excel-search-results button')).find((element) => element.textContent.includes('주식') && element.textContent.includes('AAPL'))?.click()`);
    await wait();
    assert((await evaluate(`document.querySelector('.excel .sheet-tab.active')?.textContent.trim()`)) === '주식', '엑셀 주식 검색 후 주식 시트로 이동하지 않았습니다');
    await evaluate(`(() => { const input=document.querySelector('.excel-search input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'bitcoin'); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
    await wait(700);
    assert((await evaluate(`Array.from(document.querySelectorAll('.excel-search-results button')).some((element) => element.textContent.includes('코인') && element.textContent.includes('BTC'))`)), '엑셀 검색에서 코인 결과를 찾지 못했습니다');
    await evaluate(`Array.from(document.querySelectorAll('.excel-search-results button')).find((element) => element.textContent.includes('코인') && element.textContent.includes('BTC'))?.click()`);
    await wait();
    assert((await evaluate(`document.querySelector('.excel .sheet-tab.active')?.textContent.trim()`)) === '코인', '엑셀 코인 검색 후 코인 시트로 이동하지 않았습니다');
    assert((await evaluate(`document.querySelector(".excel-sheet")?.textContent.includes('BTC')`)), '엑셀 코인 시트에 코인 데이터가 없습니다');
    const excelShift = await evaluate(`(() => { const table=document.querySelector('.excel-sheet'); const cell=table.querySelector('tbody tr:nth-child(3) td:nth-child(4)'); const before=Array.from(table.querySelectorAll('thead th')).map((element) => element.getBoundingClientRect().width); const original=cell.textContent; cell.textContent='₩9,999,999,999,999'; const after=Array.from(table.querySelectorAll('thead th')).map((element) => element.getBoundingClientRect().width); cell.textContent=original; return Math.max(...before.map((width, index) => Math.abs(width - after[index]))); })()`);
    assert(excelShift < 0.5, `엑셀 현재가 변경으로 열 너비가 ${excelShift}px 이동했습니다`);
    await click('화면 복귀');

    await click('업무 화면');
    const officeState = await evaluate(`(() => { const style=getComputedStyle(document.documentElement); return { active:document.documentElement.hasAttribute('data-office'), stealth:document.documentElement.hasAttribute('data-stealth'), up:style.getPropertyValue('--up').trim(), down:style.getPropertyValue('--down').trim(), saved:JSON.parse(localStorage.getItem('fin-term:state')).officeMode }; })()`);
    assert(officeState.active && officeState.stealth && officeState.saved, '업무 화면 상태가 적용 또는 저장되지 않았습니다');
    assert(officeState.up === '#aab3bc' && officeState.down === '#7f8a95', '업무 화면의 등락 색상이 차분한 색으로 바뀌지 않았습니다');
    await call('Page.reload');
    await wait(350);
    assert((await evaluate(`document.documentElement.hasAttribute('data-office')`)), '새로고침 후 업무 화면이 복원되지 않았습니다');

    const watchPriceShift = await evaluate(`(() => { const value=document.querySelector('.stock-lane .listrow-top .val'); const original=value.textContent; const before=value.getBoundingClientRect().left; value.textContent='9,999,999,999 ▲+999.99%'; const after=value.getBoundingClientRect().left; value.textContent=original; return Math.abs(before - after); })()`);
    assert(watchPriceShift < 0.5, `현재가 변경으로 관심목록 가격 위치가 ${watchPriceShift}px 이동했습니다`);

    await evaluate(`document.querySelectorAll(".stock-lane .listrow")[1]?.click()`);
    await evaluate(`document.querySelectorAll(".crypto-lane .listrow")[1]?.click()`);
    await wait();
    const selections = await evaluate(`(() => { const state=JSON.parse(localStorage.getItem("fin-term:state")); return { stock:state.selectedSymbol, coin:state.selectedCoin }; })()`);
    assert(selections.stock === 'TSLA' && selections.coin === 'ETH', '선택한 주식과 코인이 저장되지 않았습니다');
    await call('Page.reload');
    await wait(350);
    const restoredSelections = await evaluate(`({ stock:document.querySelector(".stock-lane .listrow.sel .sym")?.textContent, coin:document.querySelector(".crypto-lane .listrow.sel .sym")?.textContent })`);
    assert(restoredSelections.stock === 'TSLA' && restoredSelections.coin === 'ETH', '선택한 주식과 코인이 복원되지 않았습니다');

    const split = await evaluate(`Boolean(document.querySelector(".combined-split-control input"))`);
    assert(split, '종합 화면 비율 조절기가 없습니다');
    await evaluate(`(() => { const input=document.querySelector(".combined-split-control input"); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "60"); input.dispatchEvent(new Event("input", { bubbles:true })); input.dispatchEvent(new Event("change", { bubbles:true })); })()`);
    await wait();
    assert((await evaluate(`JSON.parse(localStorage.getItem("fin-term:state")).combinedSplit`)) === 60, '종합 화면 비율이 저장되지 않았습니다');

    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await wait(250);
    const mobile = await evaluate(`({ width:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth, removeOpacity:getComputedStyle(document.querySelector(".list-remove-btn")).opacity })`);
    assert(mobile.scrollWidth === mobile.width, '모바일 화면에 가로 넘침이 있습니다');
    assert(mobile.removeOpacity === '1', '모바일 삭제 버튼이 노출되지 않습니다');
    await click('fin-term');
    const mobileWelcome = await evaluate(`({ open:Boolean(document.querySelector('.welcome-landing')), width:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth, actions:Array.from(document.querySelectorAll('.welcome-actions button')).map((element) => element.getBoundingClientRect().width) })`);
    assert(mobileWelcome.open, '상단 로고로 시작 화면을 다시 열 수 없습니다');
    assert(mobileWelcome.scrollWidth === mobileWelcome.width, '모바일 시작 화면에 가로 넘침이 있습니다');
    assert(mobileWelcome.actions.every((width) => width > 300), '모바일 시작 버튼이 충분한 너비로 배치되지 않았습니다');
    await click('종합 화면 시작');

    const newsCount = await evaluate(`document.querySelectorAll(".stock-lane .area-news .news-row").length`);
    assert(newsCount <= 60, '핵심 뉴스가 60건을 초과해 렌더링됩니다');
    assert(await evaluate(`Boolean(document.querySelector(".connection-badge"))`), '실시간 연결 상태가 표시되지 않습니다');
    await click('alert');
    assert((await evaluate(`document.querySelectorAll(".nav-alert-menu .nav-menu-item").length`)) === 2, '통합 알림 메뉴 구성이 올바르지 않습니다');

    socket.close();
    process.stdout.write('UI smoke passed: welcome and direct view controls, stable live-price layout, market and office persistence, Excel asset search and sheets, terminal context, mobile controls, news cap, live status, alert menu\n');
  } finally {
    if (chrome.exitCode == null) {
      chrome.kill('SIGTERM');
      await Promise.race([
        once(chrome, 'exit'),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
