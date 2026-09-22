# sortilege-vtt-troika — plan and decision log

A virtual tabletop for **Troika! Numinous Edition** (Daniel Sell, Melsonian Arts Council), built
on the Titterpig corpus `titterpig-dsl-troika/0.5`. Its shape follows `sortilege-vtt-teeth`'s
`PLAYBOOK.md` and the Invisible Sun build that applied it second; both are read-only reference —
nothing in either repo is modified here. Sixth in the line — Wyldwolf Axis, NOVA Open, City of
Winter, TEETH, Invisible Sun.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and
verified in the browser by the main session.

## Ground rules (inherited, 2026-09-22)

- The TEETH and Invisible Sun repos are read-only reference. What is reused is the
  system-agnostic code only: `engine/*.js` (no game words), the generic DSL parser, the shape of
  the gate and of the build. No other system's data, `system/` module, css, book map or
  namespace comes across. Every word this site shows is from `titterpig-dsl-troika/0.5`.
- `data/` is generated; regenerating is the only way to change it. Corpus gaps found while
  building are reported to `titterpig-dsl-troika/TODO.md`, never patched in the tool.
- Rules text is verbatim. The tool's own words are labels and connective prose only.

## What is on disk (read 2026-09-22)

| Input | State |
|---|---|
| `~/Sortilege/VTT/sortilege-vtt-troika` | cloned empty; remote `sortilege-inc/sortilege-vtt-troika`; identity Jordan Peacock <jordan@sortilege.online> set per repo |
| `~/Sortilege/Titterpig/DSL/titterpig-dsl-troika/0.5` | 47 files (10 `.ttrpg`, 36 `.actor`, 1 `.arc`), 236 KB, converted 2026-09-22 (`501e33e`); its `gates.sh`: validator 0/0, references 372 sites 0 hashless, constructs 0, coverage 323/323 |
| The conversion workspace | `~/Sortilege/Titterpig/Temp/troika-conversion` — `scripts/build.py` regenerates every corpus file **including `base.ttrpg`** (`gen_base.write`) |
| The PDF | `~/Sortilege/Titterpig/RAW/Troika/Troika! Numinous Edition.pdf` (per the corpus `sources.json`) |

**The inherited parser reads this corpus unchanged:** `parse_dsl.parse_files` on all 47 files →
47 of 47 parse (pilot, 2026-09-22). No parser extension was needed.

### The corpus, by what the tool needs

| Need | In the corpus | Shape |
|---|---|---|
| The Rules | `^"Rule"` × 77 (sections 1–11 in `rules`, 15 in `enemies`), each with `Number`/`Title`, **nested by the book's own numbering** | a tree of DEFs; the outline is the nesting |
| Character creation | `^"Character Creation"` (the Overview and the two essays on Backgrounds) + `^"Background"` × 36 with `Roll` (d66), `Possessions`, `Advanced Skills` (221 `^"Skill Rank"` rows), `Special`; one Background carries its own Mien `TABLE` | records |
| Advanced Skills · Items · Spells | 28 · 17 · 74 (each spell with its printed `Cost`) | records |
| The Bestiary | `ACTOR "Enemy"` in the BASE; 36 `.actor` files, one each, with Skill / Stamina / Initiative / Armour / Damage, a d6 `Mien` list (207 lines), Spells, Special, Description | the corpus's only ACTOR |
| The tables | `^"Table"` × 7 with `TABLE { COLUMNS / ROW }` cell for cell (118 rows), the three Damage tables with 22 hashless `^"Weapon"` ENTRIES rows | `table` + `entries` |
| The adventure | `.arc`: a `FLOW` of 2 `PHASE`s over 13 `SCENE`s, each a DESCRIPTION | `book.arcs[0]` — the module the table runs |
| The printed sheet | `^"Character Sheet"` with the 17 printed labels nested under it | labels only |
| **The player character** | **nothing** — the BASE declares no ACTOR for a character, no TEMPLATE, no `.actor` for one | see **D1** |

## Decisions

**D1 — PROPOSED: the corpus declares no player-character ACTOR.** The playbook derives the
sheet, the live sheet and the creator from the ACTOR type's property declarations, read at
runtime (PLAYBOOK §1b); Invisible Sun's precedent (its D1, owner 2026-09-20) was to add the
missing declarations to the corpus BASE as its own commit rather than hand-list a sheet in the
tool. Here there is nothing to extend: the only ACTOR is `Enemy`, which by the book's own rule
(15.1) is "not like character Skill" and has no Luck.

- *What the book prints:* the sheet (pp. 110–111) carries Name, Background, Skill, Stamina,
  Luck, Advanced Skills & Spells, Special, four Weapon rows with their Damage line, Wearing,
  twelve numbered Inventory lines, Monies, Provisions. The Overview (p. 2) states the
  generators — 1d3+3 Skill, 2d6+12 Stamina, 1d6+6 Luck — and the baseline possessions;
  Encumbrance (10) says "You may carry twelve things without issue."
- **Recommendation:** add an `ACTOR "Character"` to the BASE **in the conversion's generator**
  (`troika-conversion/scripts/gen_base.py`), regenerate, and commit it to the corpus repo with
  its gates green — because `build.py` rewrites `base.ttrpg`, a hand edit to the file would be
  clobbered on the next regeneration. Draft declaration, every field a printed label or a
  numbered rule:

  ```
  #tro5Character000001 ACTOR "Character" DEF {
      # The printed character sheet (pages 110-111); the generators are the Overview (page 2).
      PROPERTIES {
          ^"Name" STRING REQUIRED
          ^"Background" #tro5Background00001 ^"Background"
          ^"Skill" INTEGER REQUIRED                 # 1d3+3
          ^"Stamina" INTEGER REQUIRED               # 2d6+12
          ^"Luck" INTEGER REQUIRED                  # 1d6+6
          ^"Advanced Skills" LIST OF #tro5SkillRank000001 ^"Skill Rank"
          ^"Special" STRING
          ^"Weapons" LIST OF STRING                 # the sheet's four Weapon rows
          ^"Wearing" STRING
          ^"Inventory" LIST OF STRING               # the sheet's twelve numbered lines (10)
          ^"Monies" STRING
          ^"Provisions" INTEGER
      }
  }
  ```
  Current Stamina, Luck spent and Damage taken are live sheet state (as Invisible Sun's bene
  are), not declarations.
- *Trade-off:* ~20 lines in a corpus converted this morning and gated at 323/323; touches the
  generator and the BASE (VERSION bump per the bump rule), then `gates.sh` rerun. The
  alternative — a hand-listed sheet in `system/troika/sheet.js` — is the drifting second copy
  the playbook forbids.
- *Until decided:* the sheet, the creator, the live sheet and the roll are **not built**; the
  Party panel and the player's page hold a character file generically and say so. Everything
  else in this scaffold stands without it.

**D2 — the site's "books" are the chapters of the one book** (autonomous, tool/method). The
corpus keeps each chapter in its own file; `build/build_data.py`'s file → chapter map (the
only hand list in the build) makes the shelf the book's own contents page. Every corpus file
must be claimed by exactly one chapter or the build exits non-zero; the 36 `.actor` files are
claimed by directory.

**D3 — PROPOSED: the origin.** GitHub Pages from `main`, root, as the others; the custom domain
is the owner's pick (TEETH: `teeth.`, Invisible Sun: `actuality.`). Nothing hard-codes one
origin — the Worker's `ALLOWED_ORIGIN` is a comma list and `engine/config.js` is the one file
a deployment edits. **Recommendation:** `troika.sortilege.online`.

**D4 — the adventure is the campaign's module** (autonomous). *The Blancmange & Thistle* is the
corpus's one `.arc`, so `defaultCampaign.modules = ['adventure']` and the GM page opens on its
tracker: the two routes as phases, the thirteen scenes with done / notes / current through the
engine's own scene ops. The corpus has no CAST, so who is in a scene is the GM's own — put
there from the Bestiary (system op `setSceneCast`, shared).

**D5 — Markdown emphasis in the corpus is rendered, not shown as asterisks** (autonomous,
presentation). The conversion carries the book's italics and bold as `*…*` / `**…**` inside
DESCRIPTION strings (Invisible Sun's rule: typography is content). The string in `data/` stays
byte-identical; the renderer sets the marks as emphasis. A parenthesised rule number in the text
("(11.1)") is linked to the rule the corpus gives that Number, since the corpus states that is
what such a reference names — a stand-off link, nothing in the text changes.

## Layout (the inherited three-layer shape; everything game-specific written here)

```
index.html               the site: the book by chapter, the bestiary, making a character
build/                   the generator and its gates
data/                    GENERATED — window.TROIKA.books / .entities / .index
engine/                  system-agnostic, copied whole: bus, ops, state, render, data loader,
                         panels, app shell, session, table, player page, site shell
system/troika/           data.js (accessors), entity.js (an entity as the book holds it),
                         site.js (the tabs); for the table: ops.js, table.js, panels.js
gm/                      the GM's page, the table (vtt.html), the player's page (play.html)
worker/                  the session rooms (Cloudflare Worker + Durable Object); not deployed
assets/css/              the look
```

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| M0 | Repo skeleton: `engine/*.js` and `build/parse_dsl.py` copied whole (generic code only), `worker/` renamed, `engine/config.js`, `.gitignore`, launch entries (`vtt-troika` 8737, `vtt-troika-worker` 8787), this plan, README; git identity | see the decision log and the commit |
| M1 | `build/` generates `data/` from the corpus: `build_data.py` (file → chapter map; TEETH's shapes for DESCRIPTION, TABLE, ENTRIES, arcs; the self-registering data files), `verify_data.py` both directions over every subdirectory, `check_shape.py`, `build.sh` | |
| M2 | The site: the book by chapter (outline from the DEF tree, rule numbers, tables as tables, backgrounds, spells with cost, the adventure by phase and scene), the bestiary, search; the character-creation chapter with its 36 backgrounds | |
| M3 | The GM's page: the engine's shell over Troika's panels — the Adventure tracker, Party (files held generically until D1), Inspector, Bestiary (put in the scene), Rules & Books, Log, Campaign; the table and the player's page wired | |
| M4 | **(after D1)** the character sheet derived from the ACTOR, the creator (the Overview walked step by step: the three rolls, the baseline possessions, a d66 Background), the live sheet and the 2d6 Roll Under / Roll Versus | |
| M5 | Sessions proven with `wrangler dev`; deploy is the owner's step (D3) | |

One commit per milestone, pushed; each proven in the browser by the main session through the
real controls (PLAYBOOK §5) before the next begins. Use the launch entry, never Bash, for the dev
server.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | The engine and the parser are copied whole from the Invisible Sun repo (the later derivation of TEETH's, with the on-demand data loader and `defaultSlots`); the one comment naming that system was made generic | The engine has no game words; the two repos differ by 40 lines, all of them fixes. |
| 2 | The build combines TEETH's record shape (`desc`, `table`, `entries`, arcs on the book) with Invisible Sun's file → book map that refuses an unclaimed file, and the `slot` and ENUM-instance fixes | This corpus prints tables cell for cell and hashless ENTRIES rows, which the IS build never met; the IS build's refusal is what catches a file added later. |
| 3 | No lazy loading: every page loads every chapter | 456 KB of data in all. |
| 4 | `check_shape.py` counts against grep over the corpus, never a typed number; four of its first assertions were wrong about the corpus and were corrected to what it writes (a Background's own Mien TABLE; three section headings with no text; the untyped Bestiary roster) | The string gate is blind to a string on the wrong field; the shape gate must not be blind to the corpus's own shape. |
| 5 | D2, D4, D5 above | — |

## STOPPED HERE — to resume

See the milestone table: the next milestone not marked **landed** is the one to build. D1 and
D3 await the owner.
