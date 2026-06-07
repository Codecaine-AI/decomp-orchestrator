# Recover Matches Verify/Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `melee-agent audit recover-matches` so it can trial-apply stranded `match:` commits, re-verify them with checkdiff, and optionally leave verified source changes applied.

**Architecture:** Keep the existing read-only candidate enumeration. Add source snapshot/restore helpers in `tools/melee-agent/src/cli/audit.py`, read the candidate commit's current source file with `git show <commit>:<path>`, transfer only the named function body into the live source file, run `tools/checkdiff.py <function> --format json --no-fingerprint`, and return per-candidate verification rows. `--apply` permanently leaves only the verified function-body replacement for the first verified commit per function after a clean-worktree check.

**Tech Stack:** Python 3.11, Typer, pytest, git CLI, existing `extract_unmatched_functions`, `tools/checkdiff.py`.

---

### Task 1: Verification Mode

**Files:**
- Modify: `tools/melee-agent/src/cli/audit.py`
- Modify: `tools/melee-agent/tests/test_audit_recover_matches.py`

- [ ] **Step 1: Write failing `--verify` test**

Extend the fixture repo in `test_audit_recover_matches.py` with a tiny `tools/checkdiff.py` script that reads the source and emits JSON. It exits `1` for non-matches to mirror real checkdiff behavior:

```python
def _write_fake_checkdiff(repo: Path) -> None:
    tools = repo / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    (tools / "checkdiff.py").write_text(
        "\n".join(
            [
                "import json",
                "import pathlib",
                "import sys",
                "fn = sys.argv[1]",
                "text = pathlib.Path('src/melee/test.c').read_text()",
                "matched = f'void {fn}(void)' in text",
                "assert '--no-fingerprint' in sys.argv",
                "print(json.dumps({'function': fn, 'match': matched, 'fuzzy_match_percent': 100.0 if matched else 72.5}))",
                "raise SystemExit(0 if matched else 1)",
                "",
            ]
        ),
        encoding="utf-8",
    )
```

Add a fixture branch commit that changes `INCLUDE_ASM(..., ftCo_80093790);` to `void ftCo_80093790(void) {}`. The helper should commit the real source edit after the existing read-only allow-empty commits so the original grouping test still sees the same functions. Then add:

```python
def test_audit_recover_matches_verify_reapplies_and_restores_candidate(
    tmp_path: Path,
) -> None:
    repo = _init_recover_fixture_repo(tmp_path)
    _write_fake_checkdiff(repo)
    source = repo / "src" / "melee" / "test.c"
    before = source.read_text(encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "audit",
            "recover-matches",
            "--melee-root",
            str(repo),
            "--upstream",
            "upstream-master",
            "--verify",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    verified = [
        row for row in payload["verification"]
        if row["function"] == "ftCo_80093790"
    ]
    assert verified[0]["status"] == "verified"
    assert verified[0]["match"] is True
    assert verified[0]["match_percent"] == 100.0
    assert source.read_text(encoding="utf-8") == before
    assert _git(repo, "status", "--porcelain") == ""
```

Also add a dirty-but-unrelated verify preservation test:

```python
def test_audit_recover_matches_verify_preserves_unrelated_dirty_work(
    tmp_path: Path,
) -> None:
    repo = _init_recover_fixture_repo(tmp_path)
    _write_fake_checkdiff(repo)
    extra = repo / "README.md"
    extra.write_text("local note\n", encoding="utf-8")
    before_status = _git(repo, "status", "--porcelain")

    result = runner.invoke(
        app,
        [
            "audit",
            "recover-matches",
            "--melee-root",
            str(repo),
            "--upstream",
            "upstream-master",
            "--verify",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    assert _git(repo, "status", "--porcelain") == before_status
    assert extra.read_text(encoding="utf-8") == "local note\n"
```

- [ ] **Step 2: Run test and verify RED**

Also add a test where the fake checkdiff sees no recovered body and exits 1 with JSON `match=false`; expect a `not_match` row rather than `checkdiff_failed`.

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py::test_audit_recover_matches_verify_reapplies_and_restores_candidate -q --no-cov
```

Expected: Typer rejects `--verify` or output lacks `verification`.

- [ ] **Step 3: Implement verification helpers**

In `audit.py`, add helpers for source path selection, candidate source retrieval,
function extraction/replacement, snapshots, restore, and checkdiff JSON. Trial
verification must restore the touched source file in a `finally` block and
assert tracked status matches the pre-trial baseline.

Use command shapes:

```python
["git", "show", f"{commit}:{source_path}"]
["python", "tools/checkdiff.py", function, "--format", "json", "--no-fingerprint"]
```

Use `src.mwcc_debug.source_patch.extract_function` to extract the named function
from the candidate source. Use `replace_function` when the current file already
has a real definition. If not, replace exactly one `INCLUDE_ASM...` statement
whose function argument is the target function.

- [ ] **Step 4: Add `--verify` CLI wiring**

Add `verify: bool = typer.Option(False, "--verify")` and
`checkdiff_timeout: float = typer.Option(120.0, "--checkdiff-timeout")`.
When true, verify candidates in grouped order. After the first verified commit
for a function, mark later commits for that function as
`skipped_after_verified`.

If the commit has no source file at the current path or the source file does not
contain the named function body, report `apply_failed` with reason
`no_candidate_function`.

If checkdiff exits nonzero but stdout parses as JSON with `match=false`, report
`not_match`.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py -q --no-cov
```

Expected: all recover-match tests pass.

### Task 2: Apply Mode And Safety

**Files:**
- Modify: `tools/melee-agent/src/cli/audit.py`
- Modify: `tools/melee-agent/tests/test_audit_recover_matches.py`

- [ ] **Step 1: Write failing apply and dirty-worktree tests**

Add:

```python
def test_audit_recover_matches_apply_leaves_verified_candidate_applied(
    tmp_path: Path,
) -> None:
    repo = _init_recover_fixture_repo(tmp_path)
    _write_fake_checkdiff(repo)
    source = repo / "src" / "melee" / "test.c"

    result = runner.invoke(
        app,
        [
            "audit",
            "recover-matches",
            "--melee-root",
            str(repo),
            "--upstream",
            "upstream-master",
            "--apply",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    applied = [
        row for row in payload["verification"]
        if row["function"] == "ftCo_80093790"
    ][0]
    assert applied["status"] == "applied"
    assert "void ftCo_80093790(void)" in source.read_text(encoding="utf-8")


def test_audit_recover_matches_apply_rejects_dirty_tracked_worktree(
    tmp_path: Path,
) -> None:
    repo = _init_recover_fixture_repo(tmp_path)
    _write_fake_checkdiff(repo)
    (repo / "src" / "melee" / "test.c").write_text("dirty\\n", encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "audit",
            "recover-matches",
            "--melee-root",
            str(repo),
            "--upstream",
            "upstream-master",
            "--apply",
            "--json",
        ],
    )

    assert result.exit_code == 2
    assert "tracked worktree has local changes" in result.output
```

- [ ] **Step 2: Run tests and verify RED**

Run both new tests. Expected: `--apply` is not implemented.

- [ ] **Step 3: Implement apply mode**

Add `apply: bool = typer.Option(False, "--apply")`; `--apply` implies verify.
Before applying, run `git status --porcelain --untracked-files=no` and raise a
clean Typer exit if any tracked files are dirty.

For each function, first trial-verify candidates with restore. On the first
verified candidate, transfer that commit's named function body permanently, run
checkdiff again with `--no-fingerprint`, and only leave it applied when the
second checkdiff reports `match=true`. If the permanent check fails or the
function body cannot be transferred, restore the source snapshot and report a
failure status.

After failed verify/apply attempts, compare tracked status to the pre-trial
baseline:

```python
before_status = _git(repo, "status", "--porcelain")
# run failed trial
assert _git(repo, "status", "--porcelain") == before_status
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py -q --no-cov
python -m compileall src/cli/audit.py
```

Expected: tests pass and compileall succeeds.

### Task 3: Smokes And Commit

**Files:**
- Commit: `tools/melee-agent/src/cli/audit.py`
- Commit: `tools/melee-agent/tests/test_audit_recover_matches.py`
- Commit: `docs/superpowers/specs/2026-06-05-recover-matches-verify-apply-design.md`
- Commit: `docs/superpowers/plans/2026-06-05-recover-matches-verify-apply.md`

- [ ] **Step 1: Run command-level smokes**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m src.cli audit recover-matches --help | rg -- '--verify|--apply|--checkdiff-timeout'
python -m src.cli audit recover-matches --json --limit 1 | python -m json.tool >/dev/null
python -m src.cli audit recover-matches --verify --json --limit 0 | python -m json.tool >/dev/null
```

- [ ] **Step 2: Review diff**

Run:

```bash
cd /Users/mike/code/melee
git diff --check
git diff -- tools/melee-agent/src/cli/audit.py tools/melee-agent/tests/test_audit_recover_matches.py docs/superpowers/specs/2026-06-05-recover-matches-verify-apply-design.md docs/superpowers/plans/2026-06-05-recover-matches-verify-apply.md
```

- [ ] **Step 3: Commit**

Run:

```bash
cd /Users/mike/code/melee
git add tools/melee-agent/src/cli/audit.py tools/melee-agent/tests/test_audit_recover_matches.py docs/superpowers/specs/2026-06-05-recover-matches-verify-apply-design.md docs/superpowers/plans/2026-06-05-recover-matches-verify-apply.md
git commit -m "Recover and verify stranded match commits"
```
