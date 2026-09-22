// system/troika/entity.js — one entity, as the book holds it.
//
// Generic by design: an entity is rendered from its own text, properties, table and
// entries, whatever type it is, so a rule, a background, a spell, a weapon table and a
// bestiary entry all come out without this file naming any of them. Every string shown is
// the book's; the only words added are the property names, which are the corpus's own too.
//
// Two things about the text (PLAN.md D5): the conversion carries the book's italics and
// bold as Markdown marks inside the string, and those are set as emphasis here — the
// string in data/ is untouched; and a parenthesised rule number, "(11.1)", is linked to
// the rule the corpus gives that Number.
window.TroikaEntity = (function () {
  const { el, esc } = window.VttRender;
  const D = window.TroikaData;

  // The property that IS the entity's text, printed with no label above it.
  const BODY = ['Description', 'Text'];
  // Said in the heading, not listed in the body.
  const HEADER = ['Name', 'Number', 'Title'];

  // ── the text ───────────────────────────────────────────────────────
  function inline(s) {
    let h = esc(s);
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
    // "(11.1)" → the rule with that Number, when the corpus has one
    h = h.replace(/\((\d+(?:\.\d+)+)\)/g, (m, num) => {
      const r = D.ruleByNumber(num);
      return r ? '(<a class="ref rule-ref" href="#" data-rule="' + r.id + '">' + num + '</a>)' : m;
    });
    return h;
  }

  // Source text uses \n\n for paragraph breaks and \n for line breaks; nothing is added
  // or reflowed — the text stays the book's.
  function prose(text, cls) {
    if (text == null || text === '') return null;
    const wrap = el('div', { class: cls || 'prose' });
    String(text).split(/\n\s*\n/).forEach((p) => {
      wrap.appendChild(el('p', { html: inline(p).replace(/\n/g, '<br>') }));
    });
    wrap.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a.rule-ref');
      if (!a) return;
      ev.preventDefault();
      if (window.TroikaOpenEntity) window.TroikaOpenEntity(a.dataset.rule);
    });
    return wrap;
  }

  // A reference to another entity: a link when the target is loaded, the printed name when
  // it is not.
  function link(ref) {
    const target = ref && ref.hash && D.entity(ref.hash);
    const label = (ref && ref.name) || (target && target.name) || '';
    if (!target) return el('span', {}, [label]);
    return el('a', {
      class: 'ref', href: '#', onclick: (ev) => {
        ev.preventDefault();
        if (window.TroikaOpenEntity) window.TroikaOpenEntity(target.id);
      },
    }, [label]);
  }

  // ── values ─────────────────────────────────────────────────────────
  // A def-valued list item (a Background's "4 Strength", an enemy's "1 Hungry") reads as
  // one line: its scalar fields in declared order, a true boolean as its own name.
  function defLine(fields) {
    const bits = [];
    (fields || []).forEach((f) => {
      if (f.vk === 'scalar' || f.vk === 'enum') {
        if (typeof f.value === 'boolean') {
          if (f.value) bits.push(el('span', { class: 'flag' }, [f.name]));
        } else if (f.value != null) bits.push(el('span', { class: 'f-' + f.name.toLowerCase().replace(/\W+/g, '-') }, [String(f.value)]));
      } else if (f.vk === 'ref') bits.push(link(f.ref));
      else if (f.vk === 'list') bits.push(el('span', {}, [(f.items || []).map((it) => it.vk === 'scalar' ? String(it.value) : (it.name || '')).join(', ')]));
    });
    return el('span', { class: 'defline' }, bits.map((b, i) => [i ? ' ' : null, b]));
  }

  function value(p) {
    if (p.vk === 'ref') return link(p.ref);
    if (p.vk === 'list') {
      if (!p.items || !p.items.length) return null;
      return el('ul', { class: 'items' }, p.items.map((it) => el('li', {}, [
        it.vk === 'ref' ? link(it) : it.vk === 'def' ? defLine(it.fields) : el('span', { html: inline(String(it.value)) }),
      ])));
    }
    if (p.vk === 'def') return fields(p.fields);
    if (p.value === undefined) return null;
    if (typeof p.value === 'boolean') return el('span', {}, [p.value ? 'yes' : 'no']);
    return prose(String(p.value), 'prose');
  }

  function fields(list) {
    return el('div', { class: 'fields' }, (list || []).map((f) => {
      const v = value(f);
      return v ? el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [f.name]), el('div', { class: 'prop-v' }, [v])]) : null;
    }));
  }

  // A type's declaration, not an instance's value.
  function isDeclaration(p) {
    return p.value === undefined && p.vk !== 'list' && p.vk !== 'def' && p.vk !== 'ref';
  }

  // ── a printed table, cell for cell ─────────────────────────────────
  function table(t) {
    if (!t) return null;
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, t.columns.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c, i) => el(i ? 'td' : 'th', { scope: i ? null : 'row', html: inline(String(c)) }))))),
    ])]);
  }

  // ENTRIES rows: hashless defs under a table (the weapons), or entities by id.
  function entries(list) {
    if (!list || !list.length) return null;
    return el('div', { class: 'entries' }, list.map((r) => {
      if (r.vk === 'entity') {
        const e = D.entity(r.id);
        return e ? el('div', { class: 'nested' }, [render(e)]) : null;
      }
      return el('div', { class: 'entry' }, [
        el('div', { class: 'entry-h' }, [r.name, r.type ? el('span', { class: 'etype' }, [r.type]) : null]),
        fields((r.fields || []).filter((f) => f.name !== 'Name')),
      ]);
    }));
  }

  // ── a stat block: an ACTOR's declared INTEGER fields as a strip ────
  function statStrip(e) {
    const decl = e.type ? D.declaration(e.type) : null;
    if (!decl) return null;
    const stats = decl.props.filter((p) => p.type === 'INTEGER').map((p) => p.name);
    const cells = stats.map((n) => {
      const v = D.val(e, n);
      return v == null ? null : el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [n]), el('div', { class: 'stat-v' }, [String(v)])]);
    }).filter(Boolean);
    return cells.length ? el('div', { class: 'stats' }, cells) : null;
  }

  function header(e) {
    const bits = [];
    if (e.form === 'ACTOR') bits.push('a ' + e.name + ' has these fields');
    const n = D.val(e, 'Number');
    if (n && e.type === 'Rule') bits.push('rule ' + n);
    const roll = D.val(e, 'Roll');
    if (roll != null && e.type === 'Background') bits.push('d66 · ' + roll);
    const cost = D.val(e, 'Cost');
    if (cost != null && e.type === 'Spell') bits.push('cost ' + cost);
    return bits;
  }

  // The whole entity: its heading, its text, its table, its remaining properties, its
  // entries, and what hangs under it.
  function render(e, opts) {
    const o = opts || {};
    const box = el('article', { class: 'entity' + (e.form === 'ACTOR' ? ' actor' : '') + (e.type ? ' type-' + e.type.toLowerCase().replace(/\W+/g, '-') : '') });
    if (!o.bare) {
      box.appendChild(el('h3', {}, [
        e.type === 'Rule' && D.val(e, 'Number') && e.name !== D.val(e, 'Number') ? el('span', { class: 'rule-n' }, [D.val(e, 'Number') + ' ']) : null,
        e.name,
        e.type ? el('span', { class: 'etype' }, [e.type]) : e.form === 'ACTOR' ? el('span', { class: 'etype' }, ['actor type']) : null,
      ]));
      const bits = header(e);
      if (bits.length) box.appendChild(el('div', { class: 'muted small' }, [bits.join(' · ')]));
    }

    const strip = e.type && D.declaration(e.type) && D.declaration(e.type).form === 'ACTOR' ? statStrip(e) : null;
    if (strip) box.appendChild(strip);

    // the entity's own text (DESCRIPTION) and then the property that is its text
    if (e.desc) box.appendChild(prose(e.desc));
    const stripped = strip ? D.declaration(e.type).props.filter((p) => p.type === 'INTEGER').map((p) => p.name) : [];
    (e.props || []).forEach((p) => {
      if (HEADER.indexOf(p.name) !== -1 || stripped.indexOf(p.name) !== -1) return;
      if (isDeclaration(p)) {
        // a type's declared field: show the field and its type, so the BASE reads as a schema
        box.appendChild(el('div', { class: 'prop decl' }, [
          el('div', { class: 'prop-k' }, [p.name]),
          el('div', { class: 'prop-v muted small' }, [[p.type || p.vk, p.vk === 'list' ? 'of ' + (p.of || '') : null, p.vk === 'enum' && p.options ? '[' + p.options.join(', ') + ']' : null, p.required ? 'required' : null, p.min != null ? 'min ' + p.min : null, p.max != null ? 'max ' + p.max : null].filter(Boolean).join(' ')]),
        ]));
        return;
      }
      const v = value(p);
      if (!v) return;
      if (BODY.indexOf(p.name) !== -1) {
        box.appendChild(v);
        return;
      }
      box.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name]), el('div', { class: 'prop-v' }, [v])]));
    });

    const t = table(e.table);
    if (t) box.appendChild(t);
    const en = entries(e.entries);
    if (en) box.appendChild(en);

    // §22 GUIDANCE — a sidebar printed beside this, kept beside it here
    (e.guidance || []).forEach((g) => {
      box.appendChild(el('aside', { class: 'guidance' }, [
        el('div', { class: 'guidance-k' }, [g.name || 'Sidebar']),
        prose(g.text, 'prose'),
      ]));
    });

    // what hangs under it: a section's rules, a chapter's essays
    const kids = D.children(e.id).filter((k) => !(e.entries || []).some((r) => r.vk === 'entity' && r.id === k.id));
    if (kids.length && !o.noKids) {
      kids.forEach((k) => box.appendChild(el('div', { class: 'nested' }, [render(k)])));
    }
    return box;
  }

  // A card for a grid: the name, one line of what it is, the start of its text.
  function card(e, onclick) {
    const meta = header(e).join(' · ');
    const text = e.desc || D.text(e, 'Description') || '';
    return el('button', { class: 'card', type: 'button', onclick }, [
      el('div', { class: 'card-name' }, [e.name]),
      meta ? el('div', { class: 'card-meta muted small' }, [meta]) : null,
      text ? el('div', { class: 'card-text', html: inline(text.split(/\n\s*\n/)[0]) }) : null,
    ]);
  }

  // A scene of the adventure (not an entity): its name and its text.
  function scene(s, opts) {
    const o = opts || {};
    return el('article', { class: 'entity scene' }, [
      o.bare ? null : el('h3', {}, [s.name, el('span', { class: 'etype' }, ['scene'])]),
      prose(s.desc),
      table(s.table),                    // the table the book prints inside the scene
    ]);
  }

  return { render, card, scene, prose, inline, link, table, defLine };
})();
