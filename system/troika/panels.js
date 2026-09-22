// system/troika/panels.js — the Troika! panels: Adventure, Party, Inspector, Bestiary,
// Tables, Rules & Book, Log, Campaign. Registered into the engine's registry; the shell
// (engine/app.js) decides where they show. Every word of rules text shown comes from the
// corpus.
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.TroikaData;
  const E = window.TroikaEntity;
  const State = window.VttState;
  const Bus = window.VttBus;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const MODULE = 'adventure';

  // a link inside any rendered entity opens it in the Inspector here, not the reader
  window.TroikaOpenEntity = (id) => {
    if (D.entity(id)) Panels.select({ kind: 'entity', id });
  };

  const currentScene = () => Sys().scene(Sys().currentSceneId());
  const progress = (sceneId) => ((S().progress || {})[MODULE] || {})[sceneId] || { done: false, notes: '' };
  function goTo(sceneId) {
    State.commit('setCurrentScene', [MODULE, sceneId]);
    Bus.emit('scene:changed', { moduleId: MODULE, sceneId });
  }
  const editing = (container) => document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName) && container.contains(document.activeElement);

  // ── Adventure: the arc's phases and scenes ─────────────────────────
  function renderAdventure(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const arc = D.arc(MODULE);
      if (!arc) return container.appendChild(el('div', { class: 'empty' }, ['No adventure in the corpus.']));
      const pages = D.pages(MODULE);
      const cur = currentScene();
      const done = pages.filter((p) => progress(p.scene.id).done).length;
      container.appendChild(el('h4', {}, [arc.name, el('span', { class: 'muted small' }, [' · ' + done + ' of ' + pages.length + ' scenes done'])]));
      let phase;
      const list = el('div', { class: 'scene-list' });
      pages.forEach((p) => {
        if (p.phase !== phase) {
          phase = p.phase;
          list.appendChild(el('div', { class: 'phase-h' }, [phase || 'Other scenes']));
        }
        const st = progress(p.scene.id);
        list.appendChild(el('div', { class: 'scene-row' + (cur && cur.id === p.scene.id ? ' current' : '') + (st.done ? ' done' : '') }, [
          el('input', { type: 'checkbox', checked: st.done || null, title: 'Done', onchange: (ev) => State.commit('setSceneDone', [MODULE, p.scene.id, ev.target.checked]) }),
          el('button', { class: 'scene-link', type: 'button', onclick: () => goTo(p.scene.id) }, [p.scene.name]),
          Sys().cast(p.scene.id).length ? el('span', { class: 'muted small' }, [Sys().cast(p.scene.id).length + ' in it']) : null,
        ]));
      });
      container.appendChild(list);

      if (cur) {
        const st = progress(cur.id);
        const here = Sys().cast(cur.id);
        container.appendChild(el('section', { class: 'scene' }, [
          el('h4', {}, ['This scene']),
          E.scene(cur),
          el('div', { class: 'chiprow tight' }, [
            button('Open on the table', () => window.open(window.VttConfig.pages.table + '?scene=' + encodeURIComponent(cur.id), (window.VttConfig.channel || 'vtt') + '-table'), 'tiny'),
            el('label', { class: 'small' }, [el('input', { type: 'checkbox', checked: st.done || null, onchange: (ev) => State.commit('setSceneDone', [MODULE, cur.id, ev.target.checked]) }), ' done']),
          ]),
          el('div', { class: 'prop-k' }, ['In it']),
          here.length ? el('div', { class: 'chiprow tight' }, here.map((e) => el('span', { class: 'chip' }, [
            el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
            el('button', { class: 'ref tiny', type: 'button', title: 'take out', onclick: () => State.commit('setSceneCast', [cur.id, Sys().cast(cur.id).map((x) => x.id).filter((x) => x !== e.id)]) }, ['×']),
          ]))) : el('div', { class: 'muted small' }, ['No one yet — the Bestiary can put someone here.']),
          el('div', { class: 'prop-k' }, ['GM notes', el('span', { class: 'muted' }, [' · never sent to players'])]),
          el('textarea', { class: 'text', rows: 5, placeholder: 'What happens here…', oninput: debounce((ev) => State.commit('setSceneNotes', [MODULE, cur.id, ev.target.value]), 400) }, [st.notes || '']),
        ]));
      }
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', draw);
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Party ──────────────────────────────────────────────────────────
  function characterLoader(label, cls) {
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
    file.addEventListener('change', () => {
      const files = Array.from(file.files || []);
      Promise.all(files.map((f) => f.text().then((text) => Sys().readCharacter(JSON.parse(text), f.name))))
        .then((members) => {
          members.forEach((m) => State.commit('addPartyMember', [m]));
          if (members.length) Panels.select({ kind: 'party', id: members[members.length - 1].id });
        })
        .catch((e) => alert(e.message))
        .finally(() => (file.value = ''));
    });
    return el('span', {}, [button(label, () => file.click(), cls), file]);
  }

  function renderParty(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const party = S().party || [];
      container.appendChild(el('div', { class: 'chiprow' }, [characterLoader('Load character file(s)…', ''), el('span', { class: 'muted small' }, ['from the site’s character creator'])]));
      if (!party.length) container.appendChild(el('div', { class: 'empty' }, ['No one in the party yet.']));
      party.forEach((m) => container.appendChild(el('div', { class: 'member' }, [
        el('button', { class: 'card static-card', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [
          el('div', { class: 'card-name' }, [m.name]),
          el('div', { class: 'card-sub muted small' }, [Sys().memberSubtitle(m)]),
          el('div', { class: 'card-desc' }, ['Stamina ' + window.TroikaSheet.current(m, 'Stamina') + ' / ' + (m.character || {}).Stamina + ' · Luck ' + window.TroikaSheet.current(m, 'Luck') + ' / ' + (m.character || {}).Luck]),
        ]),
        el('div', { class: 'member-ops' }, [
          button('file', () => Sys().downloadCharacter(m), 'ghost tiny'),
          button('remove', () => { if (confirm('Remove ' + m.name + ' from the party?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
        ]),
      ])));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Inspector ──────────────────────────────────────────────────────
  function renderInspector(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sel = Panels.selection();
      if (!sel) return container.appendChild(el('div', { class: 'empty' }, ['Nothing selected. Click a name anywhere — a scene, an enemy, a rule, a spell.']));
      if (sel.kind === 'entity') {
        const e = D.entity(sel.id);
        if (!e) return container.appendChild(el('div', { class: 'empty' }, ['Not in the book: ' + sel.id]));
        const cur = currentScene();
        container.appendChild(el('div', { class: 'chiprow tight' }, [
          cur && e.type === 'Enemy' ? button('Put in ' + cur.name, () => State.commit('setSceneCast', [cur.id, Sys().cast(cur.id).map((x) => x.id).concat([e.id])]), 'tiny') : null,
          el('a', { class: 'btn ghost tiny', href: './#' + (e.type === 'Enemy' ? 'bestiary/' : 'book/' + e.book + '/') + encodeURIComponent(e.id), target: '_blank' }, ['In the reader']),
        ]));
        container.appendChild(E.render(e));
      } else if (sel.kind === 'party') {
        const m = (S().party || []).find((x) => x.id === sel.id);
        container.appendChild(m ? Sys().liveSheet(m) : el('div', { class: 'empty' }, ['That character is no longer in the party.']));
      } else container.appendChild(el('div', { class: 'empty' }, ['Nothing to show for ' + sel.kind + '.']));
    };
    ctx.on('select', draw);
    ctx.on('state:changed', () => { const sel = Panels.selection(); if (sel && sel.kind === 'party' && !editing(container)) draw(); });
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Bestiary ───────────────────────────────────────────────────────
  function renderBestiary(container, ctx) {
    let q = '';
    container.innerHTML = '';
    const search = el('input', { type: 'search', class: 'search', placeholder: 'Find an enemy…' });
    const list = el('div');
    const drawList = () => {
      list.innerHTML = '';
      const all = D.byType('Enemy', ['enemies']).filter((e) => !q || (e.name + ' ' + (D.text(e, 'Description') || '') + ' ' + (D.text(e, 'Special') || '')).toLowerCase().indexOf(q) !== -1);
      list.appendChild(el('div', { class: 'muted small' }, [all.length + ' in the Bestiary']));
      list.appendChild(el('ul', { class: 'items toc' }, all.map((e) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
        el('span', { class: 'muted small' }, [' · Skill ' + D.val(e, 'Skill') + ' · Stamina ' + D.val(e, 'Stamina')]),
      ]))));
    };
    search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); drawList(); }, 150));
    container.appendChild(search);
    container.appendChild(list);
    drawList();
  }

  // ── Tables: the endpapers, rolled on ───────────────────────────────
  // A roll picks one row of the printed table at random (the book's d66 over 36 rows is
  // uniform) and logs it; the row is the corpus's, the pick is this tool's.
  function renderTables(container, ctx) {
    container.innerHTML = '';
    D.byType('Table', ['tables']).forEach((t) => {
      if (!t.table) return;
      const out = el('div', { class: 'muted small' });
      container.appendChild(el('div', { class: 'table-roll' }, [
        el('div', { class: 'chiprow tight' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: t.id }) }, [t.name]),
          el('span', { class: 'muted small' }, [t.table.rows.length + ' rows']),
          button('Roll', () => {
            const i = Math.floor(Math.random() * t.table.rows.length);
            const row = t.table.rows[i];
            out.textContent = row.join(' · ');
            State.commit('appendLog', [{ at: Date.now(), kind: 'table', text: t.name + ' → ' + row.join(' · ') }]);
          }, 'tiny'),
        ]),
        out,
      ]));
    });
  }

  // ── Rules & Book ───────────────────────────────────────────────────
  function renderRules(container, ctx) {
    container.innerHTML = '';
    const input = el('input', { type: 'search', class: 'search', placeholder: 'Search the book… ( / )', autocomplete: 'off' });
    const scope = el('select', { class: 'scope' });
    const results = el('div', { class: 'results' });
    const browser = el('div', { class: 'browser' });
    scope.appendChild(el('option', { value: '' }, ['The whole book']));
    D.books().forEach((b) => scope.appendChild(el('option', { value: b.id }, [b.label])));
    const bookIds = () => (scope.value ? [scope.value] : null);

    function tree(bid, nodes) {
      return el('ul', { class: 'items toc' }, nodes.map((n) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: n.id }) }, [n.label]),
        n.kids.length ? el('details', { class: 'chapter' }, [el('summary', { class: 'muted small' }, [n.kids.length + ' under it']), tree(bid, n.kids)]) : null,
      ])));
    }
    function drawBrowser() {
      browser.innerHTML = '';
      D.books().filter((b) => !scope.value || b.id === scope.value).forEach((b) => {
        if (b.kind === 'adventure') return;
        browser.appendChild(el('details', { class: 'book', open: !!scope.value || null }, [
          el('summary', {}, [b.label, el('span', { class: 'muted small' }, [' · ' + b.counts.entities])]),
          tree(b.id, D.outline(b.id)),
        ]));
      });
    }
    const run = debounce(() => {
      results.innerHTML = '';
      const q = input.value.trim();
      browser.hidden = !!q;
      if (q.length < 2) return;
      const hits = D.search(q, bookIds(), 120).filter((e) => !e.scene);
      if (!hits.length) return results.appendChild(el('div', { class: 'empty' }, ['Nothing matches.']));
      results.appendChild(el('div', { class: 'muted small' }, [hits.length + (hits.length === 1 ? ' result' : ' results')]));
      hits.forEach((e) => results.appendChild(el('div', { class: 'hit' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
        e.type ? el('span', { class: 'etype' }, [e.type]) : null,
        el('span', { class: 'muted small' }, [' · ' + ((D.indexBook(e.book) || {}).label || e.book)]),
        (() => { const ex = D.excerpt(e, q, 60); return ex ? el('div', { class: 'muted small' }, [ex]) : null; })(),
      ])));
    }, 150);
    input.addEventListener('input', run);
    scope.addEventListener('change', () => { drawBrowser(); run(); });
    container.appendChild(el('div', { class: 'search-row' }, [input, scope]));
    container.appendChild(results);
    container.appendChild(browser);
    drawBrowser();
    container.focusSearch = () => input.focus();
  }

  // ── Log ────────────────────────────────────────────────────────────
  function renderLog(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const log = (S().log || []).slice().reverse();
      if (!log.length) return container.appendChild(el('div', { class: 'empty' }, ['Nothing logged yet.']));
      log.forEach((x) => container.appendChild(x.kind === 'roll' ? window.TroikaSheet.rollLine(x) : el('div', { class: 'roll-line' }, [
        el('span', { class: 'roll-who' }, [x.kind || 'note']), x.text || JSON.stringify(x),
      ])));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Campaign ───────────────────────────────────────────────────────
  function renderCampaign(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const c = S().campaign;
      const name = el('input', { type: 'text', value: c.name || '', class: 'text', onchange: (ev) => State.commit('setCampaign', [{ name: ev.target.value }]) });
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Campaign']), el('div', { class: 'prop-v' }, [name])]));
      const party = S().party || [];
      container.appendChild(el('h4', {}, ['The party', el('span', { class: 'muted small' }, [' · saved in the pack'])]));
      container.appendChild(party.length ? el('ul', { class: 'items' }, party.map((m) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [m.name]),
        el('span', { class: 'muted small' }, [' · ' + Sys().memberSubtitle(m)]),
        button('file', () => Sys().downloadCharacter(m), 'ghost tiny'),
        button('remove', () => { if (confirm('Remove ' + m.name + ' from the campaign?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
      ]))) : el('div', { class: 'empty' }, ['No one yet.']));
      container.appendChild(el('div', { class: 'chiprow' }, [characterLoader('Load character file(s)…', 'ghost')]));

      const list = State.listCampaigns();
      container.appendChild(el('h4', {}, ['Campaigns in this browser']));
      container.appendChild(el('ul', { class: 'items' }, list.map((row) => el('li', {}, [
        row.id === State.id ? el('b', {}, [row.name || row.id]) : el('button', { class: 'ref', type: 'button', onclick: () => { State.switchTo(row.id); location.reload(); } }, [row.name || row.id]),
        row.id !== State.id ? button('remove', () => { if (confirm('Remove "' + row.name + '" from this browser? Save its pack first if you want it back.')) { State.remove(row.id); draw(); } }, 'ghost tiny') : null,
      ]))));
      const file = el('input', { type: 'file', accept: 'application/json', hidden: true, onchange: (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        f.text().then((txt) => {
          try { State.importPack(JSON.parse(txt)); location.reload(); } catch (e) { alert(e.message); }
        });
      } });
      container.appendChild(el('div', { class: 'chiprow' }, [
        button('New campaign', () => { const n = prompt('Campaign name'); if (n) { State.create(n, { campaign: { modules: [MODULE], books: [] } }); location.reload(); } }),
        button('Save pack (download)', () => State.downloadPack()),
        button('Restore pack…', () => file.click(), 'ghost'),
        file,
      ]));
      container.appendChild(el('p', { class: 'muted small' }, ['A pack is the campaign as an instance: the party, the scenes, every note and roll, as JSON. Keep packs with the campaign; this browser is a cache.']));
    };
    ctx.on('state:changed', draw);
    draw();
  }

  Panels.register('adventure', { label: 'Adventure', render: renderAdventure });
  Panels.register('party', { label: 'Party', render: renderParty });
  Panels.register('inspector', { label: 'Inspector', render: renderInspector });
  Panels.register('bestiary', { label: 'Bestiary', render: renderBestiary });
  Panels.register('tables', { label: 'Tables', render: renderTables });
  Panels.register('rules', { label: 'Rules & Book', render: renderRules });
  Panels.register('log', { label: 'Log', render: renderLog });
  Panels.register('campaign', { label: 'Campaign', render: renderCampaign });

  window.TroikaPanels = { currentScene, goTo, characterLoader, MODULE };
})();
