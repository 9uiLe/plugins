// Render an explainer HTML file at several viewport widths through the Chrome
// DevTools Protocol; print overflow and Code Map identifier-wrap findings as JSON
// and save one screenshot per section.
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
    .map((el) => ({ element: describe(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
  const sections = [...document.querySelectorAll('main section[id]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { id: s.id, y: Math.round(r.top + scrollY), height: Math.round(r.height) };
  });
  return { identifierWrap, viewport, documentScrollWidth: document.documentElement.scrollWidth, overflow: overflow.slice(0, 20),
           overflowCount: overflow.length, scrollers, sections };
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
  return { width, ...report, screenshots: shots };
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
  process.exitCode = results.some((r) => r.overflowCount > 0) ? 1 : 0;
} finally {
  chrome.kill();
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
}
