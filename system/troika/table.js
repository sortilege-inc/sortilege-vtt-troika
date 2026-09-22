// system/troika/table.js — what Troika! tells the table (engine/vtt.js) and the player's
// page (engine/play.js): which scenes are in play, what can stand on the table, what a
// token's state reads as, and how a character file becomes a party member. The engine
// never asks the corpus directly.
//
// The module is the corpus's one .arc, The Blancmange & Thistle (PLAN.md D4). It ships no
// maps and no cast: a map is whatever image the GM sets on a scene, and who is in a scene
// is what the GM has put there from the Bestiary (system op `setSceneCast`).
window.VttSystem = (function () {
  const { el } = window.VttRender;
  const D = window.TroikaData;
  const E = window.TroikaEntity;
  const State = window.VttState;
  const S = () => State.state;

  const MODULE = 'adventure';

  function scenes() {
    return D.pages(MODULE).map((p) => ({ id: p.scene.id, name: p.scene.name, phase: p.phase, moduleId: MODULE }));
  }

  const scene = (id) => D.scene(MODULE, id);

  function currentSceneId() {
    const cur = (S().current || {})[MODULE];
    const all = scenes();
    return (all.find((s) => s.id === cur) || all[0] || {}).id || null;
  }

  const cast = (sceneId) => ((S().cast || {})[sceneId] || []).map((id) => D.entity(id)).filter(Boolean);

  // no shipped maps: the table draws the GM's own image or a blank grid, keyed by scene
  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  // ── tokens: the party, and the current scene's cast ────────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The party', items: party });
    const sc = scene(currentSceneId());
    const here = sc ? cast(sc.id).map((e) => ({ label: e.name, kind: 'cast', ref: e.id })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    return groups;
  }

  const COLORS = { party: '#0f7c86', cast: '#b8236b', marker: '#6f665a' };
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a party token's word waits on the character type (PLAN.md D1); an enemy's is its stat line
  function tokenStatus(t) {
    if (t.kind !== 'cast' || !t.ref) return null;
    const e = D.entity(t.ref);
    if (!e) return null;
    const bits = ['Skill', 'Stamina', 'Armour'].map((k) => (D.val(e, k) != null ? k[0] + ' ' + D.val(e, k) : null)).filter(Boolean);
    return { text: bits.join(' · '), pips: [] };
  }

  function selectToken(t) {
    if (t.kind === 'party') window.VttBus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) window.VttBus.emit('select', { kind: 'entity', id: t.ref });
  }
  const tokenMenu = () => null;

  // ── a character file, held generically until D1 ────────────────────
  // The corpus declares no character type yet, so a file is kept as it is: a JSON object
  // with a name, its fields shown as they come. When the ACTOR lands, readCharacter types
  // it and liveSheet becomes the sheet derived from that declaration.
  const CHARACTER_KIND = 'sortilege-vtt-character';
  function readCharacter(obj, fileName) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a character file.');
    const c = obj.kind === CHARACTER_KIND && obj.character ? obj.character : obj;
    const name = c.Name || c.name || (obj.name) || (fileName || 'Character').replace(/\.[^.]+$/, '');
    return {
      id: State.genId('pc'),
      templateId: obj.templateId || c.templateId || 'troika-character',
      name,
      source: { kind: 'file', name: fileName || null },
      character: c,
      live: {},
      notes: '',
      playerNotes: '',
    };
  }

  function downloadCharacter(m) {
    const pack = { kind: CHARACTER_KIND, version: 1, system: 'troika', templateId: m.templateId, name: m.name, character: m.character || {}, live: m.live || {} };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (m.name || 'character').replace(/[^\w.-]+/g, '_') + '.troika-character.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function liveSheet(m, opts) {
    const c = m.character || {};
    const keys = Object.keys(c).filter((k) => k !== 'name' && k !== 'Name');
    return el('div', { class: 'sheet live' }, [
      el('div', { class: 'sheet-head' }, [el('h2', {}, [m.name]), el('div', { class: 'muted small' }, [memberSubtitle(m)])]),
      el('div', { class: 'callout muted small' }, ['The sheet is derived from the corpus’s character type, which the corpus does not declare yet (PLAN.md, D1). Until it does, the file is shown as it came.']),
      keys.length ? el('div', { class: 'fields' }, keys.map((k) => el('div', { class: 'prop' }, [
        el('div', { class: 'prop-k' }, [k]),
        el('div', { class: 'prop-v' }, [typeof c[k] === 'object' ? JSON.stringify(c[k]) : String(c[k])]),
      ]))) : el('div', { class: 'empty' }, ['Nothing but a name.']),
    ]);
  }

  const memberSubtitle = (m) => (m.source && m.source.kind === 'file' ? 'from ' + (m.source.name || 'a file') : 'a Troika! character');

  return {
    MODULE, scenes, scene, currentSceneId, cast, maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle,
  };
})();
