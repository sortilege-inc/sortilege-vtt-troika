// system/troika/table.js — what Troika! tells the table (engine/vtt.js) and the player's
// page (engine/play.js): which scenes are in play, what can stand on the table, what a
// token's state reads as, and how a character file becomes a party member. The engine
// never asks the corpus directly.
//
// The module is the corpus's one .arc, The Blancmange & Thistle (PLAN.md D4). It ships no
// maps and no cast: a map is whatever image the GM sets on a scene, and who is in a scene
// is what the GM has put there from the Bestiary (system op `setSceneCast`).
window.VttSystem = (function () {
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
  // a token's word: a character's current Stamina and Luck, an enemy's stat line
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      if (!m) return null;
      const cur = (k) => Sheet().current(m, k);
      return { text: ['Stamina ' + cur('Stamina'), 'Luck ' + cur('Luck')].join(' · '), pips: [] };
    }
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

  // ── the character: the sheet derived from ACTOR "Character" (system/troika/sheet.js) ──
  const Sheet = () => window.TroikaSheet;
  const readCharacter = (obj, fileName) => Sheet().readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet().downloadMember(m);
  const liveSheet = (m, opts) => Sheet().live(m, opts);
  const memberSubtitle = (m) => Sheet().sentence(m.character || {});

  return {
    MODULE, scenes, scene, currentSceneId, cast, maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle,
  };
})();
