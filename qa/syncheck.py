#!/usr/bin/env python3
"""
Syntax-check the main application script inside web/index.html.

Why this exists rather than `node --check web/index.html`: the file is HTML, and
the app lives in one large inline <script>. Naive extraction picks the wrong
block -- an early attempt matched a `<script>` string *inside a template
literal* and checked the wrong code. This anchors on the `SHARED FEE DATA`
marker and walks back to the <script> that opens the real application block.

    cd web && python3 ../qa/syncheck.py      # or: python3 qa/syncheck.py web/index.html

IMPORTANT: passing this is necessary and NOT sufficient. A top-level `const`
that references a constant declared later in the file is valid syntax and a
dead application -- the temporal dead zone throws at load and every tool
renders blank (BUG-051). After touching any top-level declaration, load a page
in a real browser too.
"""
import os
import subprocess
import sys
import tempfile

path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
if not os.path.exists(path) and os.path.exists(os.path.join("web", "index.html")):
    path = os.path.join("web", "index.html")

src = open(path, encoding="utf-8").read()
marker = src.index("SHARED FEE DATA")          # inside the application block
start = src.rindex("<script>", 0, marker)      # the <script> that opens it
end = src.rindex("</script>")
body = src[start + len("<script>"):end]

tmp = tempfile.mktemp(suffix=".js")
open(tmp, "w", encoding="utf-8").write(body)
res = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)

if res.returncode:
    print(res.stderr[:1500])
else:
    print("SYNTAX OK (%d lines)" % body.count("\n"))
sys.exit(res.returncode)
