# Audit Recover Matches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `melee-agent audit recover-matches` command that surfaces unmatched functions with stranded local `match:` commits.

**Architecture:** Extend `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py` with parser helpers and a Typer command. Use existing git helpers and unmatched extraction, then add focused tests in a new audit test module.

**Tech Stack:** Python 3.11, Typer, pytest, git CLI, existing `src.extractor.extract_unmatched_functions`.

---

### Task 1: Parser And Candidate Grouping

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_audit_recover_matches.py`

- [ ] **Step 1: Write failing parser tests**

Create `/Users/mike/code/melee/tools/melee-agent/tests/test_audit_recover_matches.py`:

```python
"""Regression tests for stranded match recovery audit."""

import json
import subprocess
from pathlib import Path

from typer.testing import CliRunner

from src.cli import app
from src.cli.audit import _parse_lowercase_match_subject

runner = CliRunner()


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def test_parse_lowercase_match_subject_handles_real_agent_subjects() -> None:
    assert _parse_lowercase_match_subject("match: ftCo_8009C744 100%") == [
        "ftCo_8009C744"
    ]
    assert _parse_lowercase_match_subject(
        "match: fn_803ACF30 100%; improve fn_803B26CC"
    ) == ["fn_803ACF30"]
    assert _parse_lowercase_match_subject(
        "match: grIceMt_801F993C (gricemt.c) - 100%"
    ) == ["grIceMt_801F993C"]


def test_parse_lowercase_match_subject_dedupes_and_rejects_common_words() -> None:
    assert _parse_lowercase_match_subject("match: function 100%") == []
    assert _parse_lowercase_match_subject(
        "match: ftCo_80093790 100%; match: ftCo_80093790 100%"
    ) == ["ftCo_80093790"]
```

- [ ] **Step 2: Run parser tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py::test_parse_lowercase_match_subject_handles_real_agent_subjects tests/test_audit_recover_matches.py::test_parse_lowercase_match_subject_dedupes_and_rejects_common_words -q --no-cov
```

Expected: import failure because `_parse_lowercase_match_subject` does not exist.

- [ ] **Step 3: Implement parser helper**

In `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py`, add:

```python
_LOWERCASE_MATCH_SEGMENT_RE = re.compile(
    r"(?:^|[;])\s*match:\s*(?P<function>[A-Za-z_]\w*)",
    re.IGNORECASE,
)


def _parse_lowercase_match_subject(subject: str) -> list[str]:
    """Parse conservative lowercase `match:` commit subjects."""
    functions: list[str] = []
    seen: set[str] = set()
    for match in _LOWERCASE_MATCH_SEGMENT_RE.finditer(subject):
        function_name = match.group("function")
        if function_name in seen or not _is_valid_function_name(function_name):
            continue
        seen.add(function_name)
        functions.append(function_name)
    return functions
```

- [ ] **Step 4: Run parser tests and verify GREEN**

Run the focused parser pytest command from Step 2.

Expected: both tests pass.

### Task 2: Read-Only Audit Command

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_audit_recover_matches.py`

- [ ] **Step 1: Write failing CLI fixture test**

Append this helper and test to `/Users/mike/code/melee/tools/melee-agent/tests/test_audit_recover_matches.py`:

```python
def _write_report(repo: Path, percentages: dict[str, float]) -> None:
    report_path = repo / "build" / "GALE01" / "report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(
            {
                "units": [
                    {
                        "name": "main/melee/test",
                        "metadata": {"source_path": "src/melee/test.c"},
                        "functions": [
                            {"name": name, "fuzzy_match_percent": pct}
                            for name, pct in percentages.items()
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )


def _init_recover_fixture_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "melee"
    (repo / "src" / "melee").mkdir(parents=True)
    _git(tmp_path, "init", str(repo))
    _git(repo, "config", "user.email", "agent@example.invalid")
    _git(repo, "config", "user.name", "Agent")

    source = repo / "src" / "melee" / "test.c"
    source.write_text(
        "\n".join(
            [
                'INCLUDE_ASM("asm/nonmatchings/test", ftCo_80093790);',
                'INCLUDE_ASM("asm/nonmatchings/test", fn_803ACF30);',
                "void alreadyMatched_80000000(void) {}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    _write_report(
        repo,
        {
            "ftCo_80093790": 72.5,
            "fn_803ACF30": 88.0,
            "alreadyMatched_80000000": 100.0,
        },
    )
    _git(repo, "add", ".")
    _git(repo, "commit", "-m", "baseline")
    _git(repo, "branch", "upstream-master")

    _git(repo, "switch", "-c", "agent-a")
    _git(repo, "commit", "--allow-empty", "-m", "match: ftCo_80093790 100%")
    _git(repo, "commit", "--allow-empty", "-m", "match: fn_803ACF30 100%; improve other")
    _git(repo, "commit", "--allow-empty", "-m", "match: alreadyMatched_80000000 100%")

    _git(repo, "switch", "-c", "agent-b", "upstream-master")
    _git(repo, "commit", "--allow-empty", "-m", "match: ftCo_80093790 (file.c) - 100%")
    _git(repo, "switch", "agent-a")
    return repo
```

```python
def test_audit_recover_matches_groups_stranded_candidates_by_unmatched_function(
    tmp_path: Path,
) -> None:
    repo = _init_recover_fixture_repo(tmp_path)

    result = runner.invoke(
        app,
        [
            "audit",
            "recover-matches",
            "--melee-root",
            str(repo),
            "--upstream",
            "upstream-master",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["summary"]["candidate_functions"] == 2
    assert payload["summary"]["candidate_commits"] == 3
    by_function = {row["function"]: row for row in payload["candidates"]}
    assert set(by_function) == {"fn_803ACF30", "ftCo_80093790"}
    assert len(by_function["ftCo_80093790"]["commits"]) == 2
    assert by_function["ftCo_80093790"]["current_match_percent"] == 72.5
    assert by_function["fn_803ACF30"]["file_path"] == "src/melee/test.c"
    assert "alreadyMatched_80000000" not in by_function
```

- [ ] **Step 2: Run CLI test and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py::test_audit_recover_matches_groups_stranded_candidates_by_unmatched_function -q --no-cov
```

Expected: Typer reports no such command or missing implementation.

- [ ] **Step 3: Implement command**

In `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py`, import:

```python
import asyncio
```

Add helpers:

```python
def _git_match_log_for_recovery(
    melee_root: Path,
    *,
    upstream: str,
) -> str:
    return _git_stdout(
        melee_root,
        [
            "log",
            "--all",
            "--grep=match:",
            "--not",
            upstream,
            "--format=%H%x09%D%x09%s",
        ],
        timeout=60,
    ) or ""


def _iter_recovery_match_commits(log_output: str) -> list[dict[str, str]]:
    commits: list[dict[str, str]] = []
    for line in log_output.splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        commit_hash, refs, subject = parts
        for function_name in _parse_lowercase_match_subject(subject):
            commits.append(
                {
                    "function": function_name,
                    "commit": commit_hash,
                    "refs": refs,
                    "subject": subject,
                }
            )
    return commits
```

Add command:

```python
@audit_app.command("recover-matches")
def audit_recover_matches(
    melee_root: Annotated[
        Path, typer.Option("--melee-root", "-m", help="Path to melee checkout")
    ] = DEFAULT_MELEE_ROOT,
    upstream: Annotated[
        str,
        typer.Option("--upstream", help="Upstream ref to exclude from git log"),
    ] = "upstream/master",
    limit: Annotated[int, typer.Option("--limit", "-n", help="Limit candidate functions shown")] = 100,
    output_json: Annotated[bool, typer.Option("--json", help="Output as JSON")] = False,
) -> None:
    """Surface still-unmatched functions with stranded local `match:` commits."""
    from src.extractor import extract_unmatched_functions

    log_output = _git_match_log_for_recovery(melee_root, upstream=upstream)
    unmatched = asyncio.run(
        extract_unmatched_functions(melee_root, include_asm=False)
    )
    unmatched_by_name = {
        function.name: function for function in unmatched.functions
    }

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    seen_commit_pairs: set[tuple[str, str]] = set()
    for commit in _iter_recovery_match_commits(log_output):
        function_name = commit["function"]
        if function_name not in unmatched_by_name:
            continue
        key = (function_name, commit["commit"])
        if key in seen_commit_pairs:
            continue
        seen_commit_pairs.add(key)
        grouped[function_name].append(
            {
                "commit": commit["commit"],
                "refs": commit["refs"],
                "subject": commit["subject"],
            }
        )

    candidates = []
    for function_name in sorted(grouped):
        function = unmatched_by_name[function_name]
        candidates.append(
            {
                "function": function_name,
                "file_path": function.file_path,
                "current_match_percent": round(function.current_match * 100.0, 6),
                "commits": grouped[function_name],
            }
        )
    limited = candidates[: max(limit, 0)]
    payload = {
        "upstream": upstream,
        "summary": {
            "unmatched_functions": len(unmatched_by_name),
            "candidate_functions": len(candidates),
            "candidate_commits": sum(len(row["commits"]) for row in candidates),
            "shown": len(limited),
        },
        "candidates": limited,
    }
    if output_json:
        print(json.dumps(payload, indent=2))
        return

    console.print(f"[bold]Recoverable stranded matches:[/bold] {len(candidates)}")
    table = Table()
    table.add_column("Function", style="cyan")
    table.add_column("Match %", justify="right")
    table.add_column("Commits", justify="right")
    table.add_column("File", style="dim")
    for row in limited:
        table.add_row(
            row["function"],
            f'{row["current_match_percent"]:.2f}',
            str(len(row["commits"])),
            row["file_path"],
        )
    console.print(table)
```

- [ ] **Step 4: Run CLI test and verify GREEN**

Run the focused CLI pytest command from Step 2.

Expected: test passes.

### Task 3: Verification And Commit

**Files:**
- Verify: `/Users/mike/code/melee/tools/melee-agent/src/cli/audit.py`
- Verify: `/Users/mike/code/melee/tools/melee-agent/tests/test_audit_recover_matches.py`
- Commit: `/Users/mike/code/melee/docs/superpowers/specs/2026-06-05-audit-recover-matches-design.md`
- Commit: `/Users/mike/code/melee/docs/superpowers/plans/2026-06-05-audit-recover-matches.md`

- [ ] **Step 1: Run audit tests**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_audit_recover_matches.py tests/test_audit_net_new.py -q --no-cov
```

Expected: all audit tests pass.

- [ ] **Step 2: Run CLI smoke checks**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m src.cli audit recover-matches --help | rg -- '--upstream|--limit|--json'
python -m src.cli audit recover-matches --json --limit 3 | python -m json.tool >/dev/null
```

Expected: help includes the new options and JSON output parses.

- [ ] **Step 3: Inspect diff**

Run:

```bash
cd /Users/mike/code/melee
git diff -- tools/melee-agent/src/cli/audit.py tools/melee-agent/tests/test_audit_recover_matches.py docs/superpowers/specs/2026-06-05-audit-recover-matches-design.md docs/superpowers/plans/2026-06-05-audit-recover-matches.md
```

Expected: only recover-matches parser, command, tests, spec, and plan changes.

- [ ] **Step 4: Commit**

Run:

```bash
cd /Users/mike/code/melee
git add tools/melee-agent/src/cli/audit.py tools/melee-agent/tests/test_audit_recover_matches.py docs/superpowers/specs/2026-06-05-audit-recover-matches-design.md docs/superpowers/plans/2026-06-05-audit-recover-matches.md
git commit -m "Add stranded match recovery audit"
```

Expected: commit succeeds.
