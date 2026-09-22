#!/usr/bin/env python3
"""
verify_data.py — the content gate, in both directions:

  1. COVERAGE — every string the corpus prints (every STR and every caret name in every
     DSL file, in every subdirectory) reaches data/*.js, except the container-header
     metadata listed in SKIP_KEYWORDS, each with its reason.
  2. FIDELITY — every string in data/*.js came from the corpus. A coverage check alone
     lets invented or mangled text through; a fidelity check alone lets a dropped table
     through. Neither finds what the other does.

Skips are by KEY name only, never by value, and each skipped key says why.

Exit 0 = both clean. Never weaken this to make a build pass: fix the build.

    python3 build/verify_data.py [<path to titterpig-dsl-troika/0.5>]
"""
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_dsl import tokenize, unescape, lift_rule_lines  # noqa: E402
from build_data import BOOKS, DEFAULT_CORPUS, KINDS, corpus_files  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_KEYWORDS = {
    "VERSION": "DSL content version of the source file",
    "SPEC_VERSION": "Titterpig spec version of the source file",
    "RELEASE_DATE": "conversion date of the source file",
}
# Words the DSL grammar itself uses that survive into the data as field labels, not as text.
TYPE_WORDS = {"STRING", "INTEGER", "BOOLEAN", "FLOAT", "TEXT", "DEF", "TEMPLATE", "ACTOR",
              "LIST", "ENUM", "REF", "CHOICE", "VALUE", "EXTENSION", "BASE", "ARC"}
# Keys whose values this build writes itself. By key, never by value.
BUILD_KEYS = {
    "id": "entity, book and arc ids",
    "hash": "a reference's target id",
    "typeHash": "the id of the type a DEF EXTENDS",
    "ofHash": "the id bound to a LIST OF type",
    "parent": "the enclosing entity's id",
    "children": "ids of nested entities",
    "book": "which chapter this file's data belongs to",
    "file": "the corpus file an entity came from",
    "src": "this data file's own path",
    "vk": "the shape of a property value (scalar/list/ref/def/enum)",
    "slot": "the DSL keyword block an entity was nested in (ENTRIES…)",
    "kind": "the chapter kind this build assigns",
    "container": "the file's container word (BASE / EXTENSION / ARC / none)",
    "system": "the system id from engine/config.js",
    "corpus": "the path the data was generated from",
}
HASH_ID = re.compile(r"^#?[a-zA-Z][A-Za-z0-9_]{15,}$")
BLOB = re.compile(r"var d=(\{.*?\});var T=window\.TROIKA", re.S)
INDEX_BLOB = re.compile(r"T\.index=(\{.*\});\}\)\(\);", re.S)
CONTAINERS = ("BASE", "EXTENSION", "ARC", "FRAME", "SETTING", "CAMPAIGN")


def corpus_strings(corpus):
    """Every string the corpus prints."""
    want, skipped = Counter(), Counter()
    for rel in sorted(corpus_files(corpus)):
        path = os.path.join(corpus, rel)
        toks = tokenize(lift_rule_lines(open(path, encoding="utf-8").read()))
        i = 0
        # the container header: KIND "id" [EXTENDS "parent"] — module identifiers, not text
        if toks and toks[0].kind == "ID" and toks[0].val in CONTAINERS:
            skipped[toks[1].val] += 1
            i = 2
            if len(toks) > 3 and toks[2].kind == "ID" and toks[2].val == "EXTENDS":
                skipped[toks[3].val] += 1
                i = 4
        while i < len(toks):
            t = toks[i]
            if t.kind == "ID" and t.val in SKIP_KEYWORDS:
                j = i + 1
                while j < len(toks) and toks[j].kind in ("STR", "INT"):
                    if toks[j].kind == "STR":
                        skipped[unescape(toks[j].val)] += 1
                    j += 1
                i = j
                continue
            if t.kind == "STR":
                want[unescape(t.val)] += 1
            elif t.kind == "CARET":
                want[t.val] += 1
            i += 1
    return want, skipped


def data_strings():
    """Every string in data/."""
    got = Counter()
    blobs = []
    for fn in sorted(os.listdir(os.path.join(HERE, "data"))):
        if not fn.endswith(".js"):
            continue
        src = open(os.path.join(HERE, "data", fn), encoding="utf-8").read()
        m = BLOB.search(src) or INDEX_BLOB.search(src)
        if not m:
            raise SystemExit("verify_data: %s is not in the expected shape" % fn)
        blobs.append(json.loads(m.group(1)))

    def walk(n):
        if isinstance(n, dict):
            for k, v in n.items():
                if k in BUILD_KEYS and not isinstance(v, (dict, list)):
                    continue
                walk(v)
        elif isinstance(n, list):
            for x in n:
                walk(x)
        elif isinstance(n, str):
            if not HASH_ID.match(n):
                got[n] += 1
    for b in blobs:
        walk(b)
    return blobs, got


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    want, skipped = corpus_strings(corpus)
    blobs, got = data_strings()

    # text this build writes of its own: the chapter labels, the chapter kinds, the data
    # file paths, and the DSL's own type words as field labels.
    ours = set(TYPE_WORDS) | KINDS | {b["label"] for b in BOOKS}
    ours |= {"data/%s.js" % b["id"] for b in BOOKS}

    missing = sorted(k for k in want if k not in got)
    unsourced = sorted(k for k in got if k not in want and k not in ours and k not in skipped)

    print("verify_data: the corpus prints %d distinct DSL strings (%d header values skipped by keyword)"
          % (len(want), len(skipped)))
    for label, rows in (("UNCOVERED — in the corpus, not in data/", missing),
                        ("UNSOURCED — in data/, not in the corpus", unsourced)):
        if rows:
            print("  %s: %d" % (label, len(rows)))
            for s in rows[:25]:
                print("    %r" % s[:130])
    if not (missing or unsourced):
        print("  %d strings — 0 uncovered · 0 unsourced; every string round-trips" % len(want))
    return 1 if (missing or unsourced) else 0


if __name__ == "__main__":
    sys.exit(main())
