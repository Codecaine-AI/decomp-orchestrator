# Convergence `Checker` (checkdiff verdict) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the convergence loop driver a real `Checker` — the driver-owned checkdiff verdict (`ASM_MATCHED`) — and fix the latent type bug that `Checker.is_clean(compile)` can't be implemented because `Compile` is pcdump-only (no `.o`). The editor produces the `.o` (an artifact, not a verdict); the driver checks it. **The `debug converge` CLI and the real LLM editor are deferred** to the Gate-3 push (need user buy-in).

**Architecture:** `EditProposal` gains `obj_path` (the kept `.o` from the editor's `dump local --keep-obj` recompile). `run_convergence_loop` threads the current `.o` (`baseline_obj` → each `proposal.obj_path`) and calls `checker.is_clean(obj_path)`. The verdict is checkdiff's **effective-match** (relocation/operand-tolerant — the signal the codebase already trusts), not strict byte-identity. `CheckdiffChecker` mirrors `dump local --diff`: save the unit's build `.o`, copy `obj_path` in, run `checkdiff.py FN --format json --no-build` (fingerprint-free env), verdict = exit 0, restore the saved `.o` in a `finally`, all under checkdiff's per-`.o` lock. **The build `.o` path is injectable** so unit tests never touch the shared `build/GALE01` (the concurrent MWCC-debugger agent builds there). **All tests mock the checkdiff subprocess — NO live build runs.**

**Tech Stack:** Python 3.11, pytest (`--no-cov`, `timeout 120`). Reuses `convergence_loop` (`EditProposal`, `Checker`, `run_convergence_loop`). New: `CheckdiffChecker`. Trust boundary preserved: editor provides artifacts, driver judges.

---

## File Structure
- Modify `tools/melee-agent/src/mwcc_debug/convergence_loop.py` — add `obj_path` to `EditProposal`; thread `baseline_obj`/`current_obj` and call `checker.is_clean(obj_path)`; update the `Checker` protocol docstring to `is_clean(obj_path) -> bool`.
- Create `tools/melee-agent/src/mwcc_debug/checkdiff_checker.py` — `CheckdiffChecker` (injectable build-`.o` path; mockable checkdiff).
- Modify `tools/melee-agent/tests/test_convergence_loop.py` — a test that the driver threads the obj sequence to the checker.
- Create `tools/melee-agent/tests/test_checkdiff_checker.py` — mocked-checkdiff unit tests (clean/dirty/error/None; save-restore; no shared-build touch).

---

## Task 1: `EditProposal.obj_path` + driver threads the `.o` to the checker

**Files:** Modify `convergence_loop.py`; Modify `tests/test_convergence_loop.py`.

- [ ] **Step 1: Write the failing test (driver threads obj sequence)**

```python
def test_driver_threads_obj_path_to_checker():
    """The driver checks baseline_obj at iter 0, then each proposal.obj_path; the
    Checker (driver-owned) receives the .o artifact, never a verdict from the editor."""
    seen = []
    class _RecordingChecker:
        def is_clean(self, obj_path):
            seen.append(obj_path)
            return False                       # never clean -> loop proceeds
    class _ObjEditor:
        def __init__(self, objs): self._it = iter(objs)
        def edit(self, ctx):
            nxt = next(self._it, None)
            return None if nxt is None else cl.EditProposal(
                new_compile=object(), predicted_lever=DC.B_TARGET_HIGHER, rationale="", obj_path=nxt)
    seq = [(_state(identity=1, rank=1), 6), (_state(identity=2, rank=2), 6)]
    cl.run_convergence_loop("fn", _Target(), _ObjEditor(["o1", "o2"]), _RecordingChecker(),
                            iteration_cap=3, analyze_fn=_analyzer(seq),
                            baseline_obj="o0", stall_k=99)
    assert seen[0] == "o0"                      # baseline obj checked first
    assert seen[1] == "o1"                      # then the first edit's obj
```

- [ ] **Step 2: Run it (fails: EditProposal has no obj_path / no baseline_obj param)**

Run: `cd tools/melee-agent && python -m pytest tests/test_convergence_loop.py::test_driver_threads_obj_path_to_checker -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `convergence_loop.py`:
- Add to `EditProposal`: `obj_path: Optional["Path"] = None` (import `Path` from `pathlib` or type as `object`/`Optional` to avoid a hard dep; `Optional` is already imported).
- Update the `Checker` protocol docstring: `def is_clean(self, obj_path) -> bool: ...   # checkdiff verdict on the recompiled .o`.
- In `run_convergence_loop`, add `baseline_obj=None` to the signature; introduce `current_obj = baseline_obj`; change the win check to `checker.is_clean(current_obj)`; in step (e) after a successful edit set `current_obj = proposal.obj_path` (alongside `compile = proposal.new_compile`).

The existing `_Checker(clean_at=N)` stub takes a positional arg and ignores its value, so passing `obj_path` instead of `compile` keeps every existing loop test green.

- [ ] **Step 4: Run the full loop suite; all pass. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/convergence_loop.py tools/melee-agent/tests/test_convergence_loop.py
git commit -m "feat(loop): EditProposal.obj_path; driver threads the .o to a driver-owned Checker"
```

---

## Task 2: `CheckdiffChecker` (mockable, injectable build path)

**Files:** Create `checkdiff_checker.py`; Create `tests/test_checkdiff_checker.py`.

- [ ] **Step 1: Write the failing tests (all mocked — NO live build)**

```python
# tools/melee-agent/tests/test_checkdiff_checker.py
import pathlib
from unittest import mock
from src.mwcc_debug.checkdiff_checker import CheckdiffChecker


def _checker(tmp_path, build_obj):
    return CheckdiffChecker(function="fn_x", melee_root=tmp_path, build_obj_path=build_obj)


def test_is_clean_true_on_checkdiff_exit_0(tmp_path):
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    new_obj = tmp_path / "new.o"; new_obj.write_bytes(b"NEW")
    ck = _checker(tmp_path, build_obj)
    with mock.patch("subprocess.run", return_value=mock.Mock(returncode=0, stdout='{"match": true}')) as m:
        assert ck.is_clean(new_obj) is True
        assert m.called
    assert build_obj.read_bytes() == b"ORIG"          # restored after the check

def test_uses_fingerprint_free_env(tmp_path):
    # the verdict must NOT record to the shared attempts DB (review P1): the env
    # passed to checkdiff must carry CHECKDIFF_NO_FINGERPRINT=1.
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    new_obj = tmp_path / "new.o"; new_obj.write_bytes(b"NEW")
    captured = {}
    def fake_run(cmd, **kw): captured.update(kw); return mock.Mock(returncode=0, stdout='{"match": true}')
    with mock.patch("subprocess.run", side_effect=fake_run):
        _checker(tmp_path, build_obj).is_clean(new_obj)
    assert captured["env"].get("CHECKDIFF_NO_FINGERPRINT") == "1"

def test_is_clean_false_on_mismatch(tmp_path):
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    new_obj = tmp_path / "new.o"; new_obj.write_bytes(b"NEW")
    with mock.patch("subprocess.run", return_value=mock.Mock(returncode=1, stdout='{"match": false}')):
        assert _checker(tmp_path, build_obj).is_clean(new_obj) is False
    assert build_obj.read_bytes() == b"ORIG"

def test_is_clean_false_on_checkdiff_error(tmp_path):
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    new_obj = tmp_path / "new.o"; new_obj.write_bytes(b"NEW")
    with mock.patch("subprocess.run", return_value=mock.Mock(returncode=2, stdout="")):
        assert _checker(tmp_path, build_obj).is_clean(new_obj) is False
    assert build_obj.read_bytes() == b"ORIG"          # restored even on error

def test_is_clean_false_on_none_obj(tmp_path):
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    # no subprocess should run when there's no .o to check
    with mock.patch("subprocess.run") as m:
        assert _checker(tmp_path, build_obj).is_clean(None) is False
        assert not m.called

def test_restores_build_obj_even_if_checkdiff_raises(tmp_path):
    build_obj = tmp_path / "unit.o"; build_obj.write_bytes(b"ORIG")
    new_obj = tmp_path / "new.o"; new_obj.write_bytes(b"NEW")
    with mock.patch("subprocess.run", side_effect=RuntimeError("boom")):
        try:
            _checker(tmp_path, build_obj).is_clean(new_obj)
        except RuntimeError:
            pass
    assert build_obj.read_bytes() == b"ORIG"          # finally-restore holds
```

- [ ] **Step 2: Run them (fails: no module checkdiff_checker)**

Run: `cd tools/melee-agent && python -m pytest tests/test_checkdiff_checker.py -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement `CheckdiffChecker`**

```python
# tools/melee-agent/src/mwcc_debug/checkdiff_checker.py
from __future__ import annotations
import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional


class CheckdiffChecker:
    """Driver-owned ASM_MATCHED verdict: copy the editor's recompiled .o into the
    unit's build path, run `tools/checkdiff.py --no-build` (diffs the .o as-is, no
    ninja), and report whether it matches the target — then restore the original .o.

    `build_obj_path` is injectable so tests never touch the shared build/GALE01
    tree (a concurrent agent builds there). The editor supplies the .o ARTIFACT;
    this class renders the VERDICT — the trust boundary the loop depends on."""

    def __init__(self, function: str, melee_root: Path, build_obj_path: Path):
        self.function = function
        self.melee_root = Path(melee_root)
        self.build_obj_path = Path(build_obj_path)

    def is_clean(self, obj_path: Optional[Path]) -> bool:
        if obj_path is None:
            return False
        obj_path = Path(obj_path)
        saved = None
        had = self.build_obj_path.exists()
        if had:
            saved = self.build_obj_path.with_suffix(self.build_obj_path.suffix + ".convbak")
            shutil.copy2(self.build_obj_path, saved)
        try:
            self.build_obj_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(obj_path, self.build_obj_path)
            proc = subprocess.run(
                ["python", "tools/checkdiff.py", self.function, "--format", "json", "--no-build"],
                cwd=self.melee_root, capture_output=True, text=True, timeout=120,
                env=_checkdiff_env(),
            )
            if proc.returncode == 0:                       # checkdiff exit 0 == effective match
                return True
            if proc.returncode == 1 and proc.stdout:       # mismatch; confirm via JSON when present
                try:
                    return bool(json.loads(proc.stdout).get("match", False))
                except json.JSONDecodeError:
                    return False
            return False                                   # any other exit / no output -> not clean
        finally:
            if had and saved is not None:
                shutil.move(str(saved), str(self.build_obj_path))   # restore original
            elif not had:
                self.build_obj_path.unlink(missing_ok=True)         # we created it; clean up


def _checkdiff_env() -> dict:
    """checkdiff env that disables build-fingerprint dedup, so --no-build trusts the
    .o we just dropped in and does NOT record to the project attempts DB. Mirrors
    cli/debug.py:_checkdiff_env_without_fingerprint, which SETS this flag (it does
    not pop one)."""
    import os
    env = os.environ.copy()
    env["CHECKDIFF_NO_FINGERPRINT"] = "1"
    return env
```

Note (review P1): the real helper SETS `CHECKDIFF_NO_FINGERPRINT="1"` — verify the exact var name in `cli/debug.py:_checkdiff_env_without_fingerprint` and replicate it (don't import, to avoid a cli→mwcc_debug layering dep). Getting this wrong leaves fingerprinting ON, which can mutate the shared attempts DB on a real run — so **add a test asserting the env passed to `subprocess.run` has `CHECKDIFF_NO_FINGERPRINT == "1"`** (the other mocks don't inspect `env`, so this bug would otherwise ship green). checkdiff's clean signal: exit 0 (and JSON `match: true`) is checkdiff's **effective-match** (relocation/operand-tolerant) verdict — the same signal the rest of the codebase trusts — NOT strict byte-identity; prefer exit-0, keep the JSON fallback.

- [ ] **Step 4: Run; all pass (mocked — no real subprocess/build). Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/checkdiff_checker.py tools/melee-agent/tests/test_checkdiff_checker.py
git commit -m "feat(loop): CheckdiffChecker (driver-owned verdict; injectable build path; mocked tests)"
```

---

## Final verification
- [ ] Focused: `cd tools/melee-agent && timeout 150 python -m pytest tests/test_checkdiff_checker.py tests/test_convergence_loop.py tests/test_convergence_analyze.py tests/test_progress_classifier.py tests/test_role_reanchor.py -q --no-cov` → all pass.
- [ ] Full package suite: `cd tools/melee-agent && python -m pytest -q --no-cov` → no NEW failures vs master (the one pre-existing `test_reference_texts_do_not_emit_removed_debug_commands` `debug ceiling` failure is the concurrent agent's — do NOT touch). **Do not delete the worktree while the suite runs. Do NOT run any live checkdiff/build test autonomously — all checker tests are mocked.**
- [ ] Use superpowers:finishing-a-development-branch.

---

## Notes / deferred (do NOT build here)
- The **`debug converge` CLI** and the **real LLM `Editor`** (the agent-in-loop that reads the fact/lever/source-ideas and edits C source) — the Gate-3 push, needs user buy-in (compute + interpretation + a baseline-workflow control).
- **None-baseline degradation (review P1-2):** if an editor returns `obj_path=None` or the caller omits `baseline_obj`, `is_clean(None)` is `False` — the loop never declares CONVERGED (safe degrade, no crash). The deferred CLI MUST wire `baseline_obj` and real editors MUST set `obj_path`, so a pre-matched baseline is caught at iteration 0.
- **Unit 5** parallel harness; **multi-anchor consensus**.
- A **live** checkdiff integration test (real `.o`, real diff) is intentionally NOT run autonomously — it mutates the shared `build/GALE01` and races the concurrent agent. Add it later behind the repo's wibo/live opt-in marker.
