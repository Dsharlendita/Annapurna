// Render halaman HTML -> PNG/JPG lewat Chrome headless (DevTools Protocol), tanpa paket npm.
// Pakai: node render.mjs <url|file> <out.jpg|out.png> <cssWidth> <cssHeight> <scale> [quality] [dpi]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , src, out, W, H, S = '1', Q = '92', DPI = '0'] = process.argv;
const width = +W, height = +H, scale = +S, quality = +Q, dpi = +DPI;
const url = /^https?:|^file:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const fmt = /\.png$/i.test(out) ? 'png' : /\.pdf$/i.test(out) ? 'pdf' : 'jpeg';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '.chrome-profile-' + port);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* belum siap */ }
    await sleep(250);
  }
  throw new Error('Chrome tidak merespons');
}

let ws, seq = 0;
const pending = new Map();
const events = [];
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}
function waitEvent(name, ms = 30000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout ' + name)), ms);
    events.push({ name, cb: (p) => { clearTimeout(t); resolve(p); } });
  });
}

// Tulis kerapatan (DPI) ke header JFIF supaya percetakan membaca ukuran fisik dengan benar
function setJpegDpi(buf, d) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf.toString('latin1', 6, 11) === 'JFIF\0') {
    buf[13] = 1; buf.writeUInt16BE(d, 14); buf.writeUInt16BE(d, 16);
    return buf;
  }
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 255, d >> 8, d & 255, 0x00, 0x00]);
  return Buffer.concat([buf.subarray(0, 2), app0, buf.subarray(2)]);
}

try {
  ws = new WebSocket(await target());
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(p.method + ': ' + msg.error.message)) : p.resolve(msg.result);
    } else if (msg.method) {
      for (let i = events.length - 1; i >= 0; i--) if (events[i].name === msg.method) { events.splice(i, 1)[0].cb(msg.params); }
    }
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const loaded = waitEvent('Page.loadEventFired', 30000).catch(() => console.error('peringatan: load event tidak muncul, lanjut'));
  await send('Page.navigate', { url });
  await loaded;
  // Tunggu font & semua gambar selesai dimuat
  await send('Runtime.evaluate', {
    // Gambar lazy dipaksa eager; total tunggu dibatasi 15 detik supaya tidak pernah macet
    expression: `(() => { document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; });
      const all = Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => null))]);
      return Promise.race([all, new Promise(r => setTimeout(r, 15000))]).then(() => new Promise(r => setTimeout(r, ${process.env.SETTLE_MS || 600}))).then(() => true); })()`,
    awaitPromise: true,
  });
  // Opsional: sembunyikan elemen (HIDE_SEL) dan scroll ke elemen (SCROLL_SEL, offset SCROLL_OFF)
  let scrollY = 0;
  if (process.env.HIDE_SEL || process.env.SCROLL_SEL) {
    const res = await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => {
      const hide = ${JSON.stringify(process.env.HIDE_SEL || '')};
      if (hide) { const st = document.createElement('style'); st.textContent = hide + '{display:none!important}'; document.head.appendChild(st); }
      const sel = ${JSON.stringify(process.env.SCROLL_SEL || '')};
      if (sel) { const el = document.querySelector(sel); if (el) { const y = el.getBoundingClientRect().top + window.scrollY + ${+(process.env.SCROLL_OFF || 0)}; document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: y, behavior: 'instant' }); } }
      document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; });
      await Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => null))), new Promise(r => setTimeout(r, 8000))]);
      await new Promise(r => setTimeout(r, 800)); return window.scrollY; })()`, returnByValue: true });
    scrollY = (res && res.result && res.result.value) || 0;
  }
  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const q = sel => { const el = document.querySelector(sel); return el ? { top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom), height: Math.round(el.getBoundingClientRect().height) } : null; };
      return {
        header: q('.header-card'),
        hero: q('.hero-sec'),
        showcase: q('.showcase-sec'),
        flow: q('.flow-sec'),
        modules: q('.modules-sec'),
        roles: q('.roles-sec'),
        techQr: q('.tech-qr-sec'),
        footer: q('.footer-colophon'),
        bodyScrollHeight: document.body.scrollHeight
      };
    })()`,
    returnByValue: true
  });
  if (info && info.result && info.result.value) {
    console.log('LAYOUT BOUNDS:', JSON.stringify(info.result.value));
  }
  let buf;
  if (fmt === 'pdf') {
    const pdf = await send('Page.printToPDF', {
      printBackground: true,
      paperWidth: width / 25.4,
      paperHeight: height / 25.4,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      preferCSSPageSize: true
    });
    buf = Buffer.from(pdf.data, 'base64');
  } else {
    const shot = await send('Page.captureScreenshot', {
      format: fmt, ...(fmt === 'jpeg' ? { quality } : {}), fromSurface: true, captureBeyondViewport: false,
      clip: { x: 0, y: scrollY, width, height, scale: 1 },
    });
    buf = Buffer.from(shot.data, 'base64');
    if (fmt === 'jpeg' && dpi) buf = setJpegDpi(buf, dpi);
  }
  fs.writeFileSync(out, buf);
  console.log(`OK ${out} ${Math.round(buf.length / 1024)} KB`);
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  spawn('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 1500);
}
