#!/usr/bin/env python3
"""
build_data.py — the Troika! corpus (titterpig-dsl-troika/0.5) → data/*.js.

Everything the site shows comes from here; nothing is hand-typed. The shape is GENERIC
and hash-keyed — the engine reads it without knowing the game, and system/troika/
interprets an entity by its `type` (the caret name it EXTENDS):

    window.TROIKA.index          { system, corpus, counts, books: [ … ] }
    window.TROIKA.books[<id>]    { id, title, label, kind, files: [{file, container, name}],
                                   entities: [ids in printed order], arcs: [ … ] }
    window.TROIKA.entities[<h>]  { id, name, key, form, book, file, type, typeHash, parent,
                                   slot, children: [ids], desc, props: [ … ], entries: [ … ],
                                   table: {columns, rows} | null, choices, guidance, refs }

One thing this corpus needs that Invisible Sun's did not, and one it does not:

  * **A book is one 120-page volume, read by chapter.** The corpus keeps each chapter in
    its own file (The Rules, the Backgrounds, the Spells, the Bestiary's 36 `.actor`s, the
    endpaper tables, the adventure as an `.arc`), so a "book" here is a CHAPTER of *Troika!
    Numinous Edition* and the shelf is the book's own contents page. BOOKS below is the
    file → chapter map, the only hand-written list in the build. Every corpus file must be
    claimed by exactly one chapter or this exits non-zero — that is what stops a file added
    to the corpus later from being silently left out.

  * **No channels.** 236 KB in all; every page loads every chapter.

Every string is carried byte-for-byte from the DSL (only DSL escapes resolved); this file
decides shape alone. verify_data.py then proves the round trip in both directions.

    python3 build/build_data.py [<path to titterpig-dsl-troika/0.5>]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dsl import parse_files  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CORPUS = os.path.expanduser("~/Sortilege/Titterpig/DSL/titterpig-dsl-troika/0.5")
P = "troika-0.5-core-"

# ───────────────────────── the file → chapter map ─────────────────────────
#
# `label` is this build's own short name for the chapter (declared as ours to the gate);
# `title` is filled from the file's own NAME, verbatim. A `dir` entry claims every DSL file
# in that subdirectory. Order is the book's own.
BOOKS = [
    {"id": "base", "label": "Types and vocabulary", "kind": "base", "files": [P + "base.ttrpg"]},
    {"id": "introduction", "label": "Introduction", "kind": "chapter", "files": [P + "introduction.ttrpg"]},
    {"id": "characters", "label": "Character Creation", "kind": "chapter", "files": [P + "character-creation.ttrpg"]},
    {"id": "rules", "label": "The Rules", "kind": "chapter", "files": [P + "rules.ttrpg"]},
    {"id": "skills", "label": "Advanced Skills", "kind": "chapter", "files": [P + "advanced-skills.ttrpg"]},
    {"id": "items", "label": "Items", "kind": "chapter", "files": [P + "items.ttrpg"]},
    {"id": "spells", "label": "Spells", "kind": "chapter", "files": [P + "spells.ttrpg"]},
    {"id": "enemies", "label": "Enemies", "kind": "bestiary", "files": [P + "enemies.ttrpg"], "dir": "enemies"},
    {"id": "tables", "label": "Tables", "kind": "tables", "files": [P + "tables.ttrpg"]},
    {"id": "adventure", "label": "The Blancmange & Thistle", "kind": "adventure",
     "files": [P + "blancmange-and-thistle.arc"]},
    {"id": "sheet", "label": "Character Sheet", "kind": "chapter", "files": [P + "character-sheet.ttrpg"]},
]
KINDS = {b["kind"] for b in BOOKS}
DSL_EXTS = (".ttrpg", ".arc", ".actor")


# ───────────────────────── AST accessors ─────────────────────────

def kws(body, name):
    return [x for x in (body or []) if x.get("n") == "kw" and x["kw"] == name]


def kw1(body, name):
    got = kws(body, name)
    return got[0] if got else None


def kwstr(body, name):
    n = kw1(body, name)
    if not n:
        return None
    return next((a["v"] for a in n["args"] if a["k"] == "str"), None)


def kwstrs(body, name):
    out = []
    for n in kws(body, name):
        s = next((a["v"] for a in n["args"] if a["k"] == "str"), None)
        if s is not None:
            out.append(s)
    return out


def kwlist(body, name):
    n = kw1(body, name)
    return (arg(n, "list") or []) if n else []


def arg(node, kind):
    return next((a["v"] for a in (node or {}).get("args", []) if a["k"] == kind), None)


def elem_ref(e):
    if e.get("k") == "ref":
        return {"hash": e["hash"], "name": e["v"]}
    if e.get("k") == "hash":
        return {"hash": e["v"], "name": None}
    if e.get("k") == "caret":
        return {"hash": None, "name": e["v"]}
    return None


def prop_nodes(body):
    """A DEF's properties: the PROPERTIES block's rows, plus any row written directly in
    the body (a table's ^"Note" sits beside its TABLE with no PROPERTIES around it)."""
    out = [p for p in (body or []) if p.get("n") == "prop" and p.get("type") != "CHOICE"]
    for b in kws(body, "PROPERTIES"):
        out.extend(p for p in (b.get("body") or []) if p.get("n") == "prop")
    return out


def elem_value(e):
    if e.get("k") == "def":
        return {"vk": "def", "fields": [prop_value(p) for p in prop_nodes(e.get("body"))]}
    if e.get("k") in ("ref", "hash", "caret"):
        return dict(vk="ref", **elem_ref(e))
    return {"vk": "scalar", "value": e["v"]}


def prop_value(p):
    v = {"name": p["name"]}
    t = p.get("type")
    if t == "DEF":
        v["vk"] = "def"
        ext = kw1(p.get("body"), "EXTENDS")
        if ext:
            v["type"] = arg(ext, "caret")
            v["typeHash"] = arg(ext, "hash")
        v["fields"] = [prop_value(x) for x in prop_nodes(p.get("body"))]
        return v
    if t == "LIST":
        v["vk"] = "list"
        if p.get("of"):
            v["of"] = p["of"]
        if p.get("of_hash"):
            v["ofHash"] = p["of_hash"]
        v["items"] = [elem_value(e) for e in p.get("items", [])]
        return v
    if t == "ENUM":
        # a declaration lists its options; an instance names one
        v["vk"] = "enum"
        if "options" in p:
            v["options"] = p["options"]
        if "value" in p:
            v["value"] = p["value"]
        return v
    if t == "REF":
        v["vk"] = "ref"
        v["ref"] = {"hash": p.get("hash"), "name": p.get("ref")}
        return v
    v["vk"] = "scalar"
    if t and t != "VALUE":
        v["type"] = t
    if "value" in p:
        v["value"] = p["value"]
    for m in ("min", "max", "required", "fixed"):
        if m in p:
            v[m] = p[m]
    return v


def flat(pv):
    if pv.get("vk") in ("scalar", "enum"):
        return pv.get("value")
    if pv.get("vk") == "ref":
        return (pv.get("ref") or {}).get("name")
    return None


# ───────────────────────── entity blocks ─────────────────────────

def refs_of(body):
    """§5c REFERENCES: `"label" -> #hash ^"Name"` lines, stand-off."""
    out = []
    for rb in kws(body, "REFERENCES"):
        for item in (rb.get("body") or []):
            if item.get("n") != "str":
                continue
            for a in item.get("args", []):
                if a["k"] == "ref":
                    out.append({"label": item["v"], "hash": a["hash"], "name": a["v"]})
    return out


def guidance_of(body):
    """§22 GUIDANCE: prose about a rule, beside what it CONCERNS."""
    out = []
    for gb in kws(body, "GUIDANCE"):
        for e in kws(gb.get("body"), "ENTRY"):
            out.append({
                "name": arg(e, "caret"), "id": arg(e, "hash"),
                "concerns": [r for r in (elem_ref(x) for x in kwlist(e.get("body"), "CONCERNS")) if r],
                "text": kwstr(e.get("body"), "TEXT"),
            })
    return out


def choices_of(body):
    out = []
    for cb in kws(body, "CHOICES"):
        for p in (cb.get("body") or []):
            if p.get("n") == "prop" and p.get("type") == "CHOICE":
                out.append({"name": p["name"], "pick": p.get("pick"),
                            "items": [r for r in (elem_ref(e) for e in p.get("items", [])) if r]})
            elif p.get("n") == "str":
                out.append({"rubric": p["v"]})
    return out


def defs_block(body, keyword):
    """ENTRIES rows, in printed order: an unhashed `^"label" DEF { … }` row (the 22 weapons
    under the three Damage tables) is carried as a def value; a hashed row is an entity of
    its own (collected by collect_entities) and is carried here by id."""
    out = []
    for b in kws(body, keyword):
        for p in (b.get("body") or []):
            if p.get("n") == "prop" and p.get("type") == "DEF":
                out.append(prop_value(p))
            elif p.get("n") == "entity":
                out.append({"vk": "entity", "id": p["hash"], "name": p["name"]})
    return out


def table_of(body):
    """A printed table, cell for cell: COLUMNS then ROWs."""
    tb = kw1(body, "TABLE")
    if not tb:
        return None
    columns = [x["v"] for x in kwlist(tb.get("body"), "COLUMNS")]
    rows = [[x["v"] for x in (arg(r, "list") or [])] for r in kws(tb.get("body"), "ROW")]
    return {"columns": columns, "rows": rows}


def entity_record(e, doc, book, parent_id=None, slot=None):
    body = e["body"]
    props = [prop_value(p) for p in prop_nodes(body)]
    pm = {p["name"]: p for p in props}
    ext = kw1(body, "EXTENDS")
    display = flat(pm["Name"]) if "Name" in pm else None
    return {
        "id": e["hash"],
        "name": display or e["name"],
        "key": e["name"],
        "form": e.get("kind") or "DEF",
        "book": book,
        "file": doc["file"],
        "type": arg(ext, "caret") if ext else None,
        "typeHash": arg(ext, "hash") if ext else None,
        "parent": parent_id,
        "slot": slot,                      # the keyword block it was nested in (ENTRIES…)
        "children": [],
        "desc": kwstr(body, "DESCRIPTION"),
        "props": props,
        "entries": defs_block(body, "ENTRIES"),
        "table": table_of(body),
        "choices": choices_of(body),
        "guidance": guidance_of(body),
        "refs": refs_of(body),
    }


def collect_entities(doc, book, out, body=None, parent=None, slot=None):
    """Every hashed entity anywhere in the tree — nested directly (a rule under its
    section) or inside a keyword block — keyed by hash, with `parent` the nearest enclosing
    entity and `slot` the block it sat in."""
    ids = []
    for e in (body if body is not None else doc["body"]):
        if e.get("n") == "entity":
            rec = entity_record(e, doc, book, parent["id"] if parent else None, slot)
            if rec["id"] in out:
                raise SystemExit("duplicate entity hash %s (%s and %s)" % (rec["id"], out[rec["id"]]["file"], doc["file"]))
            out[rec["id"]] = rec
            ids.append(rec["id"])
            if parent:
                parent["children"].append(rec["id"])
            collect_entities(doc, book, out, e["body"], rec, None)
        elif e.get("n") == "kw" and e.get("body"):
            ids.extend(collect_entities(doc, book, out, e["body"], parent, e["kw"]))
    return ids


# ───────────────────────── arcs ─────────────────────────

def build_scene(s):
    body = s.get("body") or []
    return {
        "id": arg(s, "hash"), "name": arg(s, "caret"),
        "type": kwstr(body, "TYPE"),
        "desc": kwstr(body, "DESCRIPTION"),
        "table": table_of(body),           # a table the book prints inside the scene
        "guidance": guidance_of(body),
        "refs": refs_of(body),
    }


def build_arc(doc):
    """An .arc: its FLOW of PHASEs over SCENE_REFs, and the SCENEs themselves."""
    body = doc["body"]
    phases = []
    for fl in kws(body, "FLOW"):
        for p in kws(fl.get("body"), "PHASE"):
            phases.append({"name": arg(p, "caret"),
                           "scenes": [arg(n, "hash") for n in kws(p.get("body"), "SCENE_REF")]})
    return {
        "id": doc["name"], "file": doc["file"],
        "name": kwstr(body, "NAME"),
        "dependsOn": kwstrs(body, "DEPENDS_ON"),
        "desc": kwstr(body, "DESCRIPTION"),
        "phases": phases,
        "scenes": [build_scene(s) for s in kws(body, "SCENE")],
    }


# ───────────────────────── emit ─────────────────────────

BANNER = ("/* Generated by build/build_data.py from %s — do not edit by hand.\n"
          "   Every string is verbatim from the DSL corpus; regenerate rather than patch. */\n")

REGISTER = """(function(){var d=%s;var T=window.TROIKA=window.TROIKA||{books:{},entities:{},loaded:{}};
T.loaded[d.src]=true;T.books[d.book.id]=d.book;
for(var h in d.entities){T.entities[h]=d.entities[h];}})();
"""


def corpus_files(corpus):
    out = set()
    for root, _dirs, files in os.walk(corpus):
        for fn in files:
            if fn.endswith(DSL_EXTS):
                out.add(os.path.relpath(os.path.join(root, fn), corpus))
    return out


def claimed_files(corpus):
    """file → chapter id; raises if a file is claimed twice, unclaimed, or missing."""
    on_disk = corpus_files(corpus)
    claimed = {}
    for b in BOOKS:
        files = list(b["files"])
        if b.get("dir"):
            files += sorted(f for f in on_disk if f.startswith(b["dir"] + os.sep))
        b["_files"] = files
        for fn in files:
            if fn in claimed:
                raise SystemExit("build_data: %s is claimed by both %s and %s" % (fn, claimed[fn], b["id"]))
            claimed[fn] = b["id"]
    missing = sorted(on_disk - set(claimed))
    stale = sorted(set(claimed) - on_disk)
    if missing or stale:
        raise SystemExit("build_data: the file → chapter map is out of step with the corpus.\n"
                         "  in the corpus, claimed by no chapter: %s\n"
                         "  claimed but not in the corpus: %s" % (missing or "none", stale or "none"))
    return on_disk


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    data_dir = os.path.join(HERE, "data")
    os.makedirs(data_dir, exist_ok=True)
    on_disk = claimed_files(corpus)

    for fn in sorted(os.listdir(data_dir)):
        if fn.endswith(".js"):
            os.remove(os.path.join(data_dir, fn))

    entities = {}
    index_books = []
    total = 0
    for b in BOOKS:
        docs = parse_files([os.path.join(corpus, f) for f in b["_files"]])
        roots, files, arcs = [], [], []
        for doc in docs:
            roots.extend(collect_entities(doc, b["id"], entities))
            files.append({"file": doc["file"], "container": doc["container"], "name": kwstr(doc["body"], "NAME")})
            if doc["ext"] == "arc":
                arcs.append(build_arc(doc))
        # the chapter's own title is its file's NAME (the .actor files have none)
        title = next((f["name"] for f in files if f["name"]), None) or b["label"]
        rec = {"id": b["id"], "title": title, "label": b["label"], "kind": b["kind"],
               "files": files, "entities": roots, "arcs": arcs}
        payload = {"src": "data/%s.js" % b["id"], "book": rec,
                   "entities": {h: e for h, e in entities.items() if e["book"] == b["id"]}}
        with open(os.path.join(data_dir, "%s.js" % b["id"]), "w", encoding="utf-8") as fh:
            fh.write(BANNER % corpus)
            fh.write(REGISTER % json.dumps(payload, ensure_ascii=False, sort_keys=True))
        n = len(payload["entities"])
        total += n
        index_books.append({"id": b["id"], "title": title, "label": b["label"], "kind": b["kind"],
                            "files": {"main": ["data/%s.js" % b["id"]]},
                            "counts": {"entities": n, "scenes": sum(len(a["scenes"]) for a in arcs)}})

    index = {"system": "troika", "corpus": corpus, "books": index_books,
             "counts": {"books": len(index_books), "entities": total, "files": len(on_disk)}}
    with open(os.path.join(data_dir, "index.js"), "w", encoding="utf-8") as fh:
        fh.write(BANNER % corpus)
        fh.write("(function(){var T=window.TROIKA=window.TROIKA||{books:{},entities:{},loaded:{}};"
                 "T.index=%s;})();\n" % json.dumps(index, ensure_ascii=False, sort_keys=True))

    print("build_data: %d corpus files → %d chapters, %d entities" % (len(on_disk), len(index_books), total))
    for x in index_books:
        print("  %-13s %-26s %5d entities%s" % (x["id"], x["label"], x["counts"]["entities"],
                                                 "  · %d scenes" % x["counts"]["scenes"] if x["counts"]["scenes"] else ""))


if __name__ == "__main__":
    main()
