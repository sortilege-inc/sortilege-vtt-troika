// system/troika/sheet.js — the character sheet, derived from the corpus's ACTOR "Character"
// at runtime (PLAYBOOK §1b): the declared fields, in declared order, each rendered by its
// declared type — a STRING is a line, an INTEGER a number, a reference to ^"Background" a
// pick from the 36, a LIST OF ^"Skill Rank" the rated rows, a LIST OF STRING the numbered
// lines. Nothing about the sheet is hand-listed except a number the book states only in
// prose, and that is a named constant citing its sentence.
//
// Also here: the live sheet for play (what the rules let a session change — current
// Stamina, current Luck, Provisions, the ticks of 11, an advance of 11.1) and the rolls
// as the rules state them (1.1 Roll Under, 1.2 Roll Versus, 3.1 Testing your Luck, the
// Spells chapter's casting rule, 8 Damage with 8.2's modifier and 9's armour).
window.TroikaSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.TroikaData;
  const E = window.TroikaEntity;
  const State = () => window.VttState;

  const ACTOR = 'Character';
  const FILE_KIND = 'sortilege-vtt-character';

  // ── numbers the book states only in prose, each citing its sentence ──
  // "Rolling two 6s always results in failure." — 1.1 Roll Under
  const ROLL_UNDER_FAILS_ON = [6, 6];
  // "Double 1s always succeed. Double 6s always fail and require a roll on the Oops! Table." — Spells (14)
  const CAST_SUCCEEDS_ON = [1, 1];
  // "Every time you Test your Luck, reduce your current Luck score by 1" — 3.1 Testing your Luck
  const LUCK_TEST_COST = 1;
  // "You may also eat a Provision to regain 1d6 Stamina. A maximum of 3 Provisions per day
  //  provide healing benefits." — 4.2 Healing
  const PROVISION_HEALS = '1d6';
  const PROVISIONS_PER_DAY = 3;
  // "You regain 2d6 Stamina if you sleep for 8 hours." — 4.2; "For every 8 hours rest you may
  //  regain 2d6 Luck." — 3.2. Neither may exceed the starting value (3.2, 4.2).
  const SLEEP_HEALS = '2d6';
  // "Unarmoured, Lightly Armoured, Modestly Armoured, or Heavily Armoured. Each modifies
  //  Damage Rolls by 0, -1, -2 and -3 respectively, to a minimum of 1." — 9 Armour
  const ARMOUR = [['Unarmoured', 0], ['Lightly Armoured', -1], ['Modestly Armoured', -2], ['Heavily Armoured', -3]];
  const DAMAGE_MIN = 1;
  // "Choose up to 3 Advanced Skills or Spells with a tick next to them." — 11.1 How to Advance
  const ADVANCES_PER_REST = 3;

  // ── dice ──
  const die = (n) => 1 + Math.floor(Math.random() * n);
  // "XdY+Z": the printed generator, rolled as written ("1d3+3", "2d6+12", "2d6")
  function roll(expr) {
    const m = /^(\d*)d(\d+)(?:\s*\+\s*(\d+))?$/.exec(String(expr).replace(/\s+/g, ''));
    if (!m) return { dice: [], total: 0 };
    const n = parseInt(m[1] || '1', 10);
    const dice = Array.from({ length: n }, () => die(parseInt(m[2], 10)));
    return { dice, total: dice.reduce((a, b) => a + b, 0) + parseInt(m[3] || '0', 10) };
  }
  // "a d66 would be a d6 followed by another d6" — 1 Rolling the Dice
  const d66 = () => String(die(6)) + String(die(6));

  // ── the declaration, read at runtime ──
  const declaration = () => D.declaration(ACTOR);
  const rankDecl = () => D.declaration('Skill Rank');

  // The printed sheet's own counts: its numbered Inventory lines ("1"…"12", which is the
  // twelve of 10 Encumbrance) and its Weapon rows (one "1 2 3 4 5 6 7+" damage line each).
  function printed() {
    const sheet = D.all(['sheet']).find((e) => e.key === 'Character Sheet');
    const kids = sheet ? D.children(sheet.id) : [];
    const lines = kids.filter((k) => /^\d+$/.test(k.key)).length || 12;
    const wearing = kids.find((k) => k.key === 'Wearing');
    const rows = wearing && wearing.desc ? (wearing.desc.match(/1 2 3 4 5 6 7\+/g) || []).length : 0;
    return { inventoryLines: lines, weaponRows: rows || 4 };
  }

  // One entry per declared field: { name, kind, of, required, ... }.
  function spec() {
    const decl = declaration();
    if (!decl) return [];
    const p = printed();
    return decl.props.map((f) => {
      const s = { name: f.name, required: !!f.required };
      if (f.vk === 'ref') { s.kind = 'pick'; s.of = f.ref && f.ref.name; }
      else if (f.vk === 'list' && f.of && f.of !== 'STRING') { s.kind = 'rated'; s.of = f.of; }
      else if (f.vk === 'list') { s.kind = 'lines'; s.count = f.name === 'Inventory' ? p.inventoryLines : f.name === 'Weapons' ? p.weaponRows : 0; }
      else if (f.type === 'INTEGER') s.kind = 'number';
      else s.kind = 'text';
      return s;
    });
  }

  function blank() {
    const v = {};
    spec().forEach((s) => {
      v[s.name] = s.kind === 'pick' ? null : s.kind === 'rated' ? [] : s.kind === 'lines' ? Array.from({ length: s.count }, () => '') : s.kind === 'number' ? null : '';
    });
    return v;
  }

  function complete(v) {
    const out = blank();
    Object.keys(v || {}).forEach((k) => {
      if (k in out && v[k] != null) {
        if (Array.isArray(out[k]) && Array.isArray(v[k])) {
          out[k] = v[k].slice();
          while (out[k].length < (spec().find((s) => s.name === k) || {}).count) out[k].push('');
        } else out[k] = v[k];
      } else if (!(k in out)) out[k] = v[k];      // a field the sheet does not declare travels along
    });
    return out;
  }

  // ── the corpus behind the fields ──
  const backgrounds = () => D.byType('Background', ['characters']).slice().sort((a, b) => String(D.val(a, 'Roll')).localeCompare(String(D.val(b, 'Roll'))));
  const background = (v) => v && v.Background && v.Background.hash ? D.entity(v.Background.hash) : null;
  // The Backgrounds print a spell rank as "Spell – Name"; the row's flag or that prefix says
  // it is one, and the name after the prefix is the Spell entity's.
  const SPELL_PREFIX = /^Spell\s*[–-]\s*/;
  const isSpellRow = (row) => !!(row && (row['Is Spell'] || SPELL_PREFIX.test(String(row.Skill || ''))));
  const spellByName = (name) => {
    const n = String(name || '').replace(SPELL_PREFIX, '').trim().toLowerCase();
    return D.byType('Spell', ['spells']).find((s) => s.name.toLowerCase() === n) || null;
  };
  // the Damage tables' rows (the 22 weapons), by name — a Weapon line on the sheet that names one
  function weaponRows() {
    const out = [];
    D.byType('Table', ['tables']).forEach((t) => (t.entries || []).forEach((r) => {
      if (r.type === 'Weapon') out.push({ name: r.name, table: t.name, damage: ((r.fields.find((f) => f.name === 'Damage') || {}).items || []).map((i) => i.value), fields: r.fields });
    }));
    return out;
  }
  function weaponFor(text) {
    const t = String(text || '').toLowerCase();
    return weaponRows().filter((w) => t.indexOf(w.name.toLowerCase()) !== -1).sort((a, b) => b.name.length - a.name.length)[0] || null;
  }

  // Skill Total: "The number given in the Background plus their Skill" — 2
  const skillTotal = (v, row, adv) => (row.Rank || 0) + ((adv || {})[row.Skill] || 0) + (v.Skill || 0);

  // A one-line description of who this is, from the sheet's own fields.
  function sentence(v) {
    const bg = background(v);
    return [v.Name || 'An unnamed character', bg ? 'the ' + bg.name : null].filter(Boolean).join(', ') + (v.Skill != null ? ' · Skill ' + v.Skill + ' · Stamina ' + v.Stamina + ' · Luck ' + v.Luck : '');
  }

  // ── the sheet, laid out as the printed one ──
  // Fields are read off the declaration; the layout names where each goes and anything it
  // does not name lands in "Also declared" at the foot.
  const LAYOUT = {
    head: ['Name', 'Background'], scores: ['Skill', 'Stamina', 'Luck'], rated: ['Advanced Skills'],
    special: ['Special'], weapons: ['Weapons'], wearing: ['Wearing'], inventory: ['Inventory'], purse: ['Monies', 'Provisions'],
  };

  function control(s, v, onChange, o) {
    const ro = o && o.readOnly;
    if (s.kind === 'text') {
      const long = s.name === 'Special' || s.name === 'Wearing';
      const inp = el(long ? 'textarea' : 'input', { class: 'text', type: long ? null : 'text', rows: long ? 3 : null, value: long ? null : (v[s.name] || ''), readonly: ro || null, oninput: (ev) => onChange(s.name, ev.target.value) }, long ? [v[s.name] || ''] : []);
      return inp;
    }
    if (s.kind === 'number') {
      return el('input', { class: 'text num', type: 'number', value: v[s.name] == null ? '' : v[s.name], readonly: ro || null, oninput: (ev) => onChange(s.name, ev.target.value === '' ? null : parseInt(ev.target.value, 10)) });
    }
    if (s.kind === 'pick') {
      const sel = el('select', { class: 'scope', disabled: ro || null, onchange: (ev) => { const b = D.entity(ev.target.value); onChange(s.name, b ? { hash: b.id, name: b.name } : null); } });
      sel.appendChild(el('option', { value: '' }, ['— ' + s.of + ' —']));
      backgrounds().forEach((b) => sel.appendChild(el('option', { value: b.id, selected: v[s.name] && v[s.name].hash === b.id ? true : null }, [D.val(b, 'Roll') + ' · ' + b.name])));
      return sel;
    }
    if (s.kind === 'lines') {
      return el('ol', { class: 'lines' }, (v[s.name] || []).map((line, i) => el('li', {}, [
        el('input', { class: 'text', type: 'text', value: line || '', readonly: ro || null, oninput: (ev) => { const a = (v[s.name] || []).slice(); a[i] = ev.target.value; onChange(s.name, a); } }),
      ])));
    }
    if (s.kind === 'rated') return ratedRows(s, v, onChange, o);
    return null;
  }

  // "Rank + Skill = Total", as the printed sheet heads the column
  function ratedRows(s, v, onChange, o) {
    const ro = o && o.readOnly;
    const decl = rankDecl();
    const fields = decl ? decl.props.map((p) => p.name) : ['Rank', 'Skill', 'Is Spell'];
    const rows = (v[s.name] || []).slice();
    const set = (next) => onChange(s.name, next);
    const wrap = el('div', { class: 'rated' }, [
      el('div', { class: 'rated-head muted small' }, [fields[0] + ' + Skill = Total']),
      rows.map((r, i) => el('div', { class: 'rated-row' }, [
        el('input', { class: 'text num small', type: 'number', min: 0, value: r.Rank == null ? '' : r.Rank, readonly: ro || null, oninput: (ev) => { const a = rows.slice(); a[i] = Object.assign({}, r, { Rank: parseInt(ev.target.value || '0', 10) }); set(a); } }),
        el('input', { class: 'text small rated-main', type: 'text', value: r.Skill || '', readonly: ro || null, oninput: (ev) => { const a = rows.slice(); a[i] = Object.assign({}, r, { Skill: ev.target.value }); set(a); } }),
        el('label', { class: 'small' }, [el('input', { type: 'checkbox', checked: r['Is Spell'] || null, disabled: ro || null, onchange: (ev) => { const a = rows.slice(); a[i] = Object.assign({}, r, { 'Is Spell': ev.target.checked }); set(a); } }), ' spell']),
        el('span', { class: 'rated-total' }, ['= ' + skillTotal(v, r)]),
        ro ? null : button('×', () => set(rows.filter((_, j) => j !== i)), 'ghost tiny'),
      ])),
      ro ? null : el('div', { class: 'rated-row add' }, [button('Add a skill or spell', () => set(rows.concat([{ Rank: 1, Skill: '', 'Is Spell': false }])), 'ghost tiny')]),
    ]);
    return wrap;
  }

  // The whole sheet. onChange(name, value) makes it editable; without it, read-only.
  function render(v, onChange, opts) {
    const o = Object.assign({}, opts || {}, { readOnly: !onChange });
    const set = onChange || (() => {});
    const S = spec();
    const byName = {};
    S.forEach((s) => (byName[s.name] = s));
    const used = new Set();
    const field = (name, cls) => {
      const s = byName[name];
      if (!s) return null;
      used.add(name);
      const c = control(s, v, set, o);
      return el('div', { class: 'sfield ' + (cls || '') }, [el('div', { class: 'prop-k' }, [s.name, s.required ? el('span', { class: 'req' }, [' ·']) : null]), c]);
    };
    const bg = background(v);
    const sheet = el('div', { class: 'sheet' }, [
      el('div', { class: 'masthead' }, [
        el('div', {}, LAYOUT.head.map((n) => field(n))),
        el('div', { class: 'stat-tiles' }, LAYOUT.scores.map((n) => field(n, 'tile'))),
      ]),
      bg ? el('details', { class: 'bg-text' }, [el('summary', { class: 'muted small' }, ['The ' + bg.name + ', as the book prints it']), E.render(bg, { bare: true })]) : null,
      el('div', { class: 'two-up' }, [
        el('div', {}, [LAYOUT.rated.map((n) => field(n)), LAYOUT.special.map((n) => field(n))]),
        el('div', {}, [LAYOUT.weapons.map((n) => field(n)), LAYOUT.wearing.map((n) => field(n)), LAYOUT.purse.map((n) => field(n, 'inline'))]),
      ]),
      LAYOUT.inventory.map((n) => field(n)),
    ]);
    const rest = S.filter((s) => !used.has(s.name));
    if (rest.length) sheet.appendChild(el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Also declared']), rest.map((s) => field(s.name))]));
    return sheet;
  }

  // ── the character file ──
  function readFile(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a character file.');
    const v = obj.kind === FILE_KIND && obj.character ? obj.character : obj;
    return complete(v);
  }
  function fileOf(v, live) {
    return { kind: FILE_KIND, version: 1, system: (window.VttConfig || {}).system || 'troika', templateId: (declaration() || {}).id || null, exported: new Date().toISOString(), name: v.Name || '', character: v, live: live || undefined };
  }
  function download(v, live) {
    const blob = new Blob([JSON.stringify(fileOf(v, live), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (v.Name || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.troika-character.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  // a party member: the file as it stands, plus what play changes
  function memberFrom(v, source, live) {
    return { id: State().genId('pc'), templateId: (declaration() || {}).id || 'troika-character', name: v.Name || 'Unnamed', source: source || { kind: 'file' }, character: v, live: live || {}, notes: '', playerNotes: '' };
  }
  const readMember = (obj, fileName) => memberFrom(readFile(obj), { kind: 'file', name: fileName || null }, obj && obj.live);
  const downloadMember = (m) => download(m.character || blank(), m.live || {});
  const member = (id) => ((State().state || {}).party || []).find((m) => m.id === id) || null;

  // ── play: the live sheet and the rolls ──
  // live = { Stamina, Luck, Provisions (current, starting from the sheet), ticks: {skill:true},
  //          advances: {skill:+n}, provisionsToday }
  function current(m, key) {
    const lv = m.live || {};
    return lv[key] != null ? lv[key] : (m.character || {})[key];
  }
  function patch(m, p) {
    State().commit('setPartyLive', [m.id, p]);
  }
  function log(m, entry) {
    State().commit('appendLog', [Object.assign({ at: new Date().toISOString(), kind: 'roll', memberId: m.id, who: m.name }, entry)]);
    return entry;
  }
  const same = (dice, pair) => dice.length === 2 && dice[0] === pair[0] && dice[1] === pair[1];

  // 1.1 Roll Under: 2d6 equal to or under the target; double 6 always fails
  function rollUnder(m, what, target, o) {
    const r = roll('2d6');
    let success = r.total <= target && !same(r.dice, ROLL_UNDER_FAILS_ON);
    let note = null;
    if (o && o.spell) {
      if (same(r.dice, CAST_SUCCEEDS_ON)) { success = true; note = 'double 1s always succeed'; }
      if (same(r.dice, ROLL_UNDER_FAILS_ON)) { success = false; note = 'double 6s always fail — roll on the Oops! Table'; }
    }
    return log(m, { mode: 'under', what, dice: r.dice, total: r.total, target, success, note });
  }
  // 1.2 Roll Versus: 2d6 plus the bonus, the higher total winning
  function rollVersus(m, what, bonus, against) {
    const r = roll('2d6');
    const total = r.total + (bonus || 0);
    const success = against == null ? null : total > against;
    return log(m, { mode: 'versus', what, dice: r.dice, total, bonus: bonus || 0, against: against == null ? null : against, success });
  }
  // 3.1 Testing your Luck: under current Luck, then Luck − 1 either way
  function testLuck(m) {
    const luck = current(m, 'Luck') || 0;
    const entry = rollUnder(m, 'Test your Luck', luck);
    patch(m, { Luck: Math.max(0, luck - LUCK_TEST_COST) });
    return entry;
  }
  // 2.1 / 12 / 14: an Advanced Skill or Spell is a Roll Under its Skill Total; a spell costs
  // its Stamina first; a success earns a tick (11)
  function testSkill(m, row) {
    const v = m.character || {};
    const lv = m.live || {};
    const total = skillTotal(v, row, lv.advances);
    const spell = isSpellRow(row) ? spellByName(row.Skill) : null;
    const cost = spell ? parseInt(D.val(spell, 'Cost'), 10) : 0;
    const p = {};
    if (spell && cost) p.Stamina = Math.max(0, (current(m, 'Stamina') || 0) - cost);
    const entry = rollUnder(m, (spell ? 'Cast ' : 'Test ') + row.Skill + (spell && cost ? ' (' + cost + ' Stamina)' : ''), total, { spell: !!spell });
    if (entry.success) p.ticks = Object.assign({}, lv.ticks || {}, { [row.Skill]: true });
    if (Object.keys(p).length) patch(m, p);
    if (spell && same(entry.dice, ROLL_UNDER_FAILS_ON)) oops(m);
    return entry;
  }
  // "Double 6s always fail and require a roll on the Oops! Table." — a d66 on its rows
  function oops(m) {
    const t = D.byType('Table', ['tables']).find((x) => /OOPS/i.test(x.name));
    if (!t || !t.table) return null;
    const code = d66();
    const row = t.table.rows.find((r) => String(r[0]) === code) || [];
    return log(m, { mode: 'oops', what: t.name, dice: code.split('').map(Number), total: code, note: row[1] || '' });
  }
  // 8 Damage: d6 on the weapon's row, 8.2 modifiers to the roll, 9's armour, to a minimum of 1
  function rollDamage(m, weapon, modifier, armour) {
    const d = die(6) + (modifier || 0) + (armour || 0);
    const idx = Math.min(Math.max(d, DAMAGE_MIN), 7) - 1;
    const dmg = weapon.damage[idx];
    return log(m, { mode: 'damage', what: weapon.name, dice: [d], total: dmg, note: 'damage roll ' + d + (modifier ? ' (' + (modifier > 0 ? '+' : '') + modifier + ')' : '') + (armour ? ' (armour ' + armour + ')' : '') + ' on the ' + weapon.name + ' row' });
  }
  // 4.2 a Provision heals 1d6 Stamina, three a day
  function eat(m) {
    const lv = m.live || {};
    const today = lv.provisionsToday || 0;
    const prov = current(m, 'Provisions') || 0;
    if (prov <= 0) return null;
    const heals = today < PROVISIONS_PER_DAY;
    const r = heals ? roll(PROVISION_HEALS) : { dice: [], total: 0 };
    const max = (m.character || {}).Stamina || 0;
    patch(m, { Provisions: prov - 1, provisionsToday: today + 1, Stamina: Math.min(max, (current(m, 'Stamina') || 0) + r.total) });
    return log(m, { mode: 'heal', what: 'Eat a Provision', dice: r.dice, total: r.total, note: heals ? null : 'the third Provision of the day has healed already' });
  }
  // 4.2 / 3.2 sleep: 2d6 Stamina and 2d6 Luck back, never above the starting value
  function sleep(m) {
    const v = m.character || {};
    const s = roll(SLEEP_HEALS);
    const l = roll(SLEEP_HEALS);
    patch(m, { Stamina: Math.min(v.Stamina || 0, (current(m, 'Stamina') || 0) + s.total), Luck: Math.min(v.Luck || 0, (current(m, 'Luck') || 0) + l.total), provisionsToday: 0 });
    return log(m, { mode: 'heal', what: 'Sleep 8 hours', dice: s.dice.concat(l.dice), total: s.total, note: 'Stamina +' + s.total + ', Luck +' + l.total + ', never above the starting values' });
  }
  // 11.1: for a ticked skill, 2d6 over the Skill Total raises it by 1; then the ticks come off
  function advance(m, rows) {
    const v = m.character || {};
    const lv = m.live || {};
    const adv = Object.assign({}, lv.advances || {});
    const entries = rows.slice(0, ADVANCES_PER_REST).map((row) => {
      const total = skillTotal(v, row, adv);
      const r = roll('2d6');
      const up = r.total > total;
      if (up) adv[row.Skill] = (adv[row.Skill] || 0) + 1;
      return log(m, { mode: 'advance', what: 'Advance ' + row.Skill, dice: r.dice, total: r.total, target: total, success: up, note: up ? row.Skill + ' rises to ' + (row.Rank + adv[row.Skill]) : 'not over ' + total });
    });
    patch(m, { advances: adv, ticks: {} });
    return entries;
  }

  function rollLine(entry) {
    const cls = entry.success === true ? ' ok' : entry.success === false ? ' fail' : '';
    const dice = el('span', { class: 'roll-dice' }, (entry.dice || []).map((d) => el('span', { class: 'die' }, [String(d)])));
    let sum = '';
    if (entry.mode === 'under' || entry.mode === 'advance') sum = entry.total + (entry.mode === 'under' ? ' under ' : ' over ') + entry.target;
    else if (entry.mode === 'versus') sum = entry.total + (entry.bonus ? ' (2d6 + ' + entry.bonus + ')' : '') + (entry.against != null ? ' versus ' + entry.against : '');
    else if (entry.mode === 'damage') sum = entry.total + ' damage';
    else if (entry.mode === 'heal') sum = entry.total ? '+' + entry.total : '';
    else if (entry.mode === 'oops') sum = 'd66 → ' + entry.total;
    return el('div', { class: 'roll-line' + cls }, [
      el('span', { class: 'roll-who' }, [(entry.who || '') + (entry.what ? ' · ' + entry.what : '')]),
      dice, el('span', { class: 'roll-sum' }, [sum]),
      entry.note ? el('span', { class: 'muted small' }, [entry.note]) : null,
      entry.success === true ? el('b', {}, ['success']) : entry.success === false ? el('b', {}, ['failure']) : null,
    ]);
  }

  // The live sheet: the character as made, with the values play changes and the rolls.
  function live(m, opts) {
    const o = opts || {};
    const v = complete(m.character || {});
    const lv = m.live || {};
    const box = el('div', { class: 'sheet live' });
    box.appendChild(el('div', { class: 'sheet-head' }, [el('h2', {}, [m.name]), el('div', { class: 'muted small' }, [sentence(v)])]));
    // the three scores: starting value from the sheet, current value in play
    const scoreTile = (name, editable) => {
      const cur = current(m, name);
      return el('div', { class: 'tile pool live' + (cur === 0 ? ' empty' : '') }, [
        el('div', { class: 'pool-n' }, [name]),
        el('div', { class: 'pool-cur' }, [el('b', {}, [String(cur == null ? '—' : cur)]), editable ? el('span', { class: 'muted small' }, [' / ' + v[name]]) : null]),
        editable ? el('div', { class: 'chiprow tight' }, [
          button('−', () => patch(m, { [name]: Math.max(0, (cur || 0) - 1) }), 'ghost tiny'),
          button('+', () => patch(m, { [name]: Math.min(v[name] || 0, (cur || 0) + 1) }), 'ghost tiny'),
        ]) : null,
      ]);
    };
    box.appendChild(el('div', { class: 'stat-tiles' }, [scoreTile('Skill', false), scoreTile('Stamina', true), scoreTile('Luck', true)]));
    // the rolls
    const against = el('input', { class: 'text num small', type: 'number', placeholder: 'opponent' });
    const mod = el('input', { class: 'text num small', type: 'number', placeholder: 'mod', value: 0 });
    const armour = el('select', { class: 'scope tiny' }, ARMOUR.map(([label, n]) => el('option', { value: n }, [label])));
    box.appendChild(el('h4', {}, ['Rolls']));
    box.appendChild(el('div', { class: 'roll-bar' }, [
      button('Roll Under Skill', () => rollUnder(m, 'Skill', v.Skill || 0), 'tiny'),
      button('Roll Versus (2d6 + Skill)', () => rollVersus(m, 'Skill', v.Skill || 0, against.value === '' ? null : parseInt(against.value, 10)), 'tiny'),
      against,
      button('Test your Luck (−1)', () => testLuck(m), 'tiny'),
    ]));
    // Advanced Skills & Spells: each a Roll Under its total, ticked when it succeeds
    const rows = v['Advanced Skills'] || [];
    box.appendChild(el('h4', {}, ['Advanced Skills & Spells', el('span', { class: 'muted small' }, [' · Rank + Skill = Total · a tick when a Test succeeds (11)'])]));
    box.appendChild(el('div', { class: 'rated' }, rows.map((r) => {
      const adv = (lv.advances || {})[r.Skill] || 0;
      const spell = isSpellRow(r) ? spellByName(r.Skill) : null;
      return el('div', { class: 'rated-row' + ((lv.ticks || {})[r.Skill] ? ' ticked' : '') }, [
        el('span', { class: 'rated-rank' }, [String((r.Rank || 0) + adv) + (adv ? '↑' : '')]),
        el('span', { class: 'rated-main' }, [spell ? el('button', { class: 'ref', type: 'button', onclick: () => window.TroikaOpenEntity && window.TroikaOpenEntity(spell.id) }, [r.Skill]) : r.Skill, spell ? el('span', { class: 'muted small' }, [' · cost ' + D.val(spell, 'Cost')]) : null]),
        el('span', { class: 'rated-total' }, ['= ' + skillTotal(v, r, lv.advances)]),
        el('span', { class: 'tick' }, [(lv.ticks || {})[r.Skill] ? '✓' : '']),
        button(spell ? 'Cast' : 'Test', () => testSkill(m, r), 'tiny'),
        button('Versus', () => rollVersus(m, r.Skill, skillTotal(v, r, lv.advances), against.value === '' ? null : parseInt(against.value, 10)), 'ghost tiny'),
      ]);
    })));
    const ticked = rows.filter((r) => (lv.ticks || {})[r.Skill]);
    if (ticked.length) box.appendChild(el('div', { class: 'chiprow tight' }, [button('Advance the ticked (rest; up to ' + ADVANCES_PER_REST + ')', () => advance(m, ticked), 'ghost tiny')]));
    // Weapons: the damage roll on the row the Damage table gives the weapon
    const weapons = (v.Weapons || []).filter(Boolean);
    box.appendChild(el('h4', {}, ['Weapons', el('span', { class: 'muted small' }, [' · d6 on the Damage table (8)'])]));
    box.appendChild(el('div', { class: 'chiprow tight' }, [el('span', { class: 'muted small' }, ['damage roll mod']), mod, el('span', { class: 'muted small' }, ['target is']), armour]));
    box.appendChild(weapons.length ? el('div', { class: 'rated' }, weapons.map((w) => {
      const row = weaponFor(w);
      return el('div', { class: 'rated-row' }, [
        el('span', { class: 'rated-main' }, [w]),
        row ? el('span', { class: 'muted small' }, ['as ' + row.name + ' · ' + row.damage.join(' ')]) : el('span', { class: 'muted small' }, ['not on the Damage tables']),
        row ? button('Damage', () => rollDamage(m, row, parseInt(mod.value || '0', 10), parseInt(armour.value, 10)), 'tiny') : null,
      ]);
    })) : el('div', { class: 'muted small' }, ['No weapons on the sheet.']));
    // provisions and rest
    box.appendChild(el('h4', {}, ['Provisions and rest']));
    box.appendChild(el('div', { class: 'chiprow tight' }, [
      el('span', {}, ['Provisions ', el('b', {}, [String(current(m, 'Provisions') == null ? '—' : current(m, 'Provisions'))])]),
      button('Eat one (1d6 Stamina, 3 a day)', () => eat(m), 'tiny'),
      button('Sleep 8 hours (2d6 Stamina, 2d6 Luck)', () => sleep(m), 'ghost tiny'),
      el('span', { class: 'muted small' }, [(lv.provisionsToday || 0) + ' eaten today']),
    ]));
    // the rest of the sheet, read-only
    box.appendChild(el('details', { class: 'sheet-rest' }, [el('summary', { class: 'muted small' }, ['The whole sheet']), render(v, null)]));
    // this character's last rolls
    const rollLog = el('div', { class: 'roll-log' });
    (((State().state || {}).log) || []).filter((x) => x.kind === 'roll' && x.memberId === m.id).slice(-6).reverse().forEach((x) => rollLog.appendChild(rollLine(x)));
    box.appendChild(rollLog);
    return box;
  }

  return {
    ACTOR, FILE_KIND, roll, d66, die, spec, blank, complete, backgrounds, background, spellByName, weaponRows, weaponFor,
    isSpellRow, skillTotal, sentence, render, readFile, fileOf, download, memberFrom, readMember, downloadMember, member,
    live, rollLine, rollUnder, rollVersus, testLuck, testSkill, rollDamage, oops, eat, sleep, advance, current,
  };
})();
