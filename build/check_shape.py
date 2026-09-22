#!/usr/bin/env python3
"""
check_shape.py — the gate verify_data.py cannot be.

verify_data proves every string round-trips. It does NOT prove a string landed on the
right field: a value that parses loose in a body is present in the data and attached to
nothing, and every string still round-trips. So this asserts the SHAPES the site reads,
against counts taken from the corpus itself (grep over the source files, never a number
typed here). Deliberately specific: if a parser or build change displaces a field, this
says which.

    python3 build/check_shape.py [<path to titterpig-dsl-troika/0.5>]
"""
import glob
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import DEFAULT_CORPUS, P  # noqa: E402
from verify_data import BLOB, INDEX_BLOB, HERE  # noqa: E402

FAILS = []


def check(label, got, want):
    ok = got == want
    print("  %-62s %s%s" % (label, got, "" if ok else "   EXPECTED %s  ← FAIL" % (want,)))
    if not ok:
        FAILS.append(label)


def load():
    ents, books, index = {}, {}, None
    for fn in sorted(os.listdir(os.path.join(HERE, "data"))):
        if not fn.endswith(".js"):
            continue
        src = open(os.path.join(HERE, "data", fn), encoding="utf-8").read()
        m = BLOB.search(src)
        if m:
            d = json.loads(m.group(1))
            ents.update(d["entities"])
            books[d["book"]["id"]] = d["book"]
        else:
            index = json.loads(INDEX_BLOB.search(src).group(1))
    return ents, books, index


def grep_count(corpus, pattern, files):
    """How many times the corpus itself writes something — the source's own count."""
    paths = []
    for f in (files if isinstance(files, list) else [files]):
        paths.extend(sorted(glob.glob(os.path.join(corpus, f))))
    out = subprocess.run(["grep", "-c", pattern] + paths, capture_output=True, text=True)
    return sum(int(line.rsplit(":", 1)[-1] or 0) for line in out.stdout.strip().split("\n") if line) if len(paths) > 1 \
        else int(out.stdout.strip() or 0)


def prop(e, name):
    return next((p for p in e["props"] if p["name"] == name), None)


def val(e, name):
    p = prop(e, name)
    return None if p is None else p.get("value")


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    ents, books, index = load()
    by_type = {}
    for e in ents.values():
        by_type.setdefault(e["type"], []).append(e)
    ALL = ["*.ttrpg", "*.arc", "enemies/*.actor"]

    print("check_shape: the fields the site reads, against the corpus's own counts")

    # ── every typed entity the corpus declares reaches the data with its type ──
    for type_name in ["Rule", "Spell", "Background", "Advanced Skill", "Item", "Table", "Enemy"]:
        want = grep_count(corpus, '^\\s*EXTENDS #[A-Za-z0-9]* \\^"%s"$' % re.escape(type_name), ALL)
        check("%s entities" % type_name, len(by_type.get(type_name, [])), want)

    # ── the weapons are hashless ENTRIES rows under the three Damage tables ──
    weapons = [r for t in by_type.get("Table", []) for r in t["entries"] if r.get("type") == "Weapon"]
    check("Weapon rows carried as table entries", len(weapons),
          grep_count(corpus, '^\\s*EXTENDS #[A-Za-z0-9]* \\^"Weapon"$', P + "tables.ttrpg"))
    check("every weapon row has its seven damage values",
          len([w for w in weapons if len(next((f for f in w["fields"] if f["name"] == "Damage"), {}).get("items", [])) == 7]), len(weapons))

    # ── the tables are read cell for cell ──
    tables = by_type.get("Table", [])
    # a Background prints a Mien table of its own, so the TABLE blocks are not all in tables.ttrpg
    check("tables with a TABLE block", len([t for t in tables if t["table"]]),
          grep_count(corpus, '^\\s*TABLE {', ALL))
    check("table rows", sum(len(t["table"]["rows"]) for t in tables if t["table"]),
          grep_count(corpus, '^\\s*ROW \\[', ALL))
    check("every row as wide as its columns",
          len([t for t in tables if t["table"] and all(len(r) == len(t["table"]["columns"]) for r in t["table"]["rows"])]),
          len([t for t in tables if t["table"]]))

    # ── a rule carries its number, and nests under the rule its number extends ──
    rules = by_type.get("Rule", [])
    check("rules with a Number", len([e for e in rules if val(e, "Number")]),
          grep_count(corpus, '^\\s*\\^"Number" STRING "', ALL))
    check("rules with a Title", len([e for e in rules if val(e, "Title")]),
          grep_count(corpus, '^\\s*\\^"Title" STRING "', ALL))
    # three section headings (Stamina, Initiative, Other Concerns) print no text of their own;
    # the count is the files' DESCRIPTION lines less the ones on non-rule entities
    rule_files = [P + "rules.ttrpg", P + "enemies.ttrpg"]
    others = [e for e in ents.values() if e["file"] in [os.path.basename(f) for f in rule_files] and e["type"] != "Rule" and e["desc"]]
    check("rules with text", len([e for e in rules if e["desc"]]),
          grep_count(corpus, '^\\s*DESCRIPTION "', rule_files) - len(others))
    nested = [e for e in rules if "." in (val(e, "Number") or "")]
    ok = [e for e in nested if e["parent"] in ents and ents[e["parent"]]["type"] == "Rule"
          and val(e, "Number").startswith(val(ents[e["parent"]], "Number") + ".")]
    check("dotted rules nest under the rule their number extends", len(ok), len(nested))
    top = [e for e in ents.values() if e["parent"] is None and e["file"] in [os.path.basename(f) for f in rule_files]]
    check("top-level entities in The Rules and Enemies", len(top),
          grep_count(corpus, '^    #[A-Za-z0-9]* \\^"[^"]*" DEF {', rule_files))

    # ── a spell has its cost, a background its d66 roll and ranked skills ──
    spells = by_type.get("Spell", [])
    check("spells with a Cost", len([e for e in spells if val(e, "Cost")]),
          grep_count(corpus, '^\\s*\\^"Cost" STRING "', P + "spells.ttrpg"))
    check("spells with a Description", len([e for e in spells if val(e, "Description")]), len(spells))
    bgs = by_type.get("Background", [])
    check("backgrounds with a distinct d66 roll", len({val(e, "Roll") for e in bgs}), len(bgs))
    ranks = sum(len(prop(e, "Advanced Skills")["items"]) for e in bgs if prop(e, "Advanced Skills"))
    check("background skill ranks", ranks, grep_count(corpus, '\\^"Rank" INTEGER', P + "character-creation.ttrpg"))
    check("every rank row names its skill and rank",
          sum(1 for e in bgs if prop(e, "Advanced Skills")
              for it in prop(e, "Advanced Skills")["items"]
              if it["vk"] == "def" and {f["name"] for f in it["fields"]} >= {"Rank", "Skill"}), ranks)
    check("backgrounds with Possessions", len([e for e in bgs if prop(e, "Possessions")]),
          grep_count(corpus, '^\\s*\\^"Possessions" LIST', P + "character-creation.ttrpg"))

    # ── the bestiary: every enemy an ACTOR in its own file, with its six-line mien ──
    enemies = by_type.get("Enemy", [])
    check("enemies in the enemies chapter", len([e for e in enemies if e["book"] == "enemies"]), len(enemies))
    check("enemies from their own .actor file", len({e["file"] for e in enemies}), len(enemies))
    mien = sum(len(prop(e, "Mien")["items"]) for e in enemies if prop(e, "Mien"))
    check("mien lines", mien, grep_count(corpus, '\\^"Mien" STRING', "enemies/*.actor"))
    check("every mien line has its roll",
          sum(1 for e in enemies if prop(e, "Mien") for it in prop(e, "Mien")["items"]
              if it["vk"] == "def" and any(f["name"] == "Roll" and f.get("value") is not None for f in it["fields"])), mien)
    for stat in ["Skill", "Stamina", "Initiative", "Armour"]:
        check("enemies with %s" % stat, len([e for e in enemies if val(e, stat) is not None]),
              grep_count(corpus, '^\\s*\\^"%s" INTEGER' % stat, "enemies/*.actor"))
    check("the ACTOR type declared in the BASE", len([e for e in ents.values() if e["form"] == "ACTOR" and e["book"] == "base"]),
          grep_count(corpus, '^\\s*#[A-Za-z0-9]* ACTOR "', P + "base.ttrpg"))

    # ── the adventure: two phases over its scenes, every reference resolved ──
    arcs = books["adventure"]["arcs"]
    check("arcs in the adventure chapter", len(arcs), 1)
    a = arcs[0] if arcs else {"phases": [], "scenes": []}
    check("phases", len(a["phases"]), grep_count(corpus, '^\\s*PHASE ', P + "blancmange-and-thistle.arc"))
    check("scenes", len(a["scenes"]), grep_count(corpus, '^\\s*SCENE #', P + "blancmange-and-thistle.arc"))
    refs = [s for p in a["phases"] for s in p["scenes"]]
    check("scene references", len(refs), grep_count(corpus, '^\\s*SCENE_REF ', P + "blancmange-and-thistle.arc"))
    ids = {s["id"] for s in a["scenes"]}
    check("every reference names a scene", len([r for r in refs if r in ids]), len(refs))
    check("every scene with text", len([s for s in a["scenes"] if s["desc"]]), len(a["scenes"]))

    # ── the printed sheet's labels, in printed order ──
    sheet = next((e for e in ents.values() if e["key"] == "Character Sheet"), None)
    check("the Character Sheet entity is in the data", bool(sheet), True)
    if sheet:
        check("its printed labels", len(sheet["children"]),
              grep_count(corpus, '^        #[A-Za-z0-9]* \\^"[^"]*" DEF {', P + "character-sheet.ttrpg"))

    # ── the index ──
    check("chapters in the index", len(index["books"]), len(books))
    check("corpus files counted", index["counts"]["files"],
          sum(grep_count(corpus, "", f) >= 0 and len(glob.glob(os.path.join(corpus, f))) for f in ALL))

    print("check_shape: %s" % ("OK (%d assertions)" % (len(FAILS) and 0 or count_all()) if not FAILS else "%d FAILED" % len(FAILS)))
    return 1 if FAILS else 0


_count = [0]
_check = check


def check(label, got, want):  # noqa: F811 — count the assertions for the summary line
    _count[0] += 1
    return _check(label, got, want)


def count_all():
    return _count[0]


if __name__ == "__main__":
    sys.exit(main())
