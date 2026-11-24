#!/usr/bin/env python3
"""Print the transitive `include` closure of liblouis tables, one file per line.

usage: table-closure.py TABLES_DIR TABLE [TABLE ...]
"""
import os
import re
import sys

INCLUDE = re.compile(r"^\s*include\s+(\S+)")


def closure(tables_dir: str, roots: list[str]) -> list[str]:
    seen: list[str] = []
    todo = list(roots)
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        path = os.path.join(tables_dir, name)
        if not os.path.isfile(path):
            sys.exit(f"missing table: {name}")
        seen.append(name)
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                m = INCLUDE.match(line)
                if m:
                    todo.append(m.group(1))
    return sorted(seen)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    for name in closure(sys.argv[1], sys.argv[2:]):
        print(name)
