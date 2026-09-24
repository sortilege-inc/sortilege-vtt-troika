// engine/config.js — where things are. The one file a deployment edits.
window.VttConfig = {
  system: 'troika',
  title: 'Troika!',
  channel: 'sortilege-vtt-troika',        // BroadcastChannel name (same-machine windows)
  storagePrefix: 'sortilege-vtt-troika',  // localStorage key prefix
  dataGlobal: 'TROIKA',                   // the global data/*.js registers into
  // The pages, relative to the site root; the gm/ pages carry <base href="../"> so every
  // path stays root-relative.
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // what a fresh browser opens on until a campaign is created or restored
  defaultCampaign: { name: 'A new campaign', modules: ['adventure'], books: [] },
  // the three panels the GM page opens on (engine/app.js)
  defaultSlots: ['adventure', 'party', 'inspector'],
  // The Worker that holds player sessions. Served from localhost the app talks to
  // `wrangler dev`; deployed, to the URL below. Empty = sessions disabled.
  // The family standards (PLAYBOOK §4b): the public site's book tabs are off — the GM turns them on,
  // per browser, in the GM page's Settings (engine/site.js) — and a veil stands in front of /gm/
  // (engine/app.js). The GM's own material lives in the GM tabs (engine/gm-panes.js), in the pack.
  siteBooks: false,
  gmGate: {
    title: 'The GM\u2019s table',
    text: 'Beyond is the GM\u2019s material \u2014 the prep, the threads, what the players have not yet found. If you are playing, turn back.',
    enter: 'Enter',
    leave: 'Turn back',
  },
  worker: {
    deployed: 'https://sortilege-vtt-troika.sortilege.workers.dev',
    local: 'http://localhost:8788',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
