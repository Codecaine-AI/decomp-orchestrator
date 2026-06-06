# mwcc-debug CLI Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `melee-agent debug` into opinionated workflow groups and update the canonical MWCC debug docs so agents learn one command layout.

**Architecture:** Keep the existing implementation in `tools/melee-agent/src/cli/debug.py`, but replace the flat Typer command registration with focused sub-apps: `dump`, `inspect`, `target`, `suggest`, `mutate`, `permute`, and `util`. Command bodies should move with minimal behavior changes; documentation and tests should become the forcing function that prevents old top-level command names from drifting back in.

**Tech Stack:** Python 3.11+, Typer, pytest `CliRunner`, Markdown docs, existing mwcc-debug modules.

**Spec:** `docs/superpowers/specs/2026-05-21-mwcc-debug-cli-reorg-design.md`

---

## Scope Check

The approved spec has one deliverable: a principled reorganization of the existing `melee-agent debug` command surface plus canonical docs. This plan does not add new debugging features, change pcdump behavior, or implement `suggest inlines`; it only reserves the grouped command location for that planned command.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/melee-agent/src/cli/debug.py` | Modify | Define debug workflow Typer groups and move command registrations to the new names |
| `tools/melee-agent/tests/test_debug_cli_reorg.py` | Create | Regression tests for grouped help, representative moved commands, and removed old top-level commands |
| `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py` | Create | Regression tests for canonical docs and skill command names |
| `.claude/skills/mwcc-debug/SKILL.md` | Modify | Agent-facing MWCC debug guide, rewritten around grouped commands and local-first workflow |
| `docs/mwcc-debug.md` | Modify | Canonical architecture/workflow doc, rewritten around local cached pcdumps with remote fallback |
| `docs/mwcc-debug-roadmap.md` | Modify | Mark CLI/docs refresh as shipped and update Phase 2 command examples to grouped names |
| `tools/melee-agent/scripts/permute_with_mwcc.py` | Modify | Update embedded command examples and subprocess invocation to `debug target score-source` |

---

## Command Mapping

Use this exact mapping. Do not add hidden aliases for removed top-level commands.

```text
pcdump-local              -> dump local
pcdump                    -> dump remote
setup-local               -> dump setup

analyze                   -> inspect analyze
diff                      -> inspect diff
simulate                  -> inspect simulate
guide                     -> inspect guide
stuck                     -> inspect stuck
ceiling                   -> inspect ceiling
rank-callees              -> inspect rank-callees

derive-target             -> target derive
score                     -> target score-dump
score-source              -> target score-source
match-iter-first          -> target match-iter-first

suggest-casts             -> suggest casts
suggest-coalesce-source   -> suggest coalesce

mutate type-change        -> mutate type-change
mutate insert-alias       -> mutate insert-alias
enumerate-decl-orders     -> mutate decl-orders
tier3-search              -> mutate search

verify-perm               -> permute verify
triage-perm               -> permute triage
gen-permuter-config       -> permute config
fix-perm-compile          -> permute fix-compile
permute                   -> permute run

pattern-catalog           -> util patterns
name-magic                -> util name-magic
verify-with-name-magic    -> util verify-name-magic
```

---

## Task 1: Add CLI reorganization tests

**Files:**
- Create: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1.1: Write failing CLI help and removal tests**

Create `tools/melee-agent/tests/test_debug_cli_reorg.py`:

```python
"""CLI surface tests for the workflow-oriented mwcc-debug command layout."""
from __future__ import annotations

import re

from typer.testing import CliRunner

from src.cli import app


runner = CliRunner()


def strip_ansi(text: str) -> str:
    ansi_escape = re.compile(r"\x1b\[[0-9;]*m")
    return ansi_escape.sub("", text)


def test_debug_help_shows_only_workflow_groups() -> None:
    result = runner.invoke(app, ["debug", "--help"])

    assert result.exit_code == 0
    out = strip_ansi(result.stdout)
    for group in ("dump", "inspect", "target", "suggest", "mutate", "permute", "util"):
        assert group in out
    assert "Collect pcdumps" in out
    assert "Read, compare, and explain" in out
    assert "Define and score allocator targets" in out

    for removed in (
        "pcdump-local",
        "derive-target",
        "verify-perm",
        "triage-perm",
        "suggest-coalesce-source",
        "pattern-catalog",
        "verify-with-name-magic",
    ):
        assert removed not in out


def test_representative_grouped_command_help_works() -> None:
    commands = [
        ["debug", "dump", "local", "--help"],
        ["debug", "dump", "remote", "--help"],
        ["debug", "inspect", "guide", "--help"],
        ["debug", "target", "derive", "--help"],
        ["debug", "target", "score-source", "--help"],
        ["debug", "suggest", "coalesce", "--help"],
        ["debug", "mutate", "decl-orders", "--help"],
        ["debug", "permute", "run", "--help"],
        ["debug", "permute", "verify", "--help"],
        ["debug", "util", "name-magic", "--help"],
    ]
    for command in commands:
        result = runner.invoke(app, command)
        assert result.exit_code == 0, (command, result.stdout)


def test_removed_top_level_debug_commands_are_not_registered() -> None:
    removed_commands = [
        "pcdump",
        "pcdump-local",
        "setup-local",
        "analyze",
        "simulate",
        "diff",
        "guide",
        "stuck",
        "ceiling",
        "rank-callees",
        "derive-target",
        "score",
        "score-source",
        "match-iter-first",
        "suggest-casts",
        "suggest-coalesce-source",
        "verify-perm",
        "enumerate-decl-orders",
        "triage-perm",
        "gen-permuter-config",
        "fix-perm-compile",
        "tier3-search",
        "pattern-catalog",
        "name-magic",
        "verify-with-name-magic",
    ]
    for command in removed_commands:
        result = runner.invoke(app, ["debug", command, "--help"])
        assert result.exit_code != 0, command
        combined = strip_ansi(result.stdout + result.stderr)
        assert "No such command" in combined or "Got unexpected extra argument" in combined
```

- [ ] **Step 1.2: Run the new tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py -q
```

Expected: failures showing that `debug --help` still lists old flat commands and grouped commands such as `debug dump local` do not exist.

- [ ] **Step 1.3: Commit the failing tests**

Run:

```bash
git add tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "test: cover mwcc debug CLI reorg"
```

Expected: commit succeeds with only the new failing test file staged.

---

## Task 2: Rewire `debug.py` into workflow groups

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 2.1: Add grouped Typer apps near the top of `debug.py`**

Replace the existing `debug_app` definition:

```python
debug_app = typer.Typer(
    help="Compiler introspection via remote Windows mwcc_debug DLL"
)
```

with:

```python
debug_app = typer.Typer(
    help=(
        "MWCC debugging workflow: collect pcdumps, inspect allocator "
        "decisions, score targets, generate source suggestions, mutate "
        "source, and triage permuter candidates."
    )
)

dump_app = typer.Typer(
    help="Collect pcdumps and manage local mwcc_debug setup."
)
inspect_app = typer.Typer(
    help="Read, compare, and explain MWCC pcdumps."
)
target_app = typer.Typer(
    help="Define and score allocator targets."
)
suggest_app = typer.Typer(
    help="Suggest source-shape and mismatch fixes."
)
mutate_app = typer.Typer(
    help="Apply focused source mutations on specific variables or decls."
)
permute_app = typer.Typer(
    help="Run, verify, and triage decomp-permuter candidates."
)
util_app = typer.Typer(
    help="Low-level helpers outside the main mwcc-debug loop."
)

debug_app.add_typer(dump_app, name="dump")
debug_app.add_typer(inspect_app, name="inspect")
debug_app.add_typer(target_app, name="target")
debug_app.add_typer(suggest_app, name="suggest")
debug_app.add_typer(mutate_app, name="mutate")
debug_app.add_typer(permute_app, name="permute")
debug_app.add_typer(util_app, name="util")
```

- [ ] **Step 2.2: Remove the old late `mutate_app` definition**

Delete this block near the current `virtual-to-var` command:

```python
mutate_app = typer.Typer(
    help="Tier 3: targeted source mutations on specific variables.",
)
debug_app.add_typer(mutate_app, name="mutate")
```

Keep `_read_source_for`, `mutate_type_change_cmd`, and `mutate_insert_alias_cmd`.

- [ ] **Step 2.3: Move command decorators to the new apps**

Apply these decorator replacements exactly:

```text
@debug_app.command("pcdump")                         -> @dump_app.command("remote")
@debug_app.command(name="pcdump-local")              -> @dump_app.command(name="local")
@debug_app.command(name="setup-local")               -> @dump_app.command(name="setup")

@debug_app.command("analyze")                        -> @inspect_app.command("analyze")
@debug_app.command("simulate")                       -> @inspect_app.command("simulate")
@debug_app.command("diff")                           -> @inspect_app.command("diff")
@debug_app.command() above def guide                 -> @inspect_app.command("guide")
@debug_app.command(name="stuck")                     -> @inspect_app.command(name="stuck")
@debug_app.command(name="ceiling")                   -> @inspect_app.command(name="ceiling")
@debug_app.command(name="rank-callees")              -> @inspect_app.command(name="rank-callees")

@debug_app.command() above def score                 -> @target_app.command(name="score-dump")
@debug_app.command(name="derive-target")             -> @target_app.command(name="derive")
@debug_app.command(name="score-source")              -> @target_app.command(name="score-source")
@debug_app.command(name="match-iter-first")          -> @target_app.command(name="match-iter-first")

@debug_app.command(name="suggest-casts")             -> @suggest_app.command(name="casts")
@debug_app.command(name="suggest-coalesce-source")   -> @suggest_app.command(name="coalesce")

@debug_app.command(name="enumerate-decl-orders")     -> @mutate_app.command(name="decl-orders")
@debug_app.command(name="tier3-search")              -> @mutate_app.command(name="search")

@debug_app.command(name="verify-perm")               -> @permute_app.command(name="verify")
@debug_app.command(name="triage-perm")               -> @permute_app.command(name="triage")
@debug_app.command(name="gen-permuter-config")       -> @permute_app.command(name="config")
@debug_app.command(name="fix-perm-compile")          -> @permute_app.command(name="fix-compile")
@debug_app.command(name="permute")                   -> @permute_app.command(name="run")

@debug_app.command(name="pattern-catalog")           -> @util_app.command(name="patterns")
@debug_app.command(name="name-magic")                -> @util_app.command(name="name-magic")
@debug_app.command(name="verify-with-name-magic")    -> @util_app.command(name="verify-name-magic")
```

Leave these existing decorators unchanged because they already live under the desired group:

```python
@mutate_app.command(name="type-change")
@mutate_app.command(name="insert-alias")
```

- [ ] **Step 2.4: Update in-code command references that affect runtime messages**

In `tools/melee-agent/src/cli/debug.py`, replace user-facing strings as follows:

```text
melee-agent debug setup-local              -> melee-agent debug dump setup
debug setup-local                          -> debug dump setup
debug pcdump-local                         -> debug dump local
debug pcdump                               -> debug dump remote
debug analyze                              -> debug inspect analyze
debug guide                                -> debug inspect guide
debug derive-target                        -> debug target derive
debug score                                -> debug target score-dump
debug score-source                         -> debug target score-source
debug suggest-casts                        -> debug suggest casts
debug suggest-coalesce-source              -> debug suggest coalesce
debug enumerate-decl-orders                -> debug mutate decl-orders
debug tier3-search                         -> debug mutate search
debug verify-perm                          -> debug permute verify
debug triage-perm                          -> debug permute triage
debug gen-permuter-config                  -> debug permute config
debug fix-perm-compile                     -> debug permute fix-compile
debug pattern-catalog                      -> debug util patterns
debug name-magic                           -> debug util name-magic
debug verify-with-name-magic               -> debug util verify-name-magic
```

When a string refers to an invocation with arguments, preserve the arguments. For example:

```python
f"Run `melee-agent debug pattern-catalog <name>` for full details"
```

becomes:

```python
f"Run `melee-agent debug util patterns <name>` for full details"
```

- [ ] **Step 2.5: Run the CLI reorg tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py -q
```

Expected: all tests in `test_debug_cli_reorg.py` pass.

- [ ] **Step 2.6: Compile the changed CLI module**

Run:

```bash
cd tools/melee-agent
python -m compileall src/cli/debug.py
```

Expected: output includes `Compiling 'src/cli/debug.py'...` or no errors if the bytecode is already current.

- [ ] **Step 2.7: Commit the CLI rewire**

Run:

```bash
git add tools/melee-agent/src/cli/debug.py
git commit -m "refactor: group mwcc debug CLI commands"
```

Expected: commit succeeds and `pytest tests/test_debug_cli_reorg.py -q` remains green.

---

## Task 3: Update permuter scorer script command references

**Files:**
- Modify: `tools/melee-agent/scripts/permute_with_mwcc.py`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 3.1: Add a regression assertion for the scorer subprocess**

Append this test to `tools/melee-agent/tests/test_debug_cli_reorg.py`:

```python
def test_permuter_scorer_uses_grouped_score_source_command() -> None:
    script = (
        __import__("pathlib")
        .Path(__file__)
        .resolve()
        .parents[1]
        / "scripts"
        / "permute_with_mwcc.py"
    )
    text = script.read_text()
    assert '"debug", "target", "score-source"' in text
    assert '"debug", "score-source"' not in text
```

- [ ] **Step 3.2: Run the focused test to verify it fails**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_permuter_scorer_uses_grouped_score_source_command -q
```

Expected: failure showing the script still invokes `debug score-source`.

- [ ] **Step 3.3: Update `permute_with_mwcc.py`**

In `tools/melee-agent/scripts/permute_with_mwcc.py`, change the subprocess command from:

```python
[
    "python", "-m", "src.cli", "debug", "score-source",
    str(candidate_path),
    "-f", fn,
    "--target", target,
    "--cflags-from", unit,
    "--quiet",
]
```

to:

```python
[
    "python", "-m", "src.cli", "debug", "target", "score-source",
    str(candidate_path),
    "-f", fn,
    "--target", target,
    "--cflags-from", unit,
    "--quiet",
]
```

Also update top-of-file prose references:

```text
`melee-agent debug score`        -> `melee-agent debug target score-dump`
`melee-agent debug score-source` -> `melee-agent debug target score-source`
`melee-agent debug permute`      -> `melee-agent debug permute run`
```

- [ ] **Step 3.4: Run the focused test**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_permuter_scorer_uses_grouped_score_source_command -q
```

Expected: pass.

- [ ] **Step 3.5: Commit the scorer script update**

Run:

```bash
git add tools/melee-agent/scripts/permute_with_mwcc.py tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "fix: update mwcc permuter scorer command path"
```

Expected: commit succeeds.

---

## Task 4: Add canonical docs regression tests

**Files:**
- Create: `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py`

- [ ] **Step 4.1: Write failing docs/skill command-name tests**

Create `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py`:

```python
"""Regression tests for canonical mwcc-debug docs command names."""
from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]

CANONICAL_DOCS = [
    REPO_ROOT / ".claude" / "skills" / "mwcc-debug" / "SKILL.md",
    REPO_ROOT / "docs" / "mwcc-debug.md",
    REPO_ROOT / "docs" / "mwcc-debug-roadmap.md",
]

STALE_FORMS = [
    "melee-agent debug pcdump-local",
    "melee-agent debug pcdump ",
    "melee-agent debug setup-local",
    "melee-agent debug analyze",
    "melee-agent debug guide",
    "melee-agent debug derive-target",
    "melee-agent debug score ",
    "melee-agent debug score-source",
    "melee-agent debug suggest-casts",
    "melee-agent debug suggest-coalesce-source",
    "melee-agent debug verify-perm",
    "melee-agent debug enumerate-decl-orders",
    "melee-agent debug triage-perm",
    "melee-agent debug gen-permuter-config",
    "melee-agent debug fix-perm-compile",
    "melee-agent debug pattern-catalog",
    "melee-agent debug name-magic",
    "melee-agent debug verify-with-name-magic",
]

EXPECTED_FORMS = [
    "melee-agent debug dump local",
    "melee-agent debug dump remote",
    "melee-agent debug dump setup",
    "melee-agent debug inspect guide",
    "melee-agent debug inspect analyze",
    "melee-agent debug target derive",
    "melee-agent debug target score-dump",
    "melee-agent debug target score-source",
    "melee-agent debug suggest casts",
    "melee-agent debug suggest coalesce",
    "melee-agent debug mutate decl-orders",
    "melee-agent debug permute verify",
    "melee-agent debug permute triage",
    "melee-agent debug util patterns",
    "melee-agent debug util name-magic",
]


def test_canonical_docs_exist() -> None:
    missing = [str(path) for path in CANONICAL_DOCS if not path.exists()]
    assert missing == []


def test_canonical_docs_use_grouped_debug_commands() -> None:
    combined = "\n".join(path.read_text() for path in CANONICAL_DOCS)

    stale_hits = [form for form in STALE_FORMS if form in combined]
    assert stale_hits == []

    missing_expected = [form for form in EXPECTED_FORMS if form not in combined]
    assert missing_expected == []
```

- [ ] **Step 4.2: Run the docs tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_docs_cli_reorg.py -q
```

Expected: failure listing stale command forms from the canonical docs.

- [ ] **Step 4.3: Commit the failing docs regression tests**

Run:

```bash
git add tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py
git commit -m "test: require grouped mwcc debug docs"
```

Expected: commit succeeds with the new failing docs test.

---

## Task 5: Rewrite canonical MWCC debug docs and skill

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md`
- Modify: `docs/mwcc-debug.md`
- Modify: `docs/mwcc-debug-roadmap.md`
- Test: `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py`

- [ ] **Step 5.1: Update the command cheat sheet in `.claude/skills/mwcc-debug/SKILL.md`**

In `.claude/skills/mwcc-debug/SKILL.md`, replace the current command examples with grouped forms. Use this exact quick-reference block near the top, immediately after the "Quick Decision" or introductory section:

````markdown
## Quick Workflow

Use local cached pcdumps first:

```bash
melee-agent debug dump setup                         # one-time local setup
melee-agent debug dump local src/melee/mn/foo.c      # refresh cached pcdump
melee-agent debug inspect guide -f fn_80247510       # first interpretation step
melee-agent debug inspect analyze -f fn_80247510     # detailed virtual/register table
melee-agent debug inspect diff before.txt after.txt -f fn_80247510
```

When you have a desired allocator shape:

```bash
melee-agent debug target derive -f fn_80247510 > /tmp/target.yaml
melee-agent debug target score-dump -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target score-source src/melee/mn/foo.c -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target match-iter-first -f fn_80247510
```

When diagnostics point at source shape:

```bash
melee-agent debug suggest casts fn_80247510 --signedness
melee-agent debug suggest coalesce -f fn_80247510 --discover --top 5
melee-agent debug mutate decl-orders fn_80247510 --strategy all
melee-agent debug mutate type-change -f fn_80247510 --var local_var --type u32
melee-agent debug mutate insert-alias -f fn_80247510 --var local_var --at 0
```

When using decomp-permuter:

```bash
melee-agent debug permute config -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute run -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute verify output-1234/source.c -f fn_80247510
melee-agent debug permute triage permute_output_dir -f fn_80247510 --apply-best
melee-agent debug permute fix-compile path/to/compile.sh
```

Low-level helpers:

```bash
melee-agent debug util patterns
melee-agent debug util patterns decl-order
melee-agent debug util name-magic build/GALE01/src/melee/mn/foo.o --map @123=lbl_804D0000
melee-agent debug util verify-name-magic src/melee/mn/foo.c -f fn_80247510
```
````

Then replace old command forms throughout the skill using the mapping in this plan.

- [ ] **Step 5.2: Rewrite `docs/mwcc-debug.md` around local-first grouped commands**

Replace `docs/mwcc-debug.md` with this full content:

````markdown
# mwcc_debug workflow

`melee-agent debug` is the MWCC back-end debugging toolkit for stubborn Melee
matching problems. It collects MWCC pcdumps, explains register allocator
decisions, scores target allocator shapes, suggests source nudges, and connects
those diagnostics to decomp-permuter.

Use this after lighter tools such as `mismatch-db`, `opseq`, `ghidra`, and
`discord-knowledge` fail to explain a last-mile mismatch.

## Command groups

```text
melee-agent debug dump      collect pcdumps and manage local setup
melee-agent debug inspect   read, compare, and explain pcdumps
melee-agent debug target    define and score allocator targets
melee-agent debug suggest   source-shape and mismatch suggestions
melee-agent debug mutate    focused source mutations
melee-agent debug permute   permuter integration and candidate verification
melee-agent debug util      low-level helpers
```

## Normal workflow

Start with a local cached pcdump:

```bash
melee-agent debug dump setup
melee-agent debug dump local src/melee/mn/foo.c
```

The dump is cached under `build/mwcc_debug_cache/`, so follow-up commands can
usually resolve it from `--function/-f`:

```bash
melee-agent debug inspect guide -f fn_80247510
melee-agent debug inspect analyze -f fn_80247510
melee-agent debug inspect simulate -f fn_80247510
```

If you are comparing source attempts:

```bash
melee-agent debug dump local src/melee/mn/foo.c --output /tmp/before.txt
melee-agent debug dump local src/melee/mn/foo.c --output /tmp/after.txt
melee-agent debug inspect diff /tmp/before.txt /tmp/after.txt -f fn_80247510
```

If you have a desired allocator mapping:

```bash
melee-agent debug target derive -f fn_80247510 > /tmp/target.yaml
melee-agent debug target score-dump -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target score-source src/melee/mn/foo.c -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target match-iter-first -f fn_80247510
```

If diagnostics point at source shape:

```bash
melee-agent debug suggest casts fn_80247510 --signedness
melee-agent debug suggest coalesce -f fn_80247510 --discover --top 5
melee-agent debug mutate decl-orders fn_80247510 --strategy all
melee-agent debug mutate type-change -f fn_80247510 --var local_var --type u32
melee-agent debug mutate insert-alias -f fn_80247510 --var local_var --at 0
```

If using decomp-permuter:

```bash
melee-agent debug permute config -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute run -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute verify output-1234/source.c -f fn_80247510
melee-agent debug permute triage permute_output_dir -f fn_80247510 --apply-best
```

## Local vs remote dumps

`debug dump local` is the default path. It compiles locally through wibo and the
patched MWCC debug DLL, writes a unique temporary pcdump, and mirrors natural
runs into the cache. Forced allocator runs skip cache sync so experimental data
does not masquerade as the natural baseline.

Use remote mode only as fallback or when validating the Windows path:

```bash
melee-agent debug dump remote src/melee/mn/foo.c --timeout 180
```

Remote mode SSHes to the configured Windows host, runs the PowerShell wrapper,
and streams the pcdump back. It sees committed remote code, while local mode sees
the current working tree.

## Force options

Allocator force options are diagnostic probes, not source fixes.

- `--force-phys` and `--force-phys-iter` bias physical register assignment.
- `--force-phys-fn` scopes those physical-register overrides to one function.
- `--force-coalesce` overrides conservative coalescing decisions.
- `--force-coalesce-fn` scopes coalesce overrides to one function.
- `--force-iter-first` is global to the TU and has no per-function scope.

Prefer single-function TUs or explicit function scoping for forced runs. Use
`debug target match-iter-first` before reaching for `--force-iter-first`.

## Utility helpers

```bash
melee-agent debug util patterns
melee-agent debug util patterns decl-order
melee-agent debug util name-magic build/GALE01/src/melee/mn/foo.o --map @123=lbl_804D0000
melee-agent debug util verify-name-magic src/melee/mn/foo.c -f fn_80247510
```

Use `debug util patterns` for source mutation patterns and `debug util
name-magic` when anonymous SDA2 names obscure the real text difference.

## Relationship to mwcc-inspect

Use `mwcc-inspect` for front-end parser views: ENodes, ObjObjects, statement
trees, and variable IDs. Use `mwcc-debug` for back-end pass output: basic
blocks, virtual registers, interferences, colorgraph decisions, and instruction
scheduling.
````

- [ ] **Step 5.3: Update `docs/mwcc-debug-roadmap.md`**

In `docs/mwcc-debug-roadmap.md`, make these exact replacements:

```text
debug suggest-inlines                         -> debug suggest inlines
debug suggest-coalesce-source                 -> debug suggest coalesce
suggest-coalesce-source --discover            -> suggest coalesce --discover
debug derive-target                           -> debug target derive
debug score                                   -> debug target score-dump
debug guide                                   -> debug inspect guide
debug verify-perm                             -> debug permute verify
debug enumerate-decl-orders                   -> debug mutate decl-orders
debug pattern-catalog                         -> debug util patterns
debug suggest-casts                           -> debug suggest casts
debug triage-perm                             -> debug permute triage
debug gen-permuter-config                     -> debug permute config
debug score-source                            -> debug target score-source
legacy top-level bridge helper var-to-virtual -> debug inspect var-to-virtual
legacy top-level bridge helper virtual-to-var -> debug inspect virtual-to-var
debug tier3-search                            -> debug mutate search
```

Then adjust the "Recently shipped baseline" bullet from:

```markdown
- **CLI/docs refresh** for local mode, force scoping, name-magic,
  coalesce suggestions, bridge lookups, mutate, and tier3 workflows.
```

to:

```markdown
- **CLI/docs refresh v1** for local mode, force scoping, name-magic,
  coalesce suggestions, bridge lookups, mutate, and tier3 workflows.
- **CLI/docs refresh v2** reorganizes `melee-agent debug` into workflow groups:
  `dump`, `inspect`, `target`, `suggest`, `mutate`, `permute`, and `util`.
```

- [ ] **Step 5.4: Run the docs tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_docs_cli_reorg.py -q
```

Expected: pass.

- [ ] **Step 5.5: Scan canonical docs for stale commands**

Run:

```bash
rg -n "melee-agent debug (pcdump-local|pcdump |setup-local|analyze|guide|derive-target|score |score-source|suggest-casts|suggest-coalesce-source|verify-perm|enumerate-decl-orders|triage-perm|gen-permuter-config|fix-perm-compile|pattern-catalog|name-magic|verify-with-name-magic)" .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug.md docs/mwcc-debug-roadmap.md
```

Expected: no output.

- [ ] **Step 5.6: Commit docs and skill updates**

Run:

```bash
git add .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug.md docs/mwcc-debug-roadmap.md tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py
git commit -m "docs: teach grouped mwcc debug workflow"
```

Expected: commit succeeds and docs tests remain green.

---

## Task 6: Handle bridge commands and final help polish

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `.claude/skills/mwcc-debug/SKILL.md`
- Modify: `docs/mwcc-debug.md`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py`

- [ ] **Step 6.1: Decide and test bridge command placement**

The approved spec omitted `var-to-virtual` and `virtual-to-var`, but they are part of the current `debug` surface and are used in the skill. Put them under `inspect` because they interpret pcdump/source bridge data.

Append this assertion to `test_representative_grouped_command_help_works` in `tools/melee-agent/tests/test_debug_cli_reorg.py`:

```python
        ["debug", "inspect", "var-to-virtual", "--help"],
        ["debug", "inspect", "virtual-to-var", "--help"],
```

Append these entries to `removed_commands` in `test_removed_top_level_debug_commands_are_not_registered`:

```python
        "var-to-virtual",
        "virtual-to-var",
```

- [ ] **Step 6.2: Run the focused CLI tests to verify bridge placement fails before the code change**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_debug_cli_reorg.py::test_removed_top_level_debug_commands_are_not_registered -q
```

Expected: failure for `debug inspect var-to-virtual --help` and/or top-level bridge commands still existing.

- [ ] **Step 6.3: Move bridge command decorators**

In `tools/melee-agent/src/cli/debug.py`, apply:

```text
old var-to-virtual debug_app decorator        -> @inspect_app.command(name="var-to-virtual")
old virtual-to-var debug_app decorator        -> @inspect_app.command(name="virtual-to-var")
```

Update any legacy top-level bridge helper references to:

```text
debug inspect var-to-virtual
debug inspect virtual-to-var
```

- [ ] **Step 6.4: Run grouped help manually for readability**

Run:

```bash
cd tools/melee-agent
python -m src.cli debug --help
python -m src.cli debug dump --help
python -m src.cli debug inspect --help
python -m src.cli debug target --help
python -m src.cli debug suggest --help
python -m src.cli debug mutate --help
python -m src.cli debug permute --help
python -m src.cli debug util --help
```

Expected:

```text
debug --help: shows only dump, inspect, target, suggest, mutate, permute, util
dump --help: shows local, remote, setup
inspect --help: shows analyze, diff, simulate, guide, stuck, ceiling, rank-callees, var-to-virtual, virtual-to-var
target --help: shows derive, score-dump, score-source, match-iter-first
suggest --help: shows casts, coalesce
mutate --help: shows type-change, insert-alias, decl-orders, search
permute --help: shows verify, triage, config, fix-compile, run
util --help: shows patterns, name-magic, verify-name-magic
```

If a group help string still starts with "Tier N", change the group or command docstring to describe the workflow role first. Tier labels may remain in longer prose below the first sentence.

- [ ] **Step 6.5: Run CLI and docs tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py tests/test_mwcc_debug_docs_cli_reorg.py -q
```

Expected: all tests pass.

- [ ] **Step 6.6: Commit bridge placement and help polish**

Run:

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_debug_cli_reorg.py .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug.md docs/mwcc-debug-roadmap.md
git commit -m "refactor: place mwcc bridge helpers under inspect"
```

Expected: commit succeeds.

---

## Task 7: Final verification

**Files:**
- Verify: `tools/melee-agent/src/cli/debug.py`
- Verify: `tools/melee-agent/scripts/permute_with_mwcc.py`
- Verify: `.claude/skills/mwcc-debug/SKILL.md`
- Verify: `docs/mwcc-debug.md`
- Verify: `docs/mwcc-debug-roadmap.md`
- Verify: `tools/melee-agent/tests/test_debug_cli_reorg.py`
- Verify: `tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py`

- [ ] **Step 7.1: Run targeted tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py tests/test_mwcc_debug_docs_cli_reorg.py -q
```

Expected: all tests pass.

- [ ] **Step 7.2: Run broader MWCC debug tests likely affected by command imports**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_diagnostic_extraction.py tests/test_mwcc_debug_cache.py tests/test_mwcc_debug_source_patch.py tests/test_suggest_coalesce.py tests/test_mwcc_debug_tier3_search.py -q
```

Expected: all tests pass.

- [ ] **Step 7.3: Compile changed Python files**

Run:

```bash
cd tools/melee-agent
python -m compileall src/cli/debug.py scripts/permute_with_mwcc.py
```

Expected: no syntax errors.

- [ ] **Step 7.4: Scan for stale canonical command forms**

Run:

```bash
rg -n "melee-agent debug (pcdump-local|pcdump |setup-local|analyze|guide|derive-target|score |score-source|suggest-casts|suggest-coalesce-source|verify-perm|enumerate-decl-orders|triage-perm|gen-permuter-config|fix-perm-compile|pattern-catalog|name-magic|verify-with-name-magic|var-to-virtual|virtual-to-var)" .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug.md docs/mwcc-debug-roadmap.md tools/melee-agent/scripts/permute_with_mwcc.py
```

Expected: no output.

- [ ] **Step 7.5: Check whitespace and git state**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` has no output. `git status --short` shows only intended files if there are uncommitted final polish changes.

- [ ] **Step 7.6: Commit final polish if needed**

If Step 7.5 shows intended uncommitted changes, run:

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/scripts/permute_with_mwcc.py tools/melee-agent/tests/test_debug_cli_reorg.py tools/melee-agent/tests/test_mwcc_debug_docs_cli_reorg.py .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug.md docs/mwcc-debug-roadmap.md
git commit -m "chore: finish mwcc debug CLI reorg verification"
```

Expected: commit succeeds, or there are no uncommitted changes and no final commit is needed.

- [ ] **Step 7.7: Report completion**

Summarize:

```text
Implemented grouped `melee-agent debug` command layout with no legacy top-level aliases.
Updated canonical MWCC debug docs and skill to the grouped local-first workflow.
Verified with CLI/docs tests, targeted MWCC debug tests, compileall, stale-reference scan, and git diff --check.
```
