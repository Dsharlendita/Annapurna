// Menjalankan public/assets/js/data.js di Node dengan browser tiruan (localStorage, document, fetch).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeEnv(root, opts = {}) {
  const store = new Map(Object.entries(opts.storage || {}));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const session = new Map();
  const sessionStorage = { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, String(v)), removeItem: (k) => session.delete(k) };
  const listeners = {};
  const fetchCalls = [];
  const fetchImpl = opts.fetch || (async (url, init) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, map: {} }) }));
  const win = {
    localStorage, sessionStorage, console,
    location: { pathname: '/', search: '', href: '' },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent: () => true,
    setTimeout, clearTimeout, Date, Math, JSON, Promise,
    fetch: (url, init) => { fetchCalls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); return fetchImpl(url, init); },
  };
  win.window = win;
  win.self = win;
  win.document = {
    querySelector: (s) => (s.includes('csrf') ? { content: 'tok' } : null),
    body: { dataset: { base: '/' } },
    addEventListener: () => {}, dispatchEvent: () => true,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  };
  win.CustomEvent = class { constructor(t, d) { this.type = t; this.detail = d && d.detail; } };
  win.navigator = { userAgent: 'node' };
  const ctx = vm.createContext(win);
  const code = fs.readFileSync(path.join(root, 'public/assets/js/data.js'), 'utf8');
  vm.runInContext(code, ctx, { filename: 'data.js' });
  return { win, ctx, store, fetchCalls, listeners, run: (src) => vm.runInContext(src, ctx) };
}

module.exports = { makeEnv };

