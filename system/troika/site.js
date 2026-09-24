// system/troika/site.js — what Troika! puts on the site: the book by chapter, the
// Bestiary, and the character-creation chapter with its backgrounds. Every word shown
// comes from titterpig-dsl-troika/0.5 through data/; this file decides only what is
// listed where.
window.VttSiteTabs = (function () {
  const { el, debounce } = window.VttRender;
  const D = window.TroikaData;
  const E = window.TroikaEntity;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens that entity in the reader
  window.TroikaOpenEntity = (id) => {
    const e = D.entity(id);
    if (e) Site().go('book', [e.book, id]);
  };

  // ── the shelf: the book's own contents ─────────────────────────────
  function renderShelf(container, ctx) {
    const page = el('div', { class: 'page' });
    container.appendChild(page);
    const idx = D.index();
    page.appendChild(el('h2', {}, ['Troika! Numinous Edition']));
    page.appendChild(el('p', { class: 'muted' }, [
      'The whole book, generated from its corpus: ', String(idx.counts.entities), ' entries out of ',
      String(idx.counts.files), ' files. Open a chapter.',
    ]));
    page.appendChild(el('div', { class: 'shelf' }, D.books().filter((b) => b.kind !== 'base').map((b) => el('a', {
      class: 'shelf-book', href: ctx.href('book', [b.id]),
    }, [
      el('div', { class: 'shelf-title' }, [b.label]),
      el('div', { class: 'muted small' }, [
        [b.counts.entities ? b.counts.entities + ' entries' : null, b.counts.scenes ? b.counts.scenes + ' scenes' : null].filter(Boolean).join(' · '),
      ]),
    ]))));
    const base = D.books().find((b) => b.kind === 'base');
    if (base) {
      page.appendChild(el('h4', {}, ['Under the hood']));
      page.appendChild(el('div', { class: 'shelf' }, [el('a', { class: 'shelf-book', href: ctx.href('book', [base.id]) }, [
        el('div', { class: 'shelf-title' }, [base.label]),
        el('div', { class: 'muted small' }, ['the types the corpus instantiates']),
      ])]));
    }
  }

  // ── the outline ────────────────────────────────────────────────────
  function outlineTree(bid, nodes, openId, ctx) {
    return el('ul', { class: 'toc' }, nodes.map((n) => {
      const open = openId && (n.id === openId || contains(n, openId));
      const a = el('a', { class: 'ref' + (n.id === openId ? ' active' : ''), href: ctx.href('book', [bid, n.id]) }, [n.label]);
      return el('li', {}, [
        n.kids.length
          ? el('details', { open: open || null }, [el('summary', {}, [a]), outlineTree(bid, n.kids, openId, ctx)])
          : a,
      ]);
    }));
  }

  function contains(n, id) {
    return n.kids.some((k) => k.id === id || contains(k, id));
  }

  function contentsOf(bid, n, ctx) {
    if (!n || !n.kids.length) return null;
    return el('div', { class: 'contents' }, [
      el('h4', {}, ['In this section']),
      el('ul', { class: 'items' }, n.kids.map((k) => el('li', {}, [
        el('a', { class: 'ref', href: ctx.href('book', [bid, k.id]) }, [k.label]),
      ]))),
    ]);
  }

  // a page of a chapter: the entity verbatim, then what is under it as a list
  function readingPage(bid, n, ctx) {
    const wrap = el('div', {});
    const t = D.trail(bid, n.id);
    if (t.length > 1) {
      wrap.appendChild(el('div', { class: 'crumbs' }, t.slice(0, -1).map((x, i) => [
        i ? ' › ' : null, el('a', { href: ctx.href('book', [bid, x.id]) }, [x.label]),
      ])));
    }
    // a rule's own text with its sub-rules listed; anything else whole
    const deep = n.entity.type === 'Rule' || n.kids.length > 6;
    wrap.appendChild(E.render(n.entity, { noKids: deep }));
    const contents = deep ? contentsOf(bid, n, ctx) : null;
    if (contents) wrap.appendChild(contents);
    return wrap;
  }

  // ── the adventure: phases and scenes ───────────────────────────────
  function adventurePage(bid, path, ctx) {
    const b = D.book(bid);
    const a = D.arc(bid);
    const pages = D.pages(bid);
    const openId = path[1] || null;
    const toc = el('div', { class: 'site-toc' });
    let phase = null;
    const list = el('ul', { class: 'toc' });
    pages.forEach((p) => {
      if (p.phase !== phase) {
        phase = p.phase;
        list.appendChild(el('li', { class: 'toc-phase' }, [phase || 'Other scenes']));
      }
      list.appendChild(el('li', {}, [el('a', { class: 'ref' + (openId === p.scene.id ? ' active' : ''), href: ctx.href('book', [bid, p.scene.id]) }, [p.scene.name])]));
    });
    // the arc's entities (the ground floor's description, the reference cards)
    D.top(bid).forEach((e) => list.appendChild(el('li', {}, [el('a', { class: 'ref' + (openId === e.id ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name])])));
    toc.appendChild(el('a', { class: 'ref' + (!openId ? ' active' : ''), href: ctx.href('book', [bid]) }, [a.name]));
    toc.appendChild(list);
    const s = openId && D.scene(bid, openId);
    const e = openId && D.entity(openId);
    const body = el('div', { class: 'site-reader' }, [
      s ? E.scene(s) : e ? E.render(e) : el('div', {}, [
        el('h2', {}, [a.name]),
        E.prose(a.desc),
        el('h4', {}, ['The routes']),
        el('ul', { class: 'items' }, (a.phases || []).map((ph) => el('li', {}, [ph.name, el('span', { class: 'muted small' }, [' · ' + ph.scenes.length + ' scenes'])]))),
      ]),
    ]);
    return el('div', { class: 'reader' }, [toc, body]);
  }

  // ── the reader ─────────────────────────────────────────────────────
  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : null;
    if (!bid) return renderShelf(container, ctx);
    const meta = D.indexBook(bid);
    const page = el('div', { class: 'page' });
    container.appendChild(page);
    page.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('book', []) }, ['Troika!']), ' › ', meta.label]));

    if (meta.kind === 'adventure') {
      page.appendChild(adventurePage(bid, path, ctx));
      return;
    }

    const openId = path[1] && D.node(bid, path[1]) ? path[1] : null;
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search', placeholder: 'Search ' + meta.label + '…' });
    q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
    const toc = el('div', { class: 'site-toc' }, [q, results, outlineTree(bid, D.outline(bid), openId, ctx)]);
    const n = openId ? D.node(bid, openId) : null;
    const body = el('div', { class: 'site-reader' }, [n ? readingPage(bid, n, ctx) : chapterFront(bid, meta, ctx)]);
    page.appendChild(el('div', { class: 'reader' }, [toc, body]));
  }

  function chapterFront(bid, meta, ctx) {
    const b = D.book(bid);
    const roots = D.outline(bid);
    // a chapter of records (spells, skills, items, enemies) opens as a grid of cards
    const single = roots.length === 1 && roots[0].kids.length;
    const grid = roots.length > 8 && roots.every((n) => !n.kids.length);
    return el('div', {}, [
      el('h2', {}, [meta.label]),
      el('div', { class: 'muted small' }, [meta.title]),
      grid ? el('div', { class: 'cards' }, roots.map((n) => E.card(n.entity, () => Site().go('book', [bid, n.id])))) : null,
      !grid && single ? readingPage(bid, roots[0], ctx) : null,
      !grid && !single ? el('div', { class: 'contents' }, [
        el('h4', {}, ['Contents']),
        el('ul', { class: 'items' }, roots.map((n) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, n.id]) }, [n.label])]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const shown = hits.slice(0, 60);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' hits' + (hits.length > shown.length ? ' — the first ' + shown.length : '')]));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
  }

  // ── the Bestiary ───────────────────────────────────────────────────
  const bestiaryState = { q: '' };
  function renderBestiary(container, path, ctx) {
    const page = el('div', { class: 'page' });
    container.appendChild(page);
    const enemies = D.byType('Enemy', ['enemies']);
    const openId = path[0] && D.entity(path[0]) ? path[0] : null;
    if (openId) {
      page.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('bestiary', []) }, ['The Bestiary']), ' › ', D.entity(openId).name]));
      page.appendChild(E.render(D.entity(openId)));
      return;
    }
    page.appendChild(el('h2', {}, ['The Bestiary']));
    const roster = D.top('enemies').find((e) => e.key === 'Bestiary');
    if (roster && roster.desc) page.appendChild(el('p', { class: 'muted' }, [roster.desc]));
    const q = el('input', { type: 'search', class: 'search', placeholder: 'Find an enemy…', value: bestiaryState.q });
    const grid = el('div', { class: 'cards' });
    const count = el('span', { class: 'muted small' });
    function apply() {
      const t = bestiaryState.q.toLowerCase();
      const rows = enemies.filter((e) => !t || (e.name + ' ' + (D.text(e, 'Description') || '') + ' ' + (D.text(e, 'Special') || '')).toLowerCase().indexOf(t) !== -1);
      grid.innerHTML = '';
      count.textContent = rows.length + ' of ' + enemies.length;
      rows.forEach((e) => grid.appendChild(E.card(e, () => Site().go('bestiary', [e.id]))));
    }
    q.addEventListener('input', debounce(() => { bestiaryState.q = q.value.trim(); apply(); }, 200));
    page.appendChild(el('div', { class: 'chiprow' }, [q, count]));
    page.appendChild(grid);
    apply();
  }

  // ── making a character: the creator over the roster (system/troika/creator.js) ──
  function renderCharacters(container, path, ctx) {
    const openId = path[0] && D.entity(path[0]) ? path[0] : null;
    if (openId) {
      const page = el('div', { class: 'page' });
      container.appendChild(page);
      page.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('characters', []) }, ['Making a character']), ' › ', D.entity(openId).name]));
      page.appendChild(E.render(D.entity(openId)));
      return;
    }
    window.TroikaCreator.render(container, path, ctx);
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const page = el('div', { class: 'page' });
    container.appendChild(page);
    page.appendChild(el('h2', {}, ['Search the book']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, a spell, a thing…', value: searchState.q });
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); showHits(results, searchState.q, null, ctx); }, 250));
    page.appendChild(q);
    page.appendChild(results);
    if (searchState.q) showHits(results, searchState.q, null, ctx);
    setTimeout(() => q.focus(), 0);
  }

  return [
    { id: 'book', label: 'The book', render: renderBook, books: true },
    { id: 'bestiary', label: 'Bestiary', render: renderBestiary, books: true },
    { id: 'characters', label: 'Making a character', render: renderCharacters, books: true },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
})();
