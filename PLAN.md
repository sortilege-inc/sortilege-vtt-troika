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

**D1 — (owner, 2026-09-22) DECIDED and landed in the corpus (`titterpig-dsl-troika` `bc21dc0`): `ACTOR "Character"` declared in the BASE via `gen_base.py`, as recommended below.** The recommendation as it was put: The playbook derives the
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
- *Now:* the BASE declares `#tro5Character000001 ACTOR "Character"` with exactly the fields
  above (`^"Background"` a hash-bound reference to the Background type); `check_shape`
  asserts it. **M4 is unblocked.** Until M4 lands, the Party panel and the player's page still
  hold a character file generically.

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
| M0 | Repo skeleton: `engine/*.js` and `build/parse_dsl.py` copied whole (generic code only), `worker/` renamed, `engine/config.js`, `.gitignore`, launch entries (`vtt-troika` 8737, `vtt-troika-worker` 8787), this plan, README; git identity | **landed 2026-09-22** (`df80839`) — `grep -n 'invisiblesun\|sooth' engine/*.js worker/src/index.ts` matches nothing; the pilot parse read 47 of 47 corpus files unchanged |
| M1 | `build/` generates `data/` from the corpus: `build_data.py` (file → chapter map; TEETH's shapes for DESCRIPTION, TABLE, ENTRIES, arcs; the self-registering data files), `verify_data.py` both directions over every subdirectory, `check_shape.py`, `build.sh` | **landed 2026-09-22** (`1256514`) — `bash build/build.sh`: 47 corpus files → 11 chapters, 315 entities; `verify_data: 1248 strings — 0 uncovered · 0 unsourced`; `check_shape: OK (42 assertions)`; `node --check` on every data file |
| M2 | The site: the book by chapter (outline from the DEF tree, rule numbers, tables as tables, backgrounds, spells with cost, the adventure by phase and scene), the bestiary, search; the character-creation chapter with its 36 backgrounds | **landed 2026-09-22** — browser on 8737, through the real controls: the shelf lists the 10 chapters + the BASE from `index.js`; The Rules' outline nests 1 › 1.1 › 1.2 … 11 by the book's numbering and *1.1 Roll Under* reads verbatim under its crumbs; on *15.3 Initiative is Different for Enemies* the printed "(5.5)" is a link and clicking it opened *5.5 Enemies*; *Melee Weapons* renders its 14 rows cell for cell with the printed footnote and its 14 weapon entries; *Alzabo* shows Skill 10 · Stamina 21 · Initiative 4 · Armour 1, its six mien lines and its text; the adventure lists its two routes and 13 scenes and *1st Floor Passenger: The Old Lady* reads verbatim; Spells opens as 74 cards; *Making a character* prints the Overview and the two essays and **Roll d66** gave `33` and its Background card. One defect found and fixed on the way (a rule with no sub-rules threw on `appendChild(null)`); two corpus defects found and reported, not patched (decision 6) |
| M3 | The GM's page: the engine's shell over Troika's panels — the Adventure tracker, Party (files held generically until D1), Inspector, Bestiary (put in the scene), Tables (rolled on), Rules & Book, Log, Campaign; the table and the player's page wired | **landed 2026-09-22** — browser, a fresh tab at 1400 px, through the real controls: the shell opens on Adventure · Party · Inspector with *The Blancmange & Thistle · 0 of 13 scenes done* and the first scene's text; clicking *2nd Floor Passenger: The Gas Form* made it current (`state.current.adventure` = its id); the Bestiary listed *36 in the Bestiary*, *Goblin* opened in the Inspector with Skill 5 · Stamina 6 · Initiative 1 · Armour 1 and its six mien lines, and **Put in 2nd Floor Passenger: The Gas Form** stored `cast[scene] = [Goblin]`, showed the chip *Goblin ×* and *1 in it* on the tracker; Tables listed the six endpaper tables and **Roll** on *The OOPS! Table* logged row 36 verbatim; Rules & Book searched "Luck" → 48 results and the first opened *3.2 Gaining and Losing Luck* in the Inspector; the Log shows the roll; the pack carries `cast` beside the engine's keys; localStorage held only the campaign list and the default campaign. `gm/vtt.html?scene=…` opened titled *Troika! — 2nd Floor Passenger: The Gas Form* with all 13 scenes and Goblin offered as a token; `gm/play.html` showed *Join the table*. 0 console errors on every page in a fresh tab. Under node the system op applies and the role rule holds (GM permits `setSceneCast`, a player does not) |
| M4 | The character sheet derived from the `Character` ACTOR (`system/troika/sheet.js`), the creator (`creator.js`: the Overview walked step by step), a per-browser roster (`roster.js`), the live sheet and the rolls | **landed 2026-09-22** — browser, through the real controls. *The creator:* the steps are read out of the Overview's own sentences (Name · 1. Skill · 2. Stamina · 3. Luck · 4. Baseline Possessions · 5. Background · The sheet); **Roll 1d3+3** gave Skill 6 (3+3), **Roll 2d6+12** Stamina 18 (4+2+12), **Roll 1d6+6** Luck 11; **Record them** wrote Monies *7 Silver Pence* (3+4), Provisions 6, the Knife / Lantern & Flask of Oil / Rucksack into the Inventory and the Knife as a Weapon; **Roll d66** → 12 → *Befouler of Ponds* recorded its 7 ranked rows (spells among them), its Special and its possessions; the sheet lists the 12 declared fields in the printed layout with nothing left over (`Weapons ×4`, `Inventory ×12` from the printed sheet's own lines) and the file round-trips byte-identically with `templateId #tro5Character000001`; localStorage held only the roster. *The table:* the file became a party member whose card reads *Ossian Vahl, the Befouler of Ponds · Skill 6 · Stamina 18 · Luck 11*; on the live sheet **Test your Luck** rolled 6 under 11 → success and Luck 11 → 10 (3.1); **Test Spell – Drown** 5 under 9 → success and a tick (11); **Cast** charged 4 Stamina (18 → 14) before the roll (Spells); **Damage** on the Knife rolled 5 → 4 from its row 2 2 2 2 4 8 10 (8); **Eat one** took Provisions 6 → 5 and capped Stamina at 18 (4.2); every roll in the Log as a roll line; the pack carries `live` (Stamina, Luck, Provisions, ticks, provisionsToday). 0 console errors on the GM page |
| M5 | Sessions proven with `wrangler dev`; deploy is the owner's step (D3) | **landed 2026-09-22** — `wrangler dev` on **8788** (launch entry `vtt-troika-worker`; 8787 was held by another session's Worker, decision 15): the GM's real **Start session** went live as room **7QUMT** (status online, join link shown); a player at a second origin (`http://127.0.0.1:8737/gm/play.html?s=7QUMT`) joined by the link as role *player*, took the room's snapshot — the party, the current scene, its cast — with **no GM notes** (`progress` arrived empty), pressed **Claim** and got Ossian Vahl's live sheet (Stamina 14/18, Luck 10/11 carried from the earlier play); **Test your Luck** there rolled 6 under 10 → Luck 9 on the player's page and on the GM's within a second, the roll in the GM's Log with the same dice; the player's `setSceneDone` (a GM-only op) left the GM's state untouched; the GM's `setSceneCast` (Goblin + Ekodat) reached the player, and a note written as *GM ONLY* did not. 0 console errors on both pages. **Deploy is the owner's step:** `cd worker && npx wrangler deploy`, set `worker.deployed` in `engine/config.js`, and the origin (D3) in `wrangler.jsonc` `ALLOWED_ORIGIN` |

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
| 6 | Two defects in the corpus's `.arc` found while reading the rendered scenes — 15 doubled bold-italic runs (`***sweet old lady*** ***sweet old lady***`) and the bonbon table read by height across its two columns — are reported to `titterpig-dsl-troika/TODO.md` (`e8c0633` there) and shown here as they are | `data/` is generated; the tool never patches the corpus's text (ground rules). |
| 7 | The GM's **Tables** panel rolls on an endpaper table by picking one printed row uniformly at random and logging it verbatim | The book's d66 over 36 rows is uniform; the row is the corpus's, the pick is this tool's, and nothing about a roll is decided beyond that. |
| 9 | **(owner, 2026-09-22: "fix the arc defects and the doubled bold-italic runs and the Actor definition")** All three fixed **in the conversion, not in the corpus text**: `extract.lines_of` now merges the overlapping lines PyMuPDF splits at a face change — the cause of the 33 doubled emphasis runs (every weight, not only bold-italic), of stat lines split in two and of seams read as a second column; `gen_arc` reads the two tables printed inside a scene (the bonbons, *d6 Mental Anguish*) from the page geometry into `TABLE` blocks on their SCENEs; `gen_base` declares the Character ACTOR. Regenerated; 20 pages changed, every diff reviewed as a repair; `qa.py` 0 lost / 0 invented, `qa_dsl` 0 not in the book, `units.json` unchanged (323), corpus gates green; VERSION `0.5.1` on the five touched files (base, introduction, rules, tables, arc) | The corpus is generated; a hand edit to a generated file is clobbered on the next run and hides the cause. Re-extraction was safe because PyMuPDF 1.28.2 (installed for this) reproduces the stored `pages_json` byte for byte. |
| 10 | The VTT build carries a SCENE's `TABLE` (`build_scene.table`), `check_shape` asserts the two scene tables and the Character ACTOR (45 assertions), and `TroikaEntity.scene` renders the table under the scene's text | The bonbon table had rendered as interleaved paragraphs; now it is a table, cell for cell, like the endpapers. |
| 11 | The creator's steps are **parsed from the Overview's sentences** ("Roll 1d3+3 to determine Skill" → a roll into the declared INTEGER field of that name; the italic run after "starts with:" → the baseline list; "Roll d66 on the Background Table" → the d66), not hand-listed; the sheet's line counts come from the printed sheet's own numbered lines (12) and damage lines (4) | Nothing about a step is hand-listed except a number the book states only in prose (PLAYBOOK §2); here even those are read out of the sentence, so a corrected Overview corrects the creator. |
| 12 | Numbers the rules state only in prose are named constants citing the sentence: double 6 fails (1.1), double 1 casts (Spells), a Luck test costs 1 (3.1), a Provision heals 1d6 and three a day (4.2), sleep restores 2d6 (3.2, 4.2), armour −0/−1/−2/−3 to a minimum of 1 (9), up to 3 advances a rest (11.1) | The playbook's rule for prose-only numbers; each is one line to check against its rule. |
| 13 | A possession that names a weapon on the Damage tables is written to the Weapons rows as well as the Inventory, so the damage roll can find its row ("a Knife" → the Knife row; "(Damage as Mace)" → Mace) | The sheet prints Weapons apart from the Inventory; the tables are the corpus's, the match is by name and shown ("as Knife · 2 2 2 2 4 8 10"). |
| 14 | A spell row is one by the corpus's `Is Spell` flag **or** the printed "Spell –" prefix; the corpus now sets the flag from the prefix (`5b5046c`), and the 8 possessions split at a printed line-wrap were rejoined there too — both found by walking the creator | The flag the BASE declares was never set, so the cost was not charged; fixed in the generator, not in the tool, and the tool tolerates either. |
| 15 | The local Worker runs on **8788**, not 8787: every VTT on this machine had used 8787 and two cannot share it, and another session's Invisible Sun Worker held it. `engine/config.js` `worker.local`, both launch entries, `package.json` and the Worker README say 8788; the Worker admits any localhost / 127.0.0.1 origin whatever the port | The one deployment file plus the launch entry; nothing else knows the port. |
| 8 | Verification in the pane drove the real buttons by DOM click (`button.click()` on the control the GM would press) and read the DOM and `VttState` back, because element refs went stale on every panel redraw and screenshots came back black at the pane's viewport | The control exercised is the same; only the hand on it differs. Noted so the next build does not burn an hour on refs. |

## STOPPED HERE — to resume

**M0–M5 landed 2026-09-22** and pushed. What remains is the owner's: **D3** (the origin) and the
deploy — GitHub Pages from `main`, `cd worker && npx wrangler deploy`, `worker.deployed` in
`engine/config.js`, `ALLOWED_ORIGIN` in `worker/wrangler.jsonc`. Local dev: `worker/` bundles (`npx wrangler deploy
--dry-run` builds `index.js` with `setSceneCast` inside), launch entry `vtt-troika-worker`. **D3**
(the origin) is the owner's pick before deploy.

To resume: `bash build/build.sh` (gate green), start `vtt-troika`, open `/` and `/gm/`.
