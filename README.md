# sortilege-vtt-troika

A play aid for **Troika! Numinous Edition** (Daniel Sell, Melsonian Arts Council) built from
the [Titterpig DSL corpus](../../Titterpig/DSL/titterpig-dsl-troika) — the whole book by
chapter, the Bestiary, the tables, *The Blancmange & Thistle*, and the GM's table to run it
from. Plan, decisions and milestones: [PLAN.md](PLAN.md).

Buildless static site (GitHub Pages). The site is the book; the GM's table is under `gm/` —
the same engine TEETH's and Invisible Sun's tables run on, with Troika's own panels. Players
join a session by room code on `gm/play.html`.

## Status

| Milestone | State |
|---|---|
| M0 — repo skeleton: the engine, the parser, the Worker, the config | **landed** (2026-09-22) |
| M1 — `build/` generates `data/` from the corpus; the gate both ways; the shape check | **landed** (2026-09-22) |
| M2 — the site: the book by chapter, the Bestiary, making a character, search | **landed** (2026-09-22) |
| M3 — the GM's page: Adventure, Party, Inspector, Bestiary, Tables, Rules & Book, Log, Campaign; the table; the player's page | **landed** (2026-09-22) |
| M4 — the character sheet, the creator, the live sheet and the roll | next: D1 landed 2026-09-22 (`ACTOR "Character"` in the corpus BASE) |
| M5 — sessions through the Worker; deploy | Worker bundles; deploy and the origin (D3) are the owner's steps |

## Running it

```bash
python3 -m http.server 8737
```

then open `http://localhost:8737/`.

## Where the content comes from

Everything this tool shows is generated from `titterpig-dsl-troika/0.5`, whose own gates
report 323 of 323 source units covered and every sentence verbatim against the book's text
layer. **Nothing here is hand-transcribed**; `data/*.js` is generated and regenerating is the
only way to change it.

```bash
bash build/build.sh            # build → verify both directions → check shapes → node --check
```

| Script | What it does |
|---|---|
| `build/parse_dsl.py` | The generic DSL parser (spec 0.5). Contract: every token consumed or it raises. Reads all 47 corpus files unchanged. |
| `build/build_data.py` | One `data/<chapter>.js` per chapter and `data/index.js`. Holds the file → chapter map — the only hand-written list in the build — and refuses to run if any corpus file is claimed by no chapter. |
| `build/verify_data.py` | The gate, both directions: every string and caret name the corpus prints reaches `data/`, and every string in `data/` came from the corpus. |
| `build/check_shape.py` | What the gate cannot see: that a string landed on the right *field*. Every assertion is against a count grepped from the corpus. |

## Layout

```
index.html               the site: the book by chapter, the Bestiary, making a character, search
build/                   the generator and its gates
data/                    GENERATED — window.TROIKA.books / .entities / .index
engine/                  system-agnostic: bus, ops, state, render, the data loader, panels, the
                         app shell, session, the table, the player's page, the site shell
system/troika/           the Troika! module: data.js (accessors), entity.js (an entity as the
                         book holds it), site.js (the tabs); for the table: ops.js (the system's
                         own ops), table.js (the table adapter), panels.js (the panels)
gm/                      the GM's page, the table (vtt.html), the player's page (play.html) —
                         each carries <base href="../">
worker/                  the session rooms (Cloudflare Worker + Durable Object); deploy with
                         `npx wrangler deploy`, then set engine/config.js worker.deployed
assets/css/              the look: a black band, a warm page, three inks
```

## Rights

*Troika! Numinous Edition* is © Daniel Sell / the Melsonian Arts Council. This is an
unofficial play aid for the owner's table, not a redistribution of the book.
