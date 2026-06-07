# mwcc-debug Pre-flight Polarity Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when a screening agent's `--want-first` target has wrong polarity for its paired force-phys mapping (high-volatile target physicals require LATE simplify positions, not early ones) and refuse or warn before the campaign burns hours of cloud compute.

**Architecture:** Extend `SimplifyOrderTargetSpec` with an optional `force_phys` field (`ig_idx -> physical_register_number`). When present, a new pure-Python polarity classifier flags any target physical in the high-volatile range (r10–r12) as wrong-polarity for `--want-first` syntax. Hook the classifier into `debug target score-simplify-order --breakdown` for default warnings and `--strict-polarity` for hard rejection with a hint about deferred-debt #20's late-target syntax.

**Tech Stack:** Python 3.11+, Typer, pytest, existing `mwcc_debug/simplify_order_scoring.py` and `cli/debug.py` plumbing. No new dependencies.

**Spec:** Deferred technical debt item #20 in `docs/mwcc-debug-diff-roadmap.md` (pre-flight extension portion). The lbDvd_80018A2C campaign writeup is the empirical evidence (`docs/mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md`).

**Phase roadmap:** This is Phase 1 of 4. Once it lands, Phases 2-4 get their own plans:

| Phase | Item | Scope |
|---|---|---|
| 1 (this plan) | #20 pre-flight | Polarity classifier + warning/refusal at screening time |
| 2 (next plan) | #19 | Coalesce-preservation constraint with empirical sub-experiment |
| 3 | #20 full | `--want-late N,M` and `--want-after PRECEDING,TARGETS` scorer syntax |
| 4 | #18 | Phys-iter scorer mode (parallel to simplify-order scorer) |

Each phase ends with a validation campaign on its canonical function as the acceptance criterion.

---

## Scope Check

This plan is one deliverable: the pre-flight polarity check. It is a small, contained refinement to the existing simplify-order scorer; it does not build any new scoring mode and does not invent late-target syntax. The hint message references `--want-late` (Phase 3) but the flag itself doesn't exist yet — the hint is a forward-pointer for the screening agent to know what's next.

Out of scope for this plan:
- The actual `--want-late` / `--want-after` syntax (Phase 3)
- Coalesce-preservation constraint (Phase 2)
- Phys-iter scorer mode (Phase 4)
- Re-running the lbDvd campaign with a correct target (Phase 3 acceptance)

In scope:
- Polarity classifier function in `simplify_order_scoring.py`
- Optional `force_phys` field on `SimplifyOrderTargetSpec`
- `--force-phys` flag on `setup-simplify-order-scorer` to capture it
- `--breakdown` polarity warning when present
- `--strict-polarity` flag for hard refusal
- SKILL.md documentation update
- Acceptance verification on a re-created lbDvd target (must trigger warning)

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` | Modify | Add `HIGH_VOLATILE_REGS`, `Polarity` enum, `classify_polarity()`, and extend `SimplifyOrderTargetSpec` with `force_phys` field + YAML loader |
| `tools/melee-agent/src/cli/debug.py` | Modify | Add `--force-phys` flag to `setup-simplify-order-scorer`; wire polarity check into `score-simplify-order --breakdown` and `--strict-polarity` |
| `tools/melee-agent/src/mwcc_debug/permuter_config.py` | Modify | Render `force_phys` into target.yaml when generating scorer settings |
| `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` | Modify | Add tests for `classify_polarity()` and force_phys parsing |
| `tools/melee-agent/tests/test_cli_score_simplify_order.py` | Modify | Add tests for `--breakdown` polarity output and `--strict-polarity` flag |
| `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` | Modify | Add tests for `--force-phys` flag |
| `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` | Modify | Test force_phys rendering in target.yaml |
| `.claude/skills/mwcc-debug/SKILL.md` | Modify | Document the polarity check in Step 0 of the Stuck-function workflow |

---

## Task 1: Polarity classifier in scoring module

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add constants + `Polarity` enum + `classify_polarity()` function)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add classifier tests)

- [ ] **Step 1.1: Write classifier tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
from src.mwcc_debug.simplify_order_scoring import (
    HIGH_VOLATILE_REGS,
    Polarity,
    classify_polarity,
)


def test_classify_polarity_safe_non_volatile() -> None:
    """Target physicals in r25-r31 are safe for --want-first.

    Non-volatiles are dispensed top-down from r31 by
    obtain_nonvolatile_register, so positioning target ig_idx values at
    the front of simplify order naturally gives them r31, r30, ...
    """
    # grVenom-style: target physicals are non-volatiles
    polarity = classify_polarity({42: 31, 32: 30})
    assert polarity is Polarity.SAFE


def test_classify_polarity_safe_r3() -> None:
    """r3 is the lowest workingMask bit, also safe for --want-first."""
    polarity = classify_polarity({42: 3})
    assert polarity is Polarity.SAFE


def test_classify_polarity_uncertain_mid_volatile() -> None:
    """r4-r9 may or may not work depending on interference."""
    polarity = classify_polarity({42: 5})
    assert polarity is Polarity.UNCERTAIN


def test_classify_polarity_wrong_high_volatile() -> None:
    """r10-r12 are wrong polarity for --want-first.

    Volatile dispense is lowest-first; to land on r10/r11/r12, target
    ig_idx values need to be at LATE simplify positions so r3-r9 are
    consumed first. lbDvd_80018A2C is canonical.
    """
    # lbDvd-style: target physicals are r10, r12
    polarity = classify_polarity({44: 10, 46: 12})
    assert polarity is Polarity.WRONG_POLARITY


def test_classify_polarity_mixed_picks_worst() -> None:
    """If any target physical is wrong polarity, classify as WRONG."""
    polarity = classify_polarity({42: 31, 44: 12})
    assert polarity is Polarity.WRONG_POLARITY


def test_classify_polarity_uncertain_dominates_safe() -> None:
    """If any target is UNCERTAIN and none are WRONG, return UNCERTAIN."""
    polarity = classify_polarity({42: 31, 44: 5})
    assert polarity is Polarity.UNCERTAIN


def test_classify_polarity_empty_returns_safe() -> None:
    """Empty force_phys (i.e., no force-phys mapping was provided) is
    SAFE — the polarity check is opt-in via providing the mapping."""
    polarity = classify_polarity({})
    assert polarity is Polarity.SAFE


def test_high_volatile_regs_constant() -> None:
    """Document the exact set so future readers know the threshold."""
    assert HIGH_VOLATILE_REGS == frozenset({10, 11, 12})
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "polarity or high_volatile_regs" -v`
Expected: 8 failures with `ImportError: cannot import name 'classify_polarity'` (or similar).

- [ ] **Step 1.3: Implement the classifier**

Add to `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` immediately after the existing imports block (around line 50, before `LEX_BIG`):

```python
import enum
from typing import Mapping


# Caller-save register threshold for --want-first polarity.
#
# MWCC's volatile dispense (from workingMask = r3..r12 - interferers) picks
# the LOWEST set bit. For target ig_idx values at simplify positions 0/1/...
# to land on a specific high volatile (r10/r11/r12), all lower volatiles
# (r3-r9) would need to be unavailable — which can't happen at position 0
# in a fresh dispense state. So target physicals in this range mean the
# target ig_idx values need LATE simplify positions, not early ones,
# making --want-first the wrong polarity.
#
# r4-r9 are flagged as UNCERTAIN: they may be reachable if other virtuals
# consume r3 first, but it's not guaranteed.
#
# Non-volatiles (r25-r31) are dispensed top-down from r31 by
# obtain_nonvolatile_register, so they're always safe for --want-first.
# r3 is the lowest workingMask bit, so position 0 naturally lands there.
HIGH_VOLATILE_REGS: frozenset[int] = frozenset({10, 11, 12})
UNCERTAIN_VOLATILE_REGS: frozenset[int] = frozenset({4, 5, 6, 7, 8, 9})


class Polarity(enum.Enum):
    """Classification of whether `--want-first` matches the target physical."""

    SAFE = "safe"
    """All target physicals reachable from front simplify-order positions."""

    UNCERTAIN = "uncertain"
    """At least one target physical is a mid-volatile (r4-r9); may or
    may not be reachable depending on interference state."""

    WRONG_POLARITY = "wrong_polarity"
    """At least one target physical is in HIGH_VOLATILE_REGS (r10-r12);
    --want-first is structurally wrong for these. lbDvd_80018A2C
    campaign documented this."""


def classify_polarity(force_phys: Mapping[int, int]) -> Polarity:
    """Classify whether `--want-first` syntax matches a force-phys mapping.

    Returns:
        SAFE if all target physicals are in {r3} ∪ {r25-r31} or
        force_phys is empty.
        UNCERTAIN if any target physical is in {r4-r9} and none are
        in HIGH_VOLATILE_REGS.
        WRONG_POLARITY if any target physical is in HIGH_VOLATILE_REGS.

    The classification is conservative: WRONG_POLARITY dominates over
    UNCERTAIN dominates over SAFE. The screening agent's call site
    decides what to do with each classification (warn vs refuse).
    """
    if not force_phys:
        return Polarity.SAFE

    polarity = Polarity.SAFE
    for phys in force_phys.values():
        if phys in HIGH_VOLATILE_REGS:
            return Polarity.WRONG_POLARITY
        if phys in UNCERTAIN_VOLATILE_REGS:
            polarity = Polarity.UNCERTAIN
    return polarity
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "polarity or high_volatile_regs" -v`
Expected: 8 passes.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add polarity classifier for --want-first targets

Adds HIGH_VOLATILE_REGS constant, Polarity enum, and classify_polarity()
function. Classifies a force-phys mapping (ig_idx -> physical) as SAFE,
UNCERTAIN, or WRONG_POLARITY based on whether target physicals can be
reached from front simplify-order positions via MWCC's dispense
algorithm.

This is the core check for the pre-flight polarity warning (deferred
debt #20). The CLI integration lands in follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend SimplifyOrderTargetSpec with optional force_phys field

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add field to dataclass + YAML loader)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (test field parsing)

- [ ] **Step 2.1: Write tests for force_phys field**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
import textwrap
from pathlib import Path

from src.mwcc_debug.simplify_order_scoring import (
    SimplifyOrderSpecError,
    load_simplify_order_target_spec,
)


def _write_spec(tmp_path: Path, body: str, baseline_name: str = "base.txt") -> Path:
    """Helper: write a target spec YAML to tmp_path with a baseline_dump
    file that exists. Returns the spec path."""
    baseline = tmp_path / baseline_name
    baseline.write_text("pcdump placeholder", encoding="utf-8")
    spec_path = tmp_path / "target.yaml"
    spec_path.write_text(textwrap.dedent(body), encoding="utf-8")
    return spec_path


def test_load_spec_without_force_phys(tmp_path: Path) -> None:
    """Existing specs without force_phys still load (backward-compat)."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: foo_func
        simplify_order_target: [34, 37, 32]
        class_id: 0
        baseline_dump: base.txt
        """,
    )

    spec = load_simplify_order_target_spec(spec_path)
    assert spec.function == "foo_func"
    assert spec.simplify_order_target == (34, 37, 32)
    assert spec.force_phys == {}  # default to empty dict


def test_load_spec_with_force_phys(tmp_path: Path) -> None:
    """force_phys parses as ig_idx (key, int) -> phys_reg (value, int)."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_80173EEC
        simplify_order_target: [34, 37, 32]
        class_id: 0
        baseline_dump: base.txt
        force_phys:
          34: 31
          37: 30
          32: 29
          42: 28
          52: 28
          38: 28
        """,
    )

    spec = load_simplify_order_target_spec(spec_path)
    assert spec.force_phys == {34: 31, 37: 30, 32: 29, 42: 28, 52: 28, 38: 28}


def test_load_spec_force_phys_must_be_mapping(tmp_path: Path) -> None:
    """force_phys must be a YAML mapping, not a list or string."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: foo
        simplify_order_target: [1, 2]
        baseline_dump: base.txt
        force_phys:
          - 1
          - 2
        """,
    )
    with pytest.raises(SimplifyOrderSpecError, match="force_phys.*mapping"):
        load_simplify_order_target_spec(spec_path)


def test_load_spec_force_phys_rejects_non_int_keys(tmp_path: Path) -> None:
    """ig_idx keys must be integers."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: foo
        simplify_order_target: [1, 2]
        baseline_dump: base.txt
        force_phys:
          "thirty-four": 31
        """,
    )
    with pytest.raises(SimplifyOrderSpecError, match="force_phys.*integer key"):
        load_simplify_order_target_spec(spec_path)


def test_load_spec_force_phys_rejects_non_int_values(tmp_path: Path) -> None:
    """phys_reg values must be integers (the bare register number, not 'r31')."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: foo
        simplify_order_target: [1, 2]
        baseline_dump: base.txt
        force_phys:
          34: "r31"
        """,
    )
    with pytest.raises(SimplifyOrderSpecError, match="force_phys.*integer value"):
        load_simplify_order_target_spec(spec_path)
```

Add `import pytest` to the top of the test file if not already there.

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "force_phys or without_force_phys" -v`
Expected: All 5 new tests fail (`AttributeError: 'SimplifyOrderTargetSpec' object has no attribute 'force_phys'` and similar).

- [ ] **Step 2.3: Extend the dataclass**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, replace the existing `SimplifyOrderTargetSpec` dataclass with:

```python
@dataclass(frozen=True)
class SimplifyOrderTargetSpec:
    """Configuration for the score-simplify-order command.

    Loaded from a YAML file; the wrapper script + CLI command both
    reference the same spec so the campaign's "what counts as a win" is
    captured in one editable file per function.

    Fields:
      function: Function name to score. Must match the function the
        candidate pcdump was generated for; the scorer validates this.
      simplify_order_target: ig_idx sequence we want at the head of class
        `class_id`'s simplify order. Lower-position = higher priority.
      class_id: Which register class to score against. Defaults to 0
        (GPR). Functions whose target slot is FPR would pass 1.
      baseline_dump: Absolute path to a pcdump for the baseline (known-
        good or pre-search) compile of the function. Used to compute
        `PrecolorDistance` against each candidate.
      force_phys: Optional mapping of ig_idx -> physical register number
        capturing the force-phys assignments the simplify_order_target
        was derived from. When present, enables the pre-flight polarity
        check (see classify_polarity). Defaults to an empty dict for
        backward compatibility with specs predating the polarity check.
    """

    function: str
    simplify_order_target: tuple[int, ...]
    class_id: int
    baseline_dump: Path
    force_phys: Mapping[int, int] = dataclasses.field(default_factory=dict)
```

Add the import: `import dataclasses` at the top of the file if not already present.

Then update `load_simplify_order_target_spec` to parse the new field. Replace the final `return SimplifyOrderTargetSpec(...)` block with:

```python
    # Optional force_phys mapping (deferred debt #20: pre-flight polarity check).
    raw_force_phys = data.get("force_phys", {})
    if raw_force_phys is None:
        raw_force_phys = {}
    if not isinstance(raw_force_phys, dict):
        raise SimplifyOrderSpecError(
            f"target spec {path}: 'force_phys' must be a mapping of "
            f"ig_idx (int) -> phys_reg (int), got "
            f"{type(raw_force_phys).__name__}"
        )
    force_phys: dict[int, int] = {}
    for k, v in raw_force_phys.items():
        if not isinstance(k, int) or isinstance(k, bool):
            raise SimplifyOrderSpecError(
                f"target spec {path}: 'force_phys' requires integer key, "
                f"got {k!r} ({type(k).__name__})"
            )
        if not isinstance(v, int) or isinstance(v, bool):
            raise SimplifyOrderSpecError(
                f"target spec {path}: 'force_phys[{k}]' requires integer value "
                f"(bare register number, not 'r31'), got {v!r} "
                f"({type(v).__name__})"
            )
        force_phys[k] = v

    return SimplifyOrderTargetSpec(
        function=function,
        simplify_order_target=tuple(target),
        class_id=class_id,
        baseline_dump=baseline_dump,
        force_phys=force_phys,
    )
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass, including the new force_phys tests and any pre-existing scoring tests (no regression).

- [ ] **Step 2.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add optional force_phys to SimplifyOrderTargetSpec

Adds an optional force_phys field to SimplifyOrderTargetSpec capturing
the force-phys mapping (ig_idx -> phys_reg) that the simplify_order_target
was derived from. The YAML loader parses it from an optional `force_phys`
key; existing specs without the field continue to load with an empty
mapping (backward compatible).

This is plumbing for the pre-flight polarity check (deferred debt #20).
The setup CLI flag and breakdown wiring land in follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add --force-phys flag to setup-simplify-order-scorer

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (add `--force-phys` to setup CLI)
- Modify: `tools/melee-agent/src/mwcc_debug/permuter_config.py` (render `force_phys` into target.yaml)
- Modify: `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` (test flag)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` (test rendering)

- [ ] **Step 3.1: Write tests for permuter_config rendering**

Append to `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py`:

```python
def test_render_target_yaml_without_force_phys(tmp_path: Path) -> None:
    """Backward compat: target.yaml without force_phys still renders cleanly."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml

    yaml_text = render_simplify_order_target_yaml(
        function="gm_test",
        simplify_order_target=(34, 37, 32),
        class_id=0,
        baseline_dump=tmp_path / "base.txt",
        force_phys=None,
    )
    assert "function: gm_test" in yaml_text
    assert "simplify_order_target:" in yaml_text
    assert "force_phys" not in yaml_text


def test_render_target_yaml_with_force_phys(tmp_path: Path) -> None:
    """force_phys renders as a YAML mapping of int keys to int values."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml

    yaml_text = render_simplify_order_target_yaml(
        function="lbDvd_test",
        simplify_order_target=(46, 44),
        class_id=0,
        baseline_dump=tmp_path / "base.txt",
        force_phys={44: 10, 46: 12},
    )
    assert "force_phys:" in yaml_text
    # YAML mapping syntax; verify both entries appear
    assert "44: 10" in yaml_text
    assert "46: 12" in yaml_text


def test_render_target_yaml_roundtrip_with_force_phys(tmp_path: Path) -> None:
    """Rendered YAML loads back via load_simplify_order_target_spec."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml
    from src.mwcc_debug.simplify_order_scoring import load_simplify_order_target_spec

    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump", encoding="utf-8")
    yaml_text = render_simplify_order_target_yaml(
        function="gm_test",
        simplify_order_target=(34, 37, 32),
        class_id=0,
        baseline_dump=baseline,
        force_phys={34: 31, 37: 30, 32: 29},
    )
    spec_path = tmp_path / "target.yaml"
    spec_path.write_text(yaml_text, encoding="utf-8")

    spec = load_simplify_order_target_spec(spec_path)
    assert spec.force_phys == {34: 31, 37: 30, 32: 29}
```

- [ ] **Step 3.2: Run config tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -k "force_phys" -v`
Expected: Failures because `render_simplify_order_target_yaml` doesn't accept a `force_phys` parameter yet.

- [ ] **Step 3.3: Update render_simplify_order_target_yaml**

In `tools/melee-agent/src/mwcc_debug/permuter_config.py`, locate the `render_simplify_order_target_yaml` function. Update its signature and body to accept an optional `force_phys` argument:

```python
def render_simplify_order_target_yaml(
    *,
    function: str,
    simplify_order_target: tuple[int, ...] | list[int],
    class_id: int,
    baseline_dump: Path,
    force_phys: Mapping[int, int] | None = None,
) -> str:
    """Render a SimplifyOrderTargetSpec to YAML.

    force_phys is optional. When provided as a non-empty mapping, it is
    rendered as a YAML mapping under the `force_phys` key. When None or
    empty, the key is omitted entirely (keeps target.yaml minimal for
    cases where the screening agent didn't supply force-phys).
    """
    lines: list[str] = [
        f"function: {function}",
        f"simplify_order_target: {list(simplify_order_target)}",
        f"class_id: {class_id}",
        f"baseline_dump: {baseline_dump}",
    ]
    if force_phys:
        lines.append("force_phys:")
        for ig_idx, phys in sorted(force_phys.items()):
            lines.append(f"  {ig_idx}: {phys}")
    return "\n".join(lines) + "\n"
```

Add `from typing import Mapping` to the imports if not already present.

- [ ] **Step 3.4: Run config tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -v`
Expected: All tests pass.

- [ ] **Step 3.5: Write tests for the setup CLI --force-phys flag**

Append to `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py`:

```python
def test_setup_force_phys_flag_parses_and_writes_yaml(
    tmp_path: Path, monkeypatch
) -> None:
    """`--force-phys 44:10,46:12` writes force_phys into target.yaml."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    # Prepare a fake permuter dir, baseline pcdump, and minimal env so
    # setup-simplify-order-scorer can run.
    perm_dir = tmp_path / "perm" / "lbDvd"
    perm_dir.mkdir(parents=True)
    (perm_dir / "compile.sh").write_text("#!/bin/bash\nexit 0\n")
    (perm_dir / "compile.sh").chmod(0o755)
    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump placeholder", encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "lbDvd_test",
            "--want-first", "46,44",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force-phys", "44:10,46:12",
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    target_yaml = perm_dir / "simplify_order_target.yaml"
    assert target_yaml.exists()
    content = target_yaml.read_text(encoding="utf-8")
    assert "force_phys:" in content
    assert "44: 10" in content
    assert "46: 12" in content


def test_setup_without_force_phys_omits_key(
    tmp_path: Path, monkeypatch
) -> None:
    """Without --force-phys, target.yaml does not contain force_phys."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    perm_dir = tmp_path / "perm" / "gm"
    perm_dir.mkdir(parents=True)
    (perm_dir / "compile.sh").write_text("#!/bin/bash\nexit 0\n")
    (perm_dir / "compile.sh").chmod(0o755)
    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump placeholder", encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "gm_test",
            "--want-first", "34,37,32",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    target_yaml = perm_dir / "simplify_order_target.yaml"
    content = target_yaml.read_text(encoding="utf-8")
    assert "force_phys" not in content


def test_setup_force_phys_invalid_format_errors(
    tmp_path: Path, monkeypatch
) -> None:
    """--force-phys with bad format gives clear error."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    perm_dir = tmp_path / "perm" / "x"
    perm_dir.mkdir(parents=True)
    (perm_dir / "compile.sh").write_text("#!/bin/bash\nexit 0\n")
    (perm_dir / "compile.sh").chmod(0o755)
    baseline = tmp_path / "base.txt"
    baseline.write_text("p", encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "x",
            "--want-first", "1",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force-phys", "not-a-pair",
            "--force",
        ],
    )

    assert result.exit_code != 0
    assert "force-phys" in result.output.lower()
```

- [ ] **Step 3.6: Run setup CLI tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -k "force_phys or omits_key" -v`
Expected: Failures because the `--force-phys` flag doesn't exist yet on the command.

- [ ] **Step 3.7: Add --force-phys flag to the setup command**

In `tools/melee-agent/src/cli/debug.py`, locate the `setup_simplify_order_scorer` function (around line 5173). Add a new option after `--baseline-dump`. The exact location is right before the function body opens; add to the parameter list:

```python
    force_phys: Optional[str] = typer.Option(
        None,
        "--force-phys",
        help=(
            "Optional force-phys mapping (comma-separated ig_idx:phys pairs, "
            "e.g. '34:31,37:30,32:29'). Captured into target.yaml for the "
            "pre-flight polarity check. Pass the same mapping you used in "
            "--force-phys when proving the function's force allocation."
        ),
    ),
```

Then in the function body, parse the option into a dict and pass it to the YAML renderer. Find where `render_simplify_order_target_yaml` is called and update the call site. First, after parameter parsing, add:

```python
    # Parse optional --force-phys mapping for the polarity check.
    parsed_force_phys: dict[int, int] = {}
    if force_phys is not None:
        for pair in force_phys.split(","):
            pair = pair.strip()
            if not pair:
                continue
            if ":" not in pair:
                typer.echo(
                    f"error: --force-phys entry '{pair}' must be IG_IDX:PHYS_REG",
                    err=True,
                )
                raise typer.Exit(code=2)
            ig_str, phys_str = pair.split(":", 1)
            try:
                ig_idx = int(ig_str.strip())
                phys = int(phys_str.strip())
            except ValueError:
                typer.echo(
                    f"error: --force-phys entry '{pair}' must be IG_IDX:PHYS_REG "
                    f"with integer values",
                    err=True,
                )
                raise typer.Exit(code=2)
            parsed_force_phys[ig_idx] = phys
```

Then update the existing call to `render_simplify_order_target_yaml` to pass `force_phys=parsed_force_phys or None`.

- [ ] **Step 3.8: Run all setup tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -v`
Expected: All tests pass.

- [ ] **Step 3.9: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/src/mwcc_debug/permuter_config.py \
        tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py \
        tools/melee-agent/tests/test_mwcc_debug_permuter_config.py
git commit -m "$(cat <<'EOF'
feat: --force-phys flag on setup-simplify-order-scorer

Adds an optional --force-phys flag to debug permute setup-simplify-
order-scorer that captures the force-phys mapping (ig_idx:phys pairs)
into the generated target.yaml. The mapping is plumbed through to
the renderer (permuter_config.render_simplify_order_target_yaml).

Without --force-phys, behavior is unchanged: target.yaml omits the
force_phys key entirely. With --force-phys, the mapping is rendered
as a YAML sub-mapping and survives a load roundtrip via
load_simplify_order_target_spec.

This enables the pre-flight polarity check (deferred debt #20). The
check itself wires in via score-simplify-order --breakdown in the
next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire polarity check into score-simplify-order --breakdown

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (extend --breakdown output with polarity diagnosis)
- Modify: `tools/melee-agent/tests/test_cli_score_simplify_order.py` (test breakdown output)

- [ ] **Step 4.1: Write tests for polarity in --breakdown output**

Append to `tools/melee-agent/tests/test_cli_score_simplify_order.py`:

```python
def test_breakdown_with_safe_polarity_no_warning(tmp_path: Path) -> None:
    """SAFE polarity (non-volatile targets) emits no polarity warning."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[34, 37, 32],
        force_phys={34: 31, 37: 30, 32: 29},  # all non-volatile
    )
    candidate = _build_candidate_obj(tmp_path, function="gm_test")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "gm_test",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "POLARITY" not in result.output.upper() or "safe" in result.output.lower()
    # No warning text
    assert "wrong polarity" not in result.output.lower()


def test_breakdown_with_wrong_polarity_emits_warning(tmp_path: Path) -> None:
    """WRONG_POLARITY (high-volatile target) emits a clear warning."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[46, 44],
        force_phys={44: 10, 46: 12},  # high-volatile, lbDvd-style
    )
    candidate = _build_candidate_obj(tmp_path, function="lbDvd_test")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "lbDvd_test",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
        ],
    )

    assert result.exit_code == 0, result.output  # warn-only by default
    assert "WRONG POLARITY" in result.output or "wrong polarity" in result.output.lower()
    # Hint at the late-target syntax (deferred debt #20 full)
    assert "--want-late" in result.output or "want-late" in result.output


def test_breakdown_with_uncertain_polarity_emits_note(tmp_path: Path) -> None:
    """UNCERTAIN (mid-volatile targets r4-r9) emits a softer note."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[46, 44],
        force_phys={44: 5, 46: 6},  # mid-volatile, uncertain
    )
    candidate = _build_candidate_obj(tmp_path, function="x")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "x",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "uncertain" in result.output.lower()
    # NOT wrong polarity
    assert "wrong polarity" not in result.output.lower()


def test_breakdown_without_force_phys_no_polarity_section(tmp_path: Path) -> None:
    """Specs without force_phys skip the polarity check entirely."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[1, 2],
        force_phys=None,
    )
    candidate = _build_candidate_obj(tmp_path, function="x")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "x",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
        ],
    )

    assert result.exit_code == 0, result.output
    # No polarity output at all when force_phys is absent
    assert "polarity" not in result.output.lower()
```

You will need helpers `_build_target_spec()` and `_build_candidate_obj()` if not already present in the test file. Look near the top of the file for similar fixtures; if they exist, use them. If not, add (near the top):

```python
def _build_target_spec(
    tmp_path: Path,
    *,
    simplify_order_target: list[int],
    force_phys: dict[int, int] | None = None,
    function: str | None = None,
) -> Path:
    """Build a minimal target.yaml file in tmp_path. Returns the path."""
    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump", encoding="utf-8")
    fn_name = function or "test_fn"
    lines = [
        f"function: {fn_name}",
        f"simplify_order_target: {simplify_order_target}",
        "class_id: 0",
        f"baseline_dump: {baseline}",
    ]
    if force_phys:
        lines.append("force_phys:")
        for k, v in sorted(force_phys.items()):
            lines.append(f"  {k}: {v}")
    spec_path = tmp_path / "target.yaml"
    spec_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return spec_path


def _build_candidate_obj(tmp_path: Path, function: str) -> Path:
    """Build a placeholder candidate .o + .pcdump.txt pair.

    The CLI reads the .o file, but the scorer logic only inspects the
    associated pcdump (looked up via the .pcdump.txt sibling convention).
    Tests just need both files to exist; the pcdump content can be a
    minimal pass-through that parses without error and contains the
    function name."""
    obj_path = tmp_path / "candidate.o"
    obj_path.write_bytes(b"\x00" * 16)
    pcdump = obj_path.with_suffix(obj_path.suffix + ".pcdump.txt")
    # Minimal pcdump that parses: one function block, no events. The
    # scorer's prefix calculation will see an empty observed order and
    # return prefix=0, but the CLI still runs to completion and emits
    # the breakdown sections we care about for these tests.
    pcdump.write_text(
        f"Starting function {function}\n\nSIMPLIFY GRAPH (class=0)\n",
        encoding="utf-8",
    )
    return obj_path
```

- [ ] **Step 4.2: Run breakdown tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -k "polarity or uncertain or without_force_phys" -v`
Expected: All 4 new tests fail because the polarity output isn't wired in yet.

- [ ] **Step 4.3: Wire polarity into the breakdown CLI**

In `tools/melee-agent/src/cli/debug.py`, locate the `score_simplify_order` (or similarly named) command that implements `target score-simplify-order`. Find the section that renders the `--breakdown` output. After the existing breakdown lines (`Function:`, `Score:`, `Target prefix:`, `Observed prefix:`, `Common prefix:`, `Precolor distance:`), append the polarity check:

```python
        # Polarity diagnosis (deferred debt #20 pre-flight check).
        # Only runs when the target.yaml provides force_phys; otherwise
        # the screening agent didn't ask for the check and we stay
        # quiet.
        from src.mwcc_debug.simplify_order_scoring import (
            Polarity,
            classify_polarity,
        )

        if spec.force_phys:
            polarity = classify_polarity(spec.force_phys)
            typer.echo("")  # blank line separator
            if polarity is Polarity.WRONG_POLARITY:
                typer.echo("Polarity check:    WRONG POLARITY")
                typer.echo(
                    "  At least one target physical is in the high-volatile "
                    "range (r10-r12). MWCC's volatile dispense is lowest-"
                    "first, so target ig_idx values at simplify positions "
                    "0/1/... get r3/r4/... not r10-r12. --want-first is the "
                    "wrong polarity for this target."
                )
                typer.echo(
                    "  Hint: this case needs late-target syntax (--want-late "
                    "or --want-after, deferred debt #20 full). See "
                    "docs/mwcc-debug-diff-roadmap.md 'Target shape' under "
                    "Layer A and the lbDvd_80018A2C campaign writeup."
                )
            elif polarity is Polarity.UNCERTAIN:
                typer.echo("Polarity check:    UNCERTAIN")
                typer.echo(
                    "  At least one target physical is mid-volatile (r4-r9). "
                    "--want-first may or may not reach the target depending "
                    "on interference state at dispense time. If campaign "
                    "produces prefix hits but no match% progress, consider "
                    "whether dispense direction is the issue."
                )
            else:
                typer.echo("Polarity check:    SAFE")
```

The exact location depends on the current breakdown rendering layout. If the breakdown renders via a helper function (e.g., `render_score_breakdown`), put the polarity logic at the end of that helper. If it's inline in the CLI command, add it at the end of the relevant `if breakdown:` block. Match the existing style for output spacing.

- [ ] **Step 4.4: Run breakdown tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -v`
Expected: All tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_cli_score_simplify_order.py
git commit -m "$(cat <<'EOF'
feat: polarity check in score-simplify-order --breakdown

When the target.yaml provides force_phys, score-simplify-order
--breakdown now classifies the polarity and emits one of:

- SAFE: all target physicals reachable from front simplify positions
- UNCERTAIN: mid-volatile targets (r4-r9) — may or may not work
- WRONG POLARITY: high-volatile targets (r10-r12) — --want-first is
  structurally wrong; hints at late-target syntax (deferred debt #20).

Default behavior is warn-only; the check runs but the exit code is
unchanged. --strict-polarity (next commit) makes WRONG_POLARITY a
hard exit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add --strict-polarity flag

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (add flag + change exit code when triggered)
- Modify: `tools/melee-agent/tests/test_cli_score_simplify_order.py` (test strict mode)

- [ ] **Step 5.1: Write tests for --strict-polarity**

Append to `tools/melee-agent/tests/test_cli_score_simplify_order.py`:

```python
def test_strict_polarity_exits_nonzero_on_wrong(tmp_path: Path) -> None:
    """--strict-polarity exits non-zero when polarity is WRONG_POLARITY."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[46, 44],
        force_phys={44: 10, 46: 12},
    )
    candidate = _build_candidate_obj(tmp_path, function="lbDvd_test")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "lbDvd_test",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
            "--strict-polarity",
        ],
    )

    assert result.exit_code != 0
    assert "WRONG POLARITY" in result.output or "wrong polarity" in result.output.lower()


def test_strict_polarity_succeeds_on_safe(tmp_path: Path) -> None:
    """--strict-polarity succeeds when polarity is SAFE."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[34, 37],
        force_phys={34: 31, 37: 30},
    )
    candidate = _build_candidate_obj(tmp_path, function="gm_test")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "gm_test",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
            "--strict-polarity",
        ],
    )

    assert result.exit_code == 0


def test_strict_polarity_does_not_error_on_uncertain(tmp_path: Path) -> None:
    """UNCERTAIN doesn't trigger --strict-polarity exit — only WRONG does.

    Reason: UNCERTAIN means 'might work, might not'. Refusing it
    would block legitimate experiments. Only WRONG_POLARITY
    (structurally impossible) gets the hard refusal."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[46, 44],
        force_phys={44: 5, 46: 6},
    )
    candidate = _build_candidate_obj(tmp_path, function="x")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "x",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
            "--strict-polarity",
        ],
    )

    assert result.exit_code == 0


def test_strict_polarity_without_force_phys_succeeds(tmp_path: Path) -> None:
    """--strict-polarity on a spec without force_phys is a no-op."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    spec_path = _build_target_spec(
        tmp_path,
        simplify_order_target=[1],
        force_phys=None,
    )
    candidate = _build_candidate_obj(tmp_path, function="x")

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "target",
            "score-simplify-order",
            "-f", "x",
            "--target", str(spec_path),
            str(candidate),
            "--breakdown",
            "--strict-polarity",
        ],
    )

    assert result.exit_code == 0
```

- [ ] **Step 5.2: Run strict tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -k "strict_polarity" -v`
Expected: All 4 tests fail because the `--strict-polarity` flag doesn't exist.

- [ ] **Step 5.3: Add --strict-polarity flag**

In `tools/melee-agent/src/cli/debug.py`, locate the `score_simplify_order` command's signature. Add a new option:

```python
    strict_polarity: bool = typer.Option(
        False,
        "--strict-polarity",
        help=(
            "Exit non-zero when the polarity check is WRONG_POLARITY. "
            "Use in screening scripts to refuse high-volatile-target "
            "campaigns before they burn cloud compute. UNCERTAIN polarity "
            "is allowed in strict mode — only the structurally-impossible "
            "case is rejected."
        ),
    ),
```

Then in the function body, after the polarity check emits its output, if `strict_polarity` and `polarity is Polarity.WRONG_POLARITY`, raise `typer.Exit(code=2)`. The relevant snippet:

```python
        if spec.force_phys:
            polarity = classify_polarity(spec.force_phys)
            # ... existing breakdown output ...
            if strict_polarity and polarity is Polarity.WRONG_POLARITY:
                raise typer.Exit(code=2)
```

- [ ] **Step 5.4: Run strict tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -v`
Expected: All tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_cli_score_simplify_order.py
git commit -m "$(cat <<'EOF'
feat: --strict-polarity refuses WRONG_POLARITY targets

Adds --strict-polarity flag to score-simplify-order. When set and
the polarity check returns WRONG_POLARITY, the command exits with
code 2 after emitting the diagnostic. UNCERTAIN polarity does not
trigger the refusal — only the structurally-impossible high-volatile
case is rejected.

Intended for screening scripts that want to refuse high-volatile
target campaigns before they burn cloud compute. Default behavior
(without --strict-polarity) remains warn-only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update SKILL.md Step 0 docs

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md` (extend Step 0 description with polarity check)

- [ ] **Step 6.1: Locate Step 0 in SKILL.md**

Open `.claude/skills/mwcc-debug/SKILL.md` and find the "Stuck-function workflow with custom simplify-order scorer" section. Inside it, locate the "Step 0 — pre-flight check (REQUIRED)" subsection.

- [ ] **Step 6.2: Extend Step 0 with the polarity check**

Find the current Step 0 text:

```markdown
**Step 0 — pre-flight check (REQUIRED).** After deriving
`target.yaml` via the usual force-proof flow, confirm the target is
expressible as a simplify-order prefix:

```bash
melee-agent debug target score-simplify-order \
  -f <function> --target <target.yaml> <baseline.o> --breakdown
```

`Observed prefix:` must contain non-`-1` `ig_idx` values. If it is
empty or all `-1`, the target shape is **phys-iter**
(`COLORGRAPH DECISIONS` positions, not `SIMPLIFY GRAPH`) and Layer A
cannot help. Abort before the 2–3 hour permuter run. See
"Target shape" under Layer A in the roadmap.
```

Replace it with:

```markdown
**Step 0 — pre-flight check (REQUIRED).** After deriving
`target.yaml` via the usual force-proof flow, pass the same force-phys
mapping to `setup-simplify-order-scorer` via `--force-phys` so the
target.yaml captures it. Then score the baseline:

```bash
melee-agent debug target score-simplify-order \
  -f <function> --target <target.yaml> <baseline.o> --breakdown \
  --strict-polarity
```

The breakdown emits two checks:

1. **`Observed prefix:`** must contain non-`-1` `ig_idx` values. If it
   is empty or all `-1`, the target shape is **phys-iter**
   (`COLORGRAPH DECISIONS` positions, not `SIMPLIFY GRAPH`) and Layer A
   cannot help. Abort before the 2–3 hour permuter run.

2. **`Polarity check:`** must report **SAFE**. If it reports
   **WRONG POLARITY**, the target physicals are in the high-volatile
   range (r10–r12) and `--want-first` syntax is structurally wrong for
   this function — MWCC's volatile dispense gives front simplify-order
   positions the LOWEST registers, not r10/r11/r12. `--strict-polarity`
   makes this a hard refusal. The lbDvd_80018A2C campaign documented
   this gotcha; see roadmap "Target shape" under Layer A. UNCERTAIN
   polarity (mid-volatile r4–r9) is allowed but produces a soft note —
   proceed with caution.

See "Target shape" under Layer A in the roadmap for the full taxonomy
of when each pre-flight signal applies.
```

- [ ] **Step 6.3: Stage and verify diff is the intended change**

Run: `cd /Users/mike/code/melee && git diff .claude/skills/mwcc-debug/SKILL.md`
Expected: Diff matches the replacement above (no other unintended changes).

- [ ] **Step 6.4: Commit**

```bash
git add -f .claude/skills/mwcc-debug/SKILL.md
git commit -m "$(cat <<'EOF'
docs: add polarity check to Step 0 pre-flight in SKILL.md

Documents the new polarity check that lands with deferred debt #20's
pre-flight extension. Step 0 now has two checks:

1. Observed prefix non-empty (phys-iter detection, pre-existing)
2. Polarity classification (high-volatile target detection, new)

Recommends --strict-polarity for screening scripts so wrong-polarity
targets are refused before queueing the campaign.

The -f on git add is required because .claude/skills/mwcc-debug is
in .gitignore (the canonical skill is tracked-but-ignored).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Acceptance verification on lbDvd's actual target

**Files:**
- No files modified. This task validates the build against the canonical lbDvd_80018A2C case.

- [ ] **Step 7.1: Locate the lbDvd target.yaml**

Read the lbDvd campaign writeup at `docs/mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md` and find the simplify-order target it used: `--want-first 46,44` with force-phys `'44:10,46:12'`. The screening's existing target.yaml (created without `--force-phys`) is at the path noted in the writeup; if it no longer has the simplify-order spec on disk, recreate it for this test.

- [ ] **Step 7.2: Reconstruct the target with --force-phys**

In a temp dir:

```bash
mkdir -p /tmp/polarity-acceptance
cd /tmp/polarity-acceptance

# Minimal baseline file so the spec validates
touch base.txt

# Hand-write target.yaml (since we may not have a full permuter setup
# locally just for this test)
cat > target.yaml <<EOF
function: lbDvd_80018A2C
simplify_order_target: [46, 44]
class_id: 0
baseline_dump: $(pwd)/base.txt
force_phys:
  44: 10
  46: 12
EOF

# Minimal candidate .o + pcdump pair (just for the CLI to run)
echo -n "" > candidate.o
cat > candidate.o.pcdump.txt <<EOF
Starting function lbDvd_80018A2C

SIMPLIFY GRAPH (class=0)
EOF
```

- [ ] **Step 7.3: Run score-simplify-order --breakdown and verify WRONG_POLARITY warning fires**

Run: `melee-agent debug target score-simplify-order -f lbDvd_80018A2C --target /tmp/polarity-acceptance/target.yaml /tmp/polarity-acceptance/candidate.o --breakdown`

Expected output (key lines, exact formatting may vary slightly):

```
Function:          lbDvd_80018A2C
Score:             ...
Target prefix:     [46, 44]
Observed prefix:   []
Common prefix:     0 / 2
Precolor distance: 0

Polarity check:    WRONG POLARITY
  At least one target physical is in the high-volatile range (r10-r12)...
  Hint: this case needs late-target syntax (--want-late ...)
```

Exit code: 0 (warn-only without `--strict-polarity`).

- [ ] **Step 7.4: Run with --strict-polarity and verify non-zero exit**

Run: `melee-agent debug target score-simplify-order -f lbDvd_80018A2C --target /tmp/polarity-acceptance/target.yaml /tmp/polarity-acceptance/candidate.o --breakdown --strict-polarity`

Expected: Same output as Step 7.3, but exit code `2`. Verify with: `echo $?` immediately after the command.

- [ ] **Step 7.5: Confirm grVenom-style target still passes**

Build a similar target.yaml for grVenom (non-volatile target) and verify the polarity check reports SAFE and exit code is 0 even with `--strict-polarity`:

```bash
cat > /tmp/polarity-acceptance/grvenom-target.yaml <<EOF
function: grVenom_80204284
simplify_order_target: [42, 32]
class_id: 0
baseline_dump: /tmp/polarity-acceptance/base.txt
force_phys:
  42: 31
  32: 30
EOF

melee-agent debug target score-simplify-order \
  -f grVenom_80204284 \
  --target /tmp/polarity-acceptance/grvenom-target.yaml \
  /tmp/polarity-acceptance/candidate.o \
  --breakdown --strict-polarity
```

Expected: `Polarity check: SAFE` (or equivalent), exit code 0.

- [ ] **Step 7.6: Run full test suite to confirm no regression**

Run: `cd tools/melee-agent && pytest`
Expected: All tests pass.

- [ ] **Step 7.7: No commit (acceptance is verification only)**

This task produces no commits. If acceptance steps fail, return to the failing task and fix the issue. If all acceptance steps pass, the phase is complete.

---

## Self-Review Notes

Spec coverage check:
- ✅ Polarity classifier function: Task 1
- ✅ Optional `force_phys` field on target spec: Task 2
- ✅ `--force-phys` CLI flag on setup: Task 3
- ✅ Polarity warning in `--breakdown`: Task 4
- ✅ `--strict-polarity` flag: Task 5
- ✅ SKILL.md documentation: Task 6
- ✅ Acceptance on lbDvd-style target: Task 7

Placeholder scan:
- No "TBD" or "implement later" patterns
- All code blocks contain actual code, not pseudocode
- All test names are concrete

Type consistency:
- `Polarity` enum: defined in Task 1, referenced in Tasks 4 and 5 — consistent
- `classify_polarity(force_phys: Mapping[int, int]) -> Polarity`: signature stable across tasks
- `SimplifyOrderTargetSpec.force_phys`: defined in Task 2, referenced in Tasks 4 and 5 as `spec.force_phys` — consistent

Acceptance criteria are concrete:
- lbDvd target triggers WRONG_POLARITY warning (default mode)
- Same target with `--strict-polarity` exits non-zero
- grVenom target reports SAFE
- Full test suite passes

## Validation Campaign (post-merge)

After this plan lands, run the polarity check against the canonical lbDvd target.yaml that the campaign agent originally used (still in their Codex worktree). It should now warn (`WRONG POLARITY`) and, if `--strict-polarity` were added to the existing setup script, refuse the campaign. That's the empirical evidence that the pre-flight extension would have saved 2.4 hours of cloud compute on that campaign.

Document this in a short follow-up note appended to `docs/mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md`: "If --strict-polarity had existed at screening time, the polarity check on the original target.yaml would have refused the campaign before submission."

Once the validation note is appended, this phase is complete and Phase 2 (#19 coalesce-preservation) gets its own plan.
