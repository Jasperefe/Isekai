# QA scripts (Playwright, Python)

Automated runs of `docs/TEST_CHECKLIST.md`. Results print as PASS/FAIL and land in `qa_out/`.

    pip install playwright && playwright install chromium
    python3 -m http.server 8766          # from the repo root, in another terminal
    python3 tools/qa/qa_ui.py            # title, HUD, menu, Console, combat, save/load
    python3 tools/qa/qa_side.py          # side quests, shop, forge, secrets, true ending, New Game+
    python3 tools/qa/qa_z1.py [victory]  # story bot, one zone per script (qa_z2/qa_z3/qa_z4 likewise)
    python3 tools/qa/qa_z4.py jasper finish | victory two
    QA_BASE=http://localhost:8780 python3 tools/qa/pg.py   # Playgama checks; serve dist/playgama on 8780

Note: dynamic imports in the scripts use `?v=N`; keep N equal to the current build stamp (see index.html), or the test talks to a second copy of the module.
