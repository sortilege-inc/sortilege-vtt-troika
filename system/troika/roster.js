// system/troika/roster.js — the characters this browser keeps: several, one current. State
// only; a character file stays the durable form (the creator writes one, the table reads
// it back). Nothing here is shared or sent anywhere.
window.TroikaRoster = (function () {
  const KEY = ((window.VttConfig || {}).storagePrefix || 'sortilege-vtt-troika') + ':site:roster';

  function read() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && r.items) return r;
    } catch (e) { /* no storage */ }
    return { current: null, items: {} };
  }
  function write(r) {
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* no storage */ }
  }
  const gen = () => 'ch-' + Math.random().toString(36).slice(2, 10);

  function list() {
    const r = read();
    return Object.keys(r.items).map((id) => Object.assign({ id }, r.items[id])).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }
  const count = () => list().length;
  const currentId = () => read().current;
  function get(id) {
    const r = read();
    return r.items[id] ? Object.assign({ id }, r.items[id]) : null;
  }
  function current() {
    const r = read();
    return r.current && r.items[r.current] ? Object.assign({ id: r.current }, r.items[r.current]) : null;
  }
  function open(id) {
    const r = read();
    if (r.items[id]) { r.current = id; write(r); }
    return current();
  }
  function add(v) {
    const r = read();
    const id = gen();
    r.items[id] = { character: v, savedAt: new Date().toISOString() };
    r.current = id;
    write(r);
    return id;
  }
  function save(id, v) {
    const r = read();
    if (!r.items[id]) return add(v);
    r.items[id] = { character: v, savedAt: new Date().toISOString() };
    write(r);
    return id;
  }
  function remove(id) {
    const r = read();
    delete r.items[id];
    if (r.current === id) r.current = list().length ? list()[0].id : null;
    write(r);
  }
  function duplicate(id) {
    const c = get(id);
    return c ? add(JSON.parse(JSON.stringify(c.character))) : null;
  }
  return { KEY, list, count, currentId, get, current, open, add, save, remove, duplicate };
})();
