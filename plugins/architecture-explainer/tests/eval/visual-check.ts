// Render an explainer HTML file at several viewport widths through the Chrome
// DevTools Protocol; print overflow, Code Map identifier-wrap and "同じコード" window findings
// as JSON and save one screenshot per section.
//
// Usage: bun visual-check.ts <html> <out-dir> [width ...]   (default widths: 390 500 1280)
// Requires Chrome (set CHROME to its binary if it is not in the default macOS location).
// Headless Chrome cannot shrink its window below ~500px,
// so narrow widths are emulated with Emulation.setDeviceMetricsOverride instead of --window-size.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [htmlArg, outArg, ...widthArgs] = process.argv.slice(2);
if (!htmlArg || !outArg) {
  console.error('Usage: bun visual-check.ts <html> <out-dir> [width ...]');
  process.exit(2);
}
const widths = (widthArgs.length ? widthArgs : ['390', '500', '1280']).map(Number);
const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

// Code Map identifiers should wrap only after a separator, never leaving a
// one- or two-character line; the probe reads line boxes character by character.
const OVERFLOW_PROBE = `(() => {
  const viewport = document.documentElement.clientWidth;
  const identifierWrap = { cells: 0, wrapped: 0, nonSemanticBreaks: 0, orphanLines: 0, examples: [] };
  for (const cell of document.querySelectorAll('.codemap .src-file, .codemap .src-symbol')) {
    const lines = [];
    let top = null;
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i++) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        if (top === null || Math.abs(rect.top - top) > 2) { lines.push(''); top = rect.top; }
        lines[lines.length - 1] += node.data[i];
      }
    }
    identifierWrap.cells++;
    if (lines.length > 1) identifierWrap.wrapped++;
    for (let i = 1; i < lines.length; i++) {
      if (!'/.:_-, '.includes(lines[i - 1].slice(-1))) identifierWrap.nonSemanticBreaks++;
      if (lines[i].trim().length <= 2) identifierWrap.orphanLines++;
    }
    if (lines.length > 1 && identifierWrap.examples.length < 5) identifierWrap.examples.push(lines.join(' | '));
  }
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (el.classList.length ? '.' + [...el.classList].join('.') : '');
  const scrollsWithin = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (/(auto|scroll|hidden)/.test(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= viewport + 1) return true;
    }
    return false;
  };
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= 0 || r.right <= viewport + 1 || scrollsWithin(el)) continue;
    overflow.push({ element: describe(el), right: Math.round(r.right), text: el.textContent.trim().slice(0, 60) });
  }
  const scrollers = [...document.querySelectorAll('body *')]
    .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
    .map((el) => ({ element: describe(el), section: el.closest('main section[id]')?.id ?? null, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
  const verticalScrollers = [...document.querySelectorAll('body *')]
    .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
    .map((el) => ({ element: describe(el), section: el.closest('main section[id]')?.id ?? null, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }));
  const sections = [...document.querySelectorAll('main section[id]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { id: s.id, y: Math.round(r.top + scrollY), height: Math.round(r.height) };
  });
  return { identifierWrap, viewport, documentScrollWidth: document.documentElement.scrollWidth, overflow: overflow.slice(0, 20),
           overflowCount: overflow.length, scrollers, verticalScrollers, sections };
})()`;

function launchChrome(profileDir) {
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank']);
  return new Promise((resolvePort, reject) => {
    let stderr = '';
    chrome.on('error', reject);
    chrome.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match) resolvePort({ chrome, port: match[1] });
    });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited (${code}): ${stderr.slice(-400)}`)));
  });
}

function connect(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id !== undefined) {
      const { resolve: done, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : done(message.result);
    } else {
      listeners.get(message.method)?.forEach((listener) => listener(message.params));
      listeners.delete(message.method);
    }
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: done, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((done) => {
    listeners.set(method, [...(listeners.get(method) ?? []), done]);
  });
  return new Promise((ready, reject) => {
    socket.addEventListener('open', () => ready({ send, once, close: () => socket.close() }));
    socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)));
  });
}

// The "同じコード" window must open next to the clicked point without covering it, stay inside the viewport,
// and move by its handle with the pointer and the arrow keys. Returns the problems found, or null when the page has no such window.
async function checkPeek(cdp, width) {
  const evaluate = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  const mouse = (type, x, y, buttons) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  const windowRect = `(() => { const open = document.querySelector('.code-peek:popover-open'); if (!open) return null;
    const r = open.getBoundingClientRect(), h = open.querySelector('.code-peek-handle').getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, handle: { x: h.left + 12, y: h.top + h.height / 2 },
      viewport: { width: document.documentElement.clientWidth, height: innerHeight } }; })()`;
  const point = await evaluate(`(async () => { const button = document.querySelector('.same-code'); if (!button) return null;
    button.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 150));
    const r = button.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 3), y: Math.round(r.top + r.height / 2) }; })()`);
  if (!point) return null;
  const problems = [];
  const inside = (r) => r.left >= 0 && r.top >= 0 && r.right <= r.viewport.width + 0.5 && r.bottom <= r.viewport.height + 0.5;
  await mouse('mousePressed', point.x, point.y, 1); await mouse('mouseReleased', point.x, point.y, 0);
  await new Promise((r) => setTimeout(r, 300));
  const opened = await evaluate(windowRect);
  if (!opened) return ['the window does not open'];
  // peek.client.js leaves a 12px gap between the click and the window edge.
  if (Math.abs(opened.top - (point.y + 12)) > 1 && Math.abs(opened.bottom - (point.y - 12)) > 1) problems.push(`the window opens away from the click (click y=${point.y}, window ${Math.round(opened.top)}–${Math.round(opened.bottom)})`);
  if (point.x >= opened.left && point.x <= opened.right && point.y >= opened.top && point.y <= opened.bottom) problems.push('the window covers the clicked button');
  if (!inside(opened)) problems.push('the opened window leaves the viewport');
  // Move toward the viewport centre so that a move is always possible without hitting an edge.
  const toward = (from, to) => Math.max(-40, Math.min(40, Math.round(to - from)));
  const dx = toward(opened.left + opened.width / 2, opened.viewport.width / 2), dy = toward(opened.top + opened.height / 2, opened.viewport.height / 2);
  await mouse('mousePressed', opened.handle.x, opened.handle.y, 1);
  await mouse('mouseMoved', opened.handle.x + dx, opened.handle.y + dy, 1);
  await mouse('mouseReleased', opened.handle.x + dx, opened.handle.y + dy, 0);
  await new Promise((r) => setTimeout(r, 100));
  const dragged = await evaluate(windowRect);
  if ((dx || dy) && dragged.left === opened.left && dragged.top === opened.top) problems.push('dragging the handle does not move the window');
  if (!inside(dragged)) problems.push('the dragged window leaves the viewport');
  const key = dy ? (dy > 0 ? ['ArrowDown', 40] : ['ArrowUp', 38]) : dx > 0 ? ['ArrowRight', 39] : ['ArrowLeft', 37];
  await evaluate(`document.querySelector('.code-peek:popover-open .code-peek-handle').focus()`);
  for (const type of ['rawKeyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: key[0], code: key[0], windowsVirtualKeyCode: key[1] });
  await new Promise((r) => setTimeout(r, 100));
  const keyed = await evaluate(windowRect);
  if ((dx || dy) && keyed.left === dragged.left && keyed.top === dragged.top) problems.push(`${key[0]} on the handle does not move the window`);
  // A reader can narrow the browser while the window is open; the placed window must follow the new viewport.
  // 320px is the narrowest width WCAG 2.1 SC 1.4.10 (Reflow) requires content to fit, so the check never goes below it.
  const narrow = Math.max(320, Math.round(width * 0.75));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: narrow, height: 900, deviceScaleFactor: 1, mobile: narrow < 700 });
  await new Promise((r) => setTimeout(r, 150));
  const narrowed = await evaluate(windowRect), pageWidth = await evaluate('document.documentElement.scrollWidth');
  if (pageWidth > narrowed?.viewport.width) problems.push(`the page itself overflows at ${narrow}px (${pageWidth}px wide), so the window cannot be checked there`);
  else if (narrowed && !inside(narrowed)) problems.push(`the window leaves the viewport after the viewport narrows to ${narrow}px`);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
  await evaluate(`document.querySelector('.code-peek:popover-open')?.hidePopover()`);
  return problems;
}

async function check(cdp, url, width) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
  const { result } = await cdp.send('Runtime.evaluate', { expression: OVERFLOW_PROBE, returnByValue: true });
  const report = result.value;
  const shots = [];
  for (const section of report.sections) {
    const file = join(outDir, `${basename(htmlArg, '.html')}-${width}-${section.id}.png`);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: section.y, width, height: Math.max(section.height, 1), scale: 1 },
    });
    writeFileSync(file, Buffer.from(data, 'base64'));
    shots.push(file);
  }
  const peek = await checkPeek(cdp, width);
  return { width, ...report, peek, screenshots: shots };
}

const profileDir = mkdtempSync(join(tmpdir(), 'visual-check-'));
const { chrome, port } = await launchChrome(profileDir);
try {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  const url = pathToFileURL(resolve(htmlArg)).href;
  const results = [];
  for (const width of widths) results.push(await check(cdp, url, width));
  cdp.close();
  console.log(JSON.stringify({ file: htmlArg, results }, null, 2));
  process.exitCode = results.some((r) => r.overflowCount > 0 || r.documentScrollWidth > r.viewport || r.peek?.length) ? 1 : 0;
} finally {
  chrome.kill();
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
}
