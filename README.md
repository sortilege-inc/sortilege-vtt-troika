# sortilege-vtt-troika

A play aid for **Troika! Numinous Edition** (Daniel Sell, Melsonian Arts Council) built from
the [Titterpig DSL corpus](../../Titterpig/DSL/titterpig-dsl-troika) — the whole book by
chapter, the Bestiary, the tables, *The Blancmange & Thistle*, and the GM's table to run it
from. Plan, decisions and milestones: [PLAN.md](PLAN.md).

Buildless static site (GitHub Pages). The site is the book; the GM's table is under `gm/` —
the same engine TEETH's and Invisible Sun's tables run on, with Troika's own panels. Players
join a session by room code on `gm/play.html`.

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

## Rights

*Troika! Numinous Edition* is © Daniel Sell / the Melsonian Arts Council. This is an
unofficial play aid for the owner's table, not a redistribution of the book.
