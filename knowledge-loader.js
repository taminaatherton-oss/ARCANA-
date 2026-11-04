/* ARCANA Knowledge Loader v1.2
   Loads the root catalog.json from raw.githubusercontent.com (no GitHub Contents API).
   Supports catalog files stored in repository root or /knowledge/ and keeps an offline IndexedDB cache.
*/
(() => {
  'use strict';
  const OWNER = 'taminaatherton-oss';
  const REPO = 'ARCANA-';
  const BRANCH = 'main';
  const DB = 'arcana-knowledge-cache';
  const STORE = 'files';
  let memory = [];
  const raw = path => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;

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
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Не удалось сохранить локальный кэш')); };
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
  async function fetchJson(path) {
    const url = raw(path);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }
  async function getCatalog() {
    const attempts = ['catalog.json', 'knowledge/catalog.json'];
    const errors = [];
    for (const path of attempts) {
      try {
        const catalog = await fetchJson(path);
        if (!catalog || !Array.isArray(catalog.files)) throw new Error(`${path}: в каталоге нет массива files`);
        return { catalog, base: path.includes('/') ? 'knowledge/' : '' };
      } catch (e) { errors.push(e.message); }
    }
    throw new Error(`Не найден catalog.json. Проверены: ${errors.join('; ')}`);
  }
  async function refresh() {
    const { catalog, base } = await getCatalog();
    const entries = catalog.files.filter(x => x && typeof x.file === 'string' && x.file.toLowerCase().endsWith('.json'));
    if (!entries.length) throw new Error('В catalog.json нет JSON-библиотек');
    const loaded = await Promise.all(entries.map(async entry => {
      const fileName = entry.file;
      let data;
      try { data = await fetchJson(base + fileName); }
      catch (firstError) {
        if (!base) data = await fetchJson('knowledge/' + fileName);
        else throw firstError;
      }
      return { name: fileName, label: entry.label || fileName, domain: entry.domain || 'general', data };
    }));
    await cacheAll(loaded);
    memory = loaded;
    return { count: loaded.length, offline: false, source: base || 'корень репозитория' };
  }
  async function load() {
    try { return await refresh(); }
    catch (error) {
      try {
        const cached = await readCache();
        memory = cached.map(x => ({ name: x.name, label: x.label || x.name, domain: x.domain || 'general', data: x.data }));
      } catch (_) { memory = []; }
      if (memory.length) return { count: memory.length, offline: true, warning: error.message };
      throw new Error(error.message);
    }
  }
  function flatten(value, path = '', out = []) {
    if (value == null) return out;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out.push(`${path}: ${value}`);
    else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
    else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => flatten(v, path ? `${path}.${k}` : k, out));
    return out;
  }
  function tokens(s) {
    return (String(s).toLocaleLowerCase('ru').match(/[а-яёa-z0-9]{2,}/g) || [])
      .filter(x => !['это','как','что','для','или','при','про','его','она','они','the','and'].includes(x));
  }
  async function search(query, limit = 8) {
    if (!memory.length) await load();
    const q = [...new Set(tokens(query))];
    if (!q.length) return [];
    const results = [];
    for (const file of memory) {
      const lines = flatten(file.data);
      const lower = lines.join('\n').toLocaleLowerCase('ru');
      let score = 0;
      for (const word of q) {
        let at = 0, n = 0;
        while ((at = lower.indexOf(word, at)) !== -1 && n < 8) { n++; at += word.length; }
        score += n * (word.length > 6 ? 2 : 1);
      }
      if (score) results.push({ file: file.name, label: file.label, domain: file.domain, score, excerpt: lines.filter(line => q.some(w => line.toLocaleLowerCase('ru').includes(w))).slice(0, 14).join('\n') });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  window.ARCANA_KNOWLEDGE = { load, refresh, search, get files() { return memory.map(x => x.name); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => load().catch(() => {}), { once: true });
  else load().catch(() => {});
})();
