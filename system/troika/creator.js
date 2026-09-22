// system/troika/creator.js — making a character: the book's own Overview (Character
// Creation, page 2) walked step by step. Each numbered sentence of the Overview is a step,
// shown verbatim beside its control, and the control is what the sentence says: "Roll
// 1d3+3 to determine Skill" rolls 1d3+3 into Skill; "Record Baseline Possessions … : *…*"
// records that list; "Roll d66 on the Background Table and record Possessions and Skills"
// rolls d66 and records them. Nothing about a step is hand-listed: the steps, the dice and
// the possessions are read out of the sentence. The controls are the sheet's own
// (TroikaSheet), over one draft in the browser's roster; what leaves is a character file.
window.TroikaCreator = (function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.TroikaData;
  const E = window.TroikaEntity;
  const Sheet = window.TroikaSheet;
  const Roster = window.TroikaRoster;
  const Site = () => window.VttSite;

  const chapter = () => D.top('characters').find((e) => e.key === 'Character Creation') || null;
  const overview = () => (chapter() ? D.children(chapter().id).find((e) => e.key === 'Overview:') : null);

  // ── the Overview, read into steps ──
  // The first paragraph is the instruction to fetch the sheet; every "N. …" after it is a
  // step. The fourth's list of possessions is the italic run after its colon; the fifth is
  // printed on the fourth's line, so the split is by the numbering, not the paragraphs.
  function steps() {
    const ov = overview();
    if (!ov || !ov.desc) return [];
    // the first paragraph fetches the sheet ("page 110.") and is not a step
    const text = ov.desc.split(/\n\s*\n/).slice(1).join(' ').replace(/\s+/g, ' ');
    const out = [];
    const re = /(?:^|\s)(\d)\.\s+(.*?)(?=\s+\d\.\s+[A-Z]|$)/g;
    let m;
    while ((m = re.exec(text))) {
      const n = parseInt(m[1], 10);
      const sentence = m[2].trim();
      const step = { n, sentence, id: 'step' + n };
      let r;
      if ((r = /^Roll (\S+) to determine (\w+)\.?$/.exec(sentence))) Object.assign(step, { kind: 'roll', dice: r[1], field: r[2] });
      else if ((r = /Baseline Possessions.*?:\s*\*(.+?)\.?\*\.?$/.exec(sentence))) Object.assign(step, { kind: 'baseline', items: r[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean) });
      else if (/Roll d66 on the Background Table/.test(sentence)) Object.assign(step, { kind: 'background' });
      else step.kind = 'text';
      out.push(step);
    }
    return out;
  }

  // ── the draft ──
  function draft() {
    const cur = Roster.current();
    if (cur) return cur;
    const id = Roster.add(Sheet.blank());
    return Roster.get(id);
  }
  const save = debounce((id, v) => Roster.save(id, v), 200);
  function change(d, patch) {
    Object.assign(d.character, patch);
    Roster.save(d.id, d.character);
  }

  // What each step leaves on the sheet, and whether it has
  function done(step, v) {
    if (step.kind === 'roll') return v[step.field] != null;
    if (step.kind === 'baseline') return !!v._baseline;
    if (step.kind === 'background') return !!(v.Background && v.Background.hash);
    return true;
  }

  // ── the steps' controls ──
  function rollStep(step, d, redraw) {
    const v = d.character;
    const cur = v[step.field];
    return el('div', { class: 'creator-step' }, [
      el('div', { class: 'chiprow' }, [
        button('Roll ' + step.dice, () => { const r = Sheet.roll(step.dice); change(d, { [step.field]: r.total, ['_rolled' + step.field]: r.dice }); redraw(); }),
        el('span', { class: 'stat-v big' }, [cur == null ? '—' : String(cur)]),
        v['_rolled' + step.field] ? el('span', { class: 'muted small' }, ['(' + v['_rolled' + step.field].join(' + ') + ')']) : null,
        el('span', { class: 'muted small' }, ['or write it: ']),
        el('input', { class: 'text num small', type: 'number', value: cur == null ? '' : cur, onchange: (ev) => { change(d, { [step.field]: ev.target.value === '' ? null : parseInt(ev.target.value, 10), ['_rolled' + step.field]: null }); redraw(); } }),
      ]),
    ]);
  }

  // "2d6 Silver Pence" is rolled; "6 Provisions" is the Provisions field; the rest are things
  // to carry, and a thing the Damage tables name is a Weapon too.
  function recordBaseline(step, d) {
    const v = d.character;
    const inv = (v.Inventory || []).slice();
    const weapons = (v.Weapons || []).slice();
    const put = (list, s) => { const i = list.indexOf(''); if (i === -1) list.push(s); else list[i] = s; };
    const patch = {};
    step.items.forEach((item) => {
      let r;
      if ((r = /^(\d*d\d+(?:\+\d+)?)\s+(.+)$/.exec(item))) { const roll = Sheet.roll(r[1]); patch.Monies = roll.total + ' ' + r[2]; patch._rolledMonies = roll.dice; }
      else if ((r = /^(\d+)\s+Provisions?$/i.exec(item))) patch.Provisions = parseInt(r[1], 10);
      else { put(inv, item); if (Sheet.weaponFor(item)) put(weapons, item); }
    });
    patch.Inventory = inv;
    patch.Weapons = weapons;
    patch._baseline = true;
    change(d, patch);
  }
  function baselineStep(step, d, redraw) {
    const v = d.character;
    return el('div', { class: 'creator-step' }, [
      el('ul', { class: 'items' }, step.items.map((it) => el('li', {}, [it]))),
      el('div', { class: 'chiprow' }, [
        button(v._baseline ? 'Record them again' : 'Record them', () => { recordBaseline(step, d); redraw(); }),
        v._baseline ? el('span', { class: 'muted small' }, ['recorded: Monies ' + (v.Monies || '') + (v._rolledMonies ? ' (' + v._rolledMonies.join(' + ') + ')' : '') + ', Provisions ' + v.Provisions + ', ' + (v.Inventory || []).filter(Boolean).length + ' things in the Inventory']) : null,
      ]),
    ]);
  }

  // record a Background: its Possessions into the Inventory (and Weapons), its Advanced
  // Skills as the rated rows, its Special
  function recordBackground(d, bg) {
    const v = d.character;
    const inv = (v.Inventory || []).filter((s) => !(v._bgItems || []).includes(s));
    const weapons = (v.Weapons || []).filter((s) => !(v._bgItems || []).includes(s));
    const spec = Sheet.spec();
    const lines = (spec.find((s) => s.name === 'Inventory') || {}).count || 12;
    const put = (list, s, cap) => { const i = list.indexOf(''); if (i === -1) { if (!cap || list.length < cap) list.push(s); } else list[i] = s; };
    const items = (D.val(bg, 'Possessions') || []).map((it) => E.inline ? String(it.value) : String(it.value));
    items.forEach((it) => { put(inv, it, lines); if (Sheet.weaponFor(it)) put(weapons, it); });
    while (inv.length < lines) inv.push('');
    const rows = (D.val(bg, 'Advanced Skills') || []).map((it) => {
      const f = {};
      (it.fields || []).forEach((x) => (f[x.name] = x.value));
      return { Rank: f.Rank || 0, Skill: f.Skill || '', 'Is Spell': !!f['Is Spell'] };
    });
    change(d, { Background: { hash: bg.id, name: bg.name }, Inventory: inv, Weapons: weapons, 'Advanced Skills': rows, Special: D.text(bg, 'Special') || '', _bgItems: items });
  }
  function backgroundStep(step, d, redraw, ctx) {
    const v = d.character;
    const bg = Sheet.background(v);
    const finder = el('details', { class: 'finder' }, [
      el('summary', { class: 'muted small' }, ['or choose one of the 36']),
      el('div', { class: 'cards' }, Sheet.backgrounds().map((b) => E.card(b, () => { recordBackground(d, b); redraw(); }))),
    ]);
    return el('div', { class: 'creator-step' }, [
      el('div', { class: 'chiprow' }, [
        button('Roll d66', () => { const code = Sheet.d66(); const b = Sheet.backgrounds().find((x) => String(D.val(x, 'Roll')) === code); change(d, { _d66: code }); if (b) recordBackground(d, b); redraw(); }),
        v._d66 ? el('span', { class: 'muted small' }, ['d66 → ' + v._d66]) : null,
      ]),
      bg ? el('div', { class: 'chosen-wrap' }, [
        E.card(bg, () => Site().go('book', ['characters', bg.id])),
        el('div', { class: 'muted small' }, ['recorded: ' + (v['Advanced Skills'] || []).length + ' Advanced Skills & Spells, ' + (v._bgItems || []).length + ' Possessions' + (v.Special ? ', a Special' : '')]),
      ]) : el('div', { class: 'muted small' }, ['No Background yet.']),
      finder,
    ]);
  }

  // ── the page ──
  const STEP_IDS = () => ['name'].concat(steps().map((s) => s.id)).concat(['sheet']);

  function render(container, path, ctx) {
    const page = el('div', { class: 'page' });
    container.appendChild(page);
    const d = draft();
    const v = Sheet.complete(d.character);
    d.character = v;
    const S = steps();
    const ids = STEP_IDS();
    const stepId = ids.includes(path[0]) ? path[0] : ids[0];
    const redraw = () => { container.innerHTML = ''; render(container, path, ctx); };
    const go = (id) => Site().go('characters', [id]);

    // the roster and the file controls
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      f.text().then((t) => { const c = Sheet.readFile(JSON.parse(t)); Roster.add(c); go('sheet'); redraw(); }).catch((e) => alert(e.message)).finally(() => (file.value = ''));
    });
    const roster = Roster.list();
    page.appendChild(el('div', { class: 'creator-head' }, [
      el('div', {}, [
        el('h2', {}, ['Making a character']),
        el('div', { class: 'muted small' }, ['The Overview of Character Creation (page 2), one step at a time; the sheet is the corpus’s own ', el('code', {}, ['Character']), ' type.']),
      ]),
      el('div', { class: 'roster' }, [
        el('div', { class: 'chiprow tight' }, [
          el('select', { class: 'scope', onchange: (ev) => { Roster.open(ev.target.value); redraw(); } }, roster.map((r) => el('option', { value: r.id, selected: r.id === d.id || null }, [(r.character.Name || 'unnamed') + (r.character.Background ? ', the ' + r.character.Background.name : '')]))),
          button('New', () => { Roster.add(Sheet.blank()); go('name'); redraw(); }, 'ghost tiny'),
          button('Duplicate', () => { Roster.duplicate(d.id); redraw(); }, 'ghost tiny'),
          button('Remove', () => { if (confirm('Remove ' + (v.Name || 'this character') + ' from this browser?')) { Roster.remove(d.id); redraw(); } }, 'ghost tiny'),
          button('Load a file…', () => file.click(), 'ghost tiny'), file,
          button('Download the file', () => Sheet.download(v), 'tiny'),
        ]),
      ]),
    ]));

    // the steps as a list, with what each decided
    const stepsNav = el('ol', { class: 'creator-steps' }, [
      el('li', { class: (stepId === 'name' ? 'current' : '') + (v.Name ? ' done' : '') }, [el('a', { href: ctx.href('characters', ['name']) }, [el('span', { class: 'step-s' }, ['Name']), el('span', { class: 'step-pick' }, [v.Name || '—'])])]),
      S.map((s) => el('li', { class: (stepId === s.id ? 'current' : '') + (done(s, v) ? ' done' : '') }, [el('a', { href: ctx.href('characters', [s.id]) }, [
        el('span', { class: 'step-s' }, [s.n + '. ' + (s.kind === 'roll' ? s.field : s.kind === 'baseline' ? 'Baseline Possessions' : s.kind === 'background' ? 'Background' : 'Step')]),
        el('span', { class: 'step-pick' }, [s.kind === 'roll' ? (v[s.field] == null ? '—' : String(v[s.field])) : s.kind === 'baseline' ? (v._baseline ? 'recorded' : '—') : s.kind === 'background' ? (Sheet.background(v) ? Sheet.background(v).name : '—') : '']),
      ])])),
      el('li', { class: stepId === 'sheet' ? 'current' : '' }, [el('a', { href: ctx.href('characters', ['sheet']) }, [el('span', { class: 'step-s' }, ['The sheet'])])]),
    ]);

    // the step itself, decision first, the book's sentence beside it
    const main = el('div', { class: 'creator-main' });
    const book = el('details', { class: 'creator-book', open: true }, [el('summary', {}, ['What the book says'])]);
    const onChange = (name, value) => { change(d, { [name]: value }); };
    if (stepId === 'name') {
      main.appendChild(el('h3', {}, ['Name']));
      main.appendChild(el('input', { class: 'text name-big', type: 'text', value: v.Name || '', placeholder: 'A name', oninput: (ev) => onChange('Name', ev.target.value) }));
      const ov = overview();
      if (ov) book.appendChild(E.prose(ov.desc.split(/\n\n/)[0]));
      const ch = chapter();
      if (ch) D.children(ch.id).filter((e) => e.key !== 'Overview:').forEach((e) => book.appendChild(E.render(e)));
    } else if (stepId === 'sheet') {
      main.appendChild(el('h3', {}, ['The sheet']));
      main.appendChild(el('div', { class: 'muted small' }, [Sheet.sentence(v)]));
      main.appendChild(Sheet.render(v, onChange));
      main.appendChild(el('div', { class: 'chiprow' }, [button('Download the character file', () => Sheet.download(v)), el('span', { class: 'muted small' }, ['the GM imports it at the table; you can load it on the player’s page'])]));
      const sheetEntity = D.all(['sheet']).find((e) => e.key === 'Character Sheet');
      if (sheetEntity) book.appendChild(el('div', { class: 'muted small' }, ['The printed sheet’s labels, in printed order: ' + D.children(sheetEntity.id).map((k) => k.key).join(' · ')]));
    } else {
      const s = S.find((x) => x.id === stepId);
      main.appendChild(el('h3', {}, [s.n + '. ' + (s.kind === 'roll' ? s.field : s.kind === 'baseline' ? 'Baseline Possessions' : s.kind === 'background' ? 'Background' : '')]));
      if (s.kind === 'roll') main.appendChild(rollStep(s, d, redraw));
      else if (s.kind === 'baseline') main.appendChild(baselineStep(s, d, redraw));
      else if (s.kind === 'background') main.appendChild(backgroundStep(s, d, redraw, ctx));
      book.appendChild(E.prose(s.n + '. ' + s.sentence));
      if (s.kind === 'background') {
        const ch = chapter();
        if (ch) D.children(ch.id).filter((e) => e.key === 'Backgrounds').forEach((e) => book.appendChild(E.render(e, { bare: true })));
      }
      // the rule the step rests on, when the book numbers one
      const rule = s.kind === 'roll' ? D.byType('Rule', ['rules']).find((r) => r.name === s.field && !D.val(r, 'Number').includes('.')) : null;
      if (rule && rule.desc) book.appendChild(E.render(rule, { noKids: true }));
    }
    const i = ids.indexOf(stepId);
    main.appendChild(el('div', { class: 'creator-nav chiprow' }, [
      i > 0 ? el('a', { class: 'btn ghost', href: ctx.href('characters', [ids[i - 1]]) }, ['← back']) : null,
      i < ids.length - 1 ? el('a', { class: 'btn', href: ctx.href('characters', [ids[i + 1]]) }, ['next →']) : null,
    ]));
    page.appendChild(el('div', { class: 'creator-body' }, [stepsNav, main, book]));
  }

  return { render, steps, draft, recordBackground, recordBaseline };
})();
