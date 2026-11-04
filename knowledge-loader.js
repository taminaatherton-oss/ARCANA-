/* ARCANA Knowledge Loader v1.0
 * One-time integration helper. Discovers every .json file in /knowledge via GitHub Contents API,
 * caches the files in a separate IndexedDB database, and remains searchable offline afterwards.
 */
(() => {
  'use strict';
  const OWNER = 'taminaatherton-oss';
  const REPO = 'ARCANA-';
  const BRANCH = 'main';
  const FOLDER = 'knowledge';
  const DB = 'arcana-knowledge-cache';
  const STORE = 'files';
  let memory = [];

  function openCache() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'name' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function cacheAll(items) {
    const db = await openCache();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      items.forEach(item => store.put({ name: item.name, data: item.data, cachedAt: new Date().toISOString() }));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async function readCache() {
    const db = await openCache();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }
  async function refresh() {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FOLDER}?ref=${BRANCH}`;
    const response = await fetch(api, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
    const listing = await response.json();
    const jsonFiles = listing.filter(x => x.type === 'file' && x.name.toLowerCase().endsWith('.json'));
    const loaded = await Promise.all(jsonFiles.map(async file => {
      const r = await fetch(file.download_url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Не удалось загрузить ${file.name}: ${r.status}`);
      return { name: file.name, data: await r.json() };
    }));
    await cacheAll(loaded);
    memory = loaded;
    return { count: loaded.length, offline: false };
  }
  async function load() {
    try {
      const result = await refresh();
      return result;
    } catch (error) {
      const cached = await readCache();
      memory = cached.map(x => ({ name: x.name, data: x.data }));
      if (memory.length) return { count: memory.length, offline: true, warning: error.message };
      throw new Error(`База знаний ещё не загружалась онлайн и недоступна офлайн: ${error.message}`);
    }
  }
  function flatten(value, path = '', out = []) {
    if (value == null) return out;
    if (typeof value === 'string' || typeof value === 'number') out.push(`${path}: ${value}`);
    else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
    else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => flatten(v, path ? `${path}.${k}` : k, out));
    return out;
  }
  function tokens(s) { return (String(s).toLocaleLowerCase('ru').match(/[а-яёa-z0-9]{3,}/g) || []).filter(x => !['это','как','что','для','или','при','про','его','она','они','the','and'].includes(x)); }
  async function search(query, limit = 8) {
    if (!memory.length) await load();
    const q = [...new Set(tokens(query))];
    if (!q.length) return [];
    const results = [];
    for (const file of memory) {
      const lines = flatten(file.data);
      const text = lines.join('\n');
      const lower = text.toLocaleLowerCase('ru');
      let score = 0;
      for (const word of q) {
        let at = 0, n = 0;
        while ((at = lower.indexOf(word, at)) !== -1 && n < 8) { n++; at += word.length; }
        score += n * (word.length > 6 ? 2 : 1);
      }
      if (score) results.push({ file: file.name, score, excerpt: lines.filter(line => q.some(w => line.toLocaleLowerCase('ru').includes(w))).slice(0, 12).join('\n') });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  window.ARCANA_KNOWLEDGE = { load, refresh, search, get files() { return memory.map(x => x.name); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => load().catch(() => {}), { once: true });
  else load().catch(() => {});
})();
