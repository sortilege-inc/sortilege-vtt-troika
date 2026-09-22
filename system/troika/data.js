// system/troika/data.js — accessors over the generated corpus (window.TROIKA from
// data/*.js). This is the only file that knows the data's shape; the reader, the panels
// and (after D1) the sheet ask here.
//
// The one thing worth saying about this corpus: its structure IS nesting. The Rules are a
// tree of DEFs numbered by the book (1 › 1.1 › 1.1.2), a chapter's essays sit under the
// chapter's DEF, and the printed sheet's labels sit under ^"Character Sheet". So a book's
// outline is the entity tree in printed order, and nothing here rebuilds it from fields.
window.TroikaData = (function () {
  const EMPTY = { books: {}, entities: {}, loaded: {}, index: { books: [] } };
  const T = () => window.TROIKA || EMPTY;

  const index = () => T().index || { books: [], counts: {} };
  const books = () => (index().books || []).slice();
  const book = (id) => T().books[id] || null;
  const indexBook = (id) => (index().books || []).find((b) => b.id === id) || null;
  const entity = (id) => T().entities[id] || null;

  function children(id) {
    const e = entity(id);
    return e ? e.children.map(entity).filter(Boolean) : [];
  }

  function ancestors(id) {
    const out = [];
    let e = entity(id);
    while (e && e.parent) {
      e = entity(e.parent);
      if (e) out.unshift(e);
    }
    return out;
  }

  const top = (bid) => ((book(bid) || {}).entities || []).map(entity).filter(Boolean);

  // Every entity of a set of chapters, top level first, then nested, in printed order.
  function all(bookIds) {
    const ids = bookIds && bookIds.length ? bookIds : books().map((b) => b.id);
    const out = [];
    ids.forEach((bid) => {
      const stack = ((book(bid) || {}).entities || []).slice();
      while (stack.length) {
        const e = entity(stack.shift());
        if (!e) continue;
        out.push(e);
        stack.unshift.apply(stack, e.children);
      }
    });
    return out;
  }

  const byType = (type, bookIds) => all(bookIds).filter((e) => e.type === type);
  const byForm = (form, bookIds) => all(bookIds).filter((e) => e.form === form);

  function prop(e, name) {
    return e && (e.props || []).find((p) => p.name === name) || null;
  }

  function val(e, name) {
    const p = prop(e, name);
    if (!p) return undefined;
    if (p.vk === 'scalar' || p.vk === 'enum') return p.value;
    if (p.vk === 'ref') return p.ref;
    if (p.vk === 'list') return p.items;
    return p;
  }

  const text = (e, name) => {
    const v = val(e, name);
    return typeof v === 'string' ? v : null;
  };

  // The BASE's declaration of a type: the entity whose key is the type name and EXTENDS
  // nothing. Its props are the declared fields, in declared order.
  function declaration(typeName) {
    return all(['base']).find((e) => e.key === typeName && !e.type) || null;
  }

  // ── a chapter's outline: the entity tree ───────────────────────────
  // A rule's label carries its number; an entity named by its number alone (the corpus's
  // "15.1.2") is labelled by the number and nothing else.
  function label(e) {
    const n = val(e, 'Number');
    if (e.type === 'Rule' && n) return e.name === n ? n : n + '  ' + e.name;
    return e.name;
  }

  const outlineCache = {};
  function outline(bid) {
    if (outlineCache[bid]) return outlineCache[bid].roots;
    const map = {};
    const build = (e, parent, depth) => {
      const node = { id: e.id, entity: e, label: label(e), depth, parent, kids: [] };
      map[e.id] = node;
      children(e.id).forEach((k) => node.kids.push(build(k, node, depth + 1)));
      return node;
    };
    const roots = top(bid).map((e) => build(e, null, 0));
    outlineCache[bid] = { roots, map };
    return roots;
  }

  function node(bid, id) {
    outline(bid);
    return outlineCache[bid].map[id] || null;
  }

  function trail(bid, id) {
    const out = [];
    let n = node(bid, id);
    while (n) {
      out.unshift(n);
      n = n.parent;
    }
    return out;
  }

  // ── the adventure ──────────────────────────────────────────────────
  const arc = (bid) => ((book(bid) || {}).arcs || [])[0] || null;

  // Printed order: the FLOW's phases, then any scene no phase references.
  function pages(bid) {
    const a = arc(bid);
    if (!a) return [];
    const out = [];
    const seen = new Set();
    (a.phases || []).forEach((ph) => (ph.scenes || []).forEach((id) => {
      const s = a.scenes.find((x) => x.id === id);
      if (s) {
        seen.add(id);
        out.push({ phase: ph.name, scene: s });
      }
    }));
    a.scenes.forEach((s) => {
      if (!seen.has(s.id)) out.push({ phase: null, scene: s });
    });
    return out;
  }

  const scene = (bid, sid) => (((arc(bid) || {}).scenes || []).find((s) => s.id === sid)) || null;

  // ── rules by number: what "(11.1)" in the text names ───────────────
  let numberIndex = null;
  function ruleByNumber(num) {
    if (!numberIndex) {
      numberIndex = {};
      byType('Rule').forEach((e) => {
        const n = val(e, 'Number');
        if (n && !numberIndex[n]) numberIndex[n] = e;
      });
    }
    return numberIndex[num] || null;
  }

  // ── search ─────────────────────────────────────────────────────────
  function searchText(e) {
    const parts = [e.name, e.desc || ''];
    (e.props || []).forEach((p) => {
      if ((p.vk === 'scalar' || p.vk === 'enum') && typeof p.value === 'string') parts.push(p.value);
      if (p.vk === 'list') (p.items || []).forEach((it) => {
        if (it.vk === 'scalar') parts.push(String(it.value));
        if (it.vk === 'def') (it.fields || []).forEach((f) => f.value != null && parts.push(String(f.value)));
      });
    });
    (e.entries || []).forEach((r) => (r.fields || []).forEach((f) => f.value != null && parts.push(String(f.value))));
    if (e.table) e.table.rows.forEach((r) => parts.push(r.join(' ')));
    (e.guidance || []).forEach((g) => parts.push(g.text || ''));
    return parts.join('\n');
  }

  const cache = new Map();
  function search(query, bookIds, limit) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    all(bookIds).forEach((e) => {
      let t = cache.get(e.id);
      if (t === undefined) {
        t = searchText(e).toLowerCase();
        cache.set(e.id, t);
      }
      const inName = e.name.toLowerCase().indexOf(q) !== -1;
      if (inName || t.indexOf(q) !== -1) hits.push({ e, score: inName ? 0 : 1 });
    });
    // the adventure's scenes are not entities; search them too
    books().filter((b) => b.kind === 'adventure' && (!bookIds || !bookIds.length || bookIds.indexOf(b.id) !== -1)).forEach((b) => {
      pages(b.id).forEach((p) => {
        const s = p.scene;
        const t = (s.name + '\n' + (s.desc || '')).toLowerCase();
        if (t.indexOf(q) !== -1) hits.push({ e: { id: s.id, name: s.name, type: 'Scene', book: b.id, desc: s.desc, props: [], scene: true }, score: s.name.toLowerCase().indexOf(q) !== -1 ? 0 : 1 });
      });
    });
    hits.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name));
    return hits.slice(0, limit || 200).map((h) => h.e);
  }

  // Where a string was found, with enough either side to read it.
  function excerpt(e, query, n) {
    const t = e.scene ? (e.name + '\n' + (e.desc || '')) : searchText(e);
    const i = t.toLowerCase().indexOf(String(query).toLowerCase());
    if (i < 0) return null;
    const a = Math.max(0, i - (n || 60));
    const b = Math.min(t.length, i + String(query).length + (n || 60));
    return (a ? '…' : '') + t.slice(a, b).replace(/\n+/g, ' ') + (b < t.length ? '…' : '');
  }

  return {
    T, index, books, book, indexBook, entity, children, ancestors, top, all, byType, byForm,
    prop, val, text, declaration, label, outline, node, trail, arc, pages, scene, ruleByNumber,
    search, excerpt,
  };
})();
