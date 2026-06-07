# mwcc-debug Late-Target Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--want-late N,M` target syntax to the custom simplify-order scorer for cases where target `ig_idx` values should appear at the END of simplify order rather than the front. Update the polarity classifier to consider target direction. Validate on `lbDvd_80018A2C` (canonical high-volatile target physicals case).

**Architecture:** Add `simplify_order_target_late: tuple[int, ...]` as a new optional field on `SimplifyOrderTargetSpec`, mutually exclusive with the existing `simplify_order_target` (which represents the front-target). Add a `_filter_meaningful_order` companion that yields the filtered simplify order in either forward or reverse, then `compute_lex_score` reads `spec.simplify_order_target_late` (if set) and computes a suffix-match score instead of a prefix-match score. Extend `classify_polarity` with a `target_position: Literal["first", "late"]` parameter so high-volatile target physicals classify as SAFE when paired with `--want-late` rather than WRONG_POLARITY. Add `--want-late N,M` flag on the setup CLI (mutually exclusive with `--want-first`). Validated on `lbDvd_80018A2C` — target r10/r12 should now reach SAFE polarity + a campaign run with `--want-late 46,44` produces a non-zero number of suffix-2/2 candidates.

**Tech Stack:** Python 3.11+, pytest, existing `mwcc_debug/simplify_order_scoring.py` + `cli/debug.py` + `mwcc_debug/permuter_config.py`. No new dependencies.

**Spec:** Deferred technical debt item #20 in `docs/mwcc-debug-diff-roadmap.md` (the full late-target portion — Phase 1 shipped the pre-flight polarity warning piece). The `lbDvd_80018A2C` campaign writeup (`docs/mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md`) is the empirical motivation.

**Phase roadmap:** Phase 3 of 4. Phase 1 (#20 pre-flight polarity check) shipped at `ef0f95b2c`. Phase 2 (#19 coalesce-preservation constraint) shipped at `0f31f51bf` + `30b07a66a` fix-up. Phase 4 (#18 phys-iter scorer mode) follows.

---

## Scope Check

This plan is one deliverable: `--want-late N,M` syntax + the polarity-classifier update + validation on lbDvd. It does NOT build:

- `--want-after PRECEDING,TARGETS` syntax (relative-ordering constraints; deferred item #17 Fix B and beyond)
- Combined front+late targets in the same spec (would need a more complex scorer; defer if a real function needs it)
- Phys-iter scorer mode (Phase 4)

In scope:
- `simplify_order_target_late: tuple[int, ...]` field on `SimplifyOrderTargetSpec` (mutually exclusive with `simplify_order_target`)
- Suffix-matching scoring logic
- `classify_polarity(force_phys, target_position="late")` returning SAFE for high-volatile, WRONG for top-down-dispense physicals
- `--want-late N,M` CLI flag (mutually exclusive with `--want-first`)
- `permuter_config` renders `simplify_order_target_late` instead of `simplify_order_target` when set
- `--breakdown` shows the observed suffix and the right polarity diagnostic
- SKILL.md update documenting `--want-late` and updating the existing WRONG POLARITY hint to point to the actual flag
- Local validation against a re-built lbDvd target.yaml
- Remote validation campaign brief

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` | Modify | Add `simplify_order_target_late` field; extend `classify_polarity` with `target_position`; extend `compute_lex_score` to handle late mode |
| `tools/melee-agent/src/cli/debug.py` | Modify | Add `--want-late` to setup CLI (mutually exclusive with `--want-first`); update breakdown to show suffix; update polarity hint to suggest actual `--want-late` flag |
| `tools/melee-agent/src/mwcc_debug/permuter_config.py` | Modify | Render `simplify_order_target_late` in target.yaml when set |
| `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` | Modify | Tests for the new field + scoring + polarity-direction extension |
| `tools/melee-agent/tests/test_cli_score_simplify_order.py` | Modify | Tests for --breakdown late-mode output |
| `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` | Modify | Tests for --want-late flag + mutual exclusion with --want-first |
| `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` | Modify | Test for simplify_order_target_late rendering |
| `.claude/skills/mwcc-debug/SKILL.md` | Modify | Document --want-late in Stuck-function workflow; update WRONG POLARITY hint |

---

## Task 1: Suffix-matching helper in scoring module

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add helper function)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add helper tests)

- [ ] **Step 1.1: Write helper tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
from src.mwcc_debug.simplify_order_scoring import (
    common_suffix_length,
)


def test_common_suffix_length_full_match() -> None:
    """When the observed suffix matches the target exactly, returns target_len."""
    observed = (10, 20, 46, 44)
    target = (46, 44)
    assert common_suffix_length(observed, target) == 2


def test_common_suffix_length_partial_match() -> None:
    """Returns the length of the longest matching suffix."""
    observed = (10, 20, 99, 44)  # only last element matches target's last
    target = (46, 44)
    assert common_suffix_length(observed, target) == 1


def test_common_suffix_length_no_match() -> None:
    """Zero when no suffix matches."""
    observed = (10, 20, 30)
    target = (46, 44)
    assert common_suffix_length(observed, target) == 0


def test_common_suffix_length_empty_observed() -> None:
    """Empty observed → 0."""
    observed: tuple[int, ...] = ()
    target = (46, 44)
    assert common_suffix_length(observed, target) == 0


def test_common_suffix_length_empty_target() -> None:
    """Empty target → 0 (no target positions to match)."""
    observed = (10, 20, 46, 44)
    target: tuple[int, ...] = ()
    assert common_suffix_length(observed, target) == 0


def test_common_suffix_length_observed_shorter_than_target() -> None:
    """If observed is shorter than target, can match at most observed length."""
    observed = (44,)  # only 1 element
    target = (46, 44)  # but target wants 2 at the end
    # observed[-1:] == (44,), target[-1:] == (44,) → match length 1
    assert common_suffix_length(observed, target) == 1


def test_common_suffix_length_target_subset_of_observed() -> None:
    """Long observed with short target — match starts from the end."""
    observed = (1, 2, 3, 4, 5, 46, 44)
    target = (46, 44)
    assert common_suffix_length(observed, target) == 2
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "common_suffix_length" -v`
Expected: 7 failures (`ImportError: cannot import name 'common_suffix_length'`).

- [ ] **Step 1.3: Implement the helper**

Add to `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, in a sensible location near the other scoring utilities (or near the top, before `classify_polarity`):

```python
def common_suffix_length(
    observed: tuple[int, ...],
    target: tuple[int, ...],
) -> int:
    """Return the length of the longest suffix of `observed` that matches
    the corresponding suffix of `target`.

    Mirror of the existing prefix-match logic but anchored from the end.
    Used by `compute_lex_score` when `spec.simplify_order_target_late` is
    set (i.e., target nodes should appear at the END of simplify order).

    Args:
        observed: The candidate's filtered simplify-order positions.
        target: The desired sequence at the end of simplify order.

    Returns:
        Integer count of matching positions from the end. Zero if either
        sequence is empty, or if they don't match at the last position.
    """
    if not observed or not target:
        return 0
    n = min(len(observed), len(target))
    matched = 0
    for i in range(1, n + 1):
        if observed[-i] == target[-i]:
            matched += 1
        else:
            break
    return matched
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "common_suffix_length" -v`
Expected: 7 passes.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add common_suffix_length helper

Adds common_suffix_length(observed, target) to the scoring module.
Mirror of the existing prefix-match logic but anchored from the end —
used by compute_lex_score when the target specifies that ig_idx values
should appear at the END of simplify order (deferred debt #20 Phase 3
late-target syntax).

Pure function with no I/O. Score-function integration lands in
follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `simplify_order_target_late` field to SimplifyOrderTargetSpec

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add field + YAML loader support)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add field tests)

- [ ] **Step 2.1: Write tests for the new field**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
def test_load_spec_simplify_order_target_late(tmp_path: Path) -> None:
    """Specs with simplify_order_target_late parse correctly."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: lbDvd_test
        simplify_order_target_late: [46, 44]
        class_id: 0
        baseline_dump: base.txt
        force_phys:
          44: 10
          46: 12
        """,
    )
    spec = load_simplify_order_target_spec(spec_path)
    assert spec.simplify_order_target_late == (46, 44)
    # The front target should be empty when only late is provided
    assert spec.simplify_order_target == ()


def test_load_spec_simplify_order_target_late_default_empty(tmp_path: Path) -> None:
    """Specs without simplify_order_target_late default to empty tuple."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_test
        simplify_order_target: [34, 37, 32]
        class_id: 0
        baseline_dump: base.txt
        """,
    )
    spec = load_simplify_order_target_spec(spec_path)
    assert spec.simplify_order_target_late == ()
    assert spec.simplify_order_target == (34, 37, 32)


def test_load_spec_rejects_both_target_fields(tmp_path: Path) -> None:
    """Cannot have both simplify_order_target and simplify_order_target_late."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: x
        simplify_order_target: [1, 2]
        simplify_order_target_late: [3, 4]
        class_id: 0
        baseline_dump: base.txt
        """,
    )
    with pytest.raises(
        SimplifyOrderSpecError,
        match="mutually exclusive|both.*target",
    ):
        load_simplify_order_target_spec(spec_path)


def test_load_spec_requires_at_least_one_target(tmp_path: Path) -> None:
    """At least one of simplify_order_target or simplify_order_target_late
    must be provided."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: x
        class_id: 0
        baseline_dump: base.txt
        """,
    )
    with pytest.raises(
        SimplifyOrderSpecError,
        match="missing.*simplify_order_target",
    ):
        load_simplify_order_target_spec(spec_path)


def test_load_spec_simplify_order_target_late_rejects_non_int(tmp_path: Path) -> None:
    """simplify_order_target_late entries must be integers."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: x
        simplify_order_target_late: ["a", "b"]
        class_id: 0
        baseline_dump: base.txt
        """,
    )
    with pytest.raises(
        SimplifyOrderSpecError,
        match="simplify_order_target_late.*integer",
    ):
        load_simplify_order_target_spec(spec_path)
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "simplify_order_target_late or rejects_both_target_fields or requires_at_least_one_target" -v`
Expected: 5 failures.

- [ ] **Step 2.3: Extend the dataclass**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, find `SimplifyOrderTargetSpec`. Make two changes:

1. Add the new field at the end:

```python
@dataclass(frozen=True)
class SimplifyOrderTargetSpec:
    """Configuration for the score-simplify-order command.

    [existing docstring...]

    Fields:
      function: [existing]
      simplify_order_target: [existing — represents front-target positions]
      class_id: [existing]
      baseline_dump: [existing]
      force_phys: [existing]
      coalesce_preservation: [existing]
      simplify_order_target_late: ig_idx sequence we want at the END of
        class `class_id`'s simplify order (the suffix). Mutually
        exclusive with `simplify_order_target` — the loader rejects
        specs that set both. Used when target physicals are
        high-volatile (r10-r12), in which case the target ig_idx values
        need to be processed LAST so MWCC's volatile dispense (lowest
        free bit first from workingMask) gives them the high registers.
        Deferred-debt #20 Phase 3 (2026-05-27).
    """

    function: str
    simplify_order_target: tuple[int, ...]
    class_id: int
    baseline_dump: Path
    force_phys: Mapping[int, int] = field(default_factory=dict)
    coalesce_preservation: bool = True
    simplify_order_target_late: tuple[int, ...] = ()
```

2. Update `load_simplify_order_target_spec` to parse the new field and enforce mutual exclusion. Locate the existing `simplify_order_target` parsing block (which currently raises if `simplify_order_target` is missing). Change the validation logic:

```python
    raw_target = data.get("simplify_order_target")
    raw_target_late = data.get("simplify_order_target_late")

    if raw_target is not None and raw_target_late is not None:
        raise SimplifyOrderSpecError(
            f"target spec {path}: 'simplify_order_target' and "
            f"'simplify_order_target_late' are mutually exclusive — "
            f"specify exactly one"
        )

    if raw_target is None and raw_target_late is None:
        raise SimplifyOrderSpecError(
            f"target spec {path}: missing 'simplify_order_target' or "
            f"'simplify_order_target_late' list"
        )

    # Parse whichever is present
    target: list[int] = []
    target_late: list[int] = []

    if raw_target is not None:
        if not isinstance(raw_target, (list, tuple)):
            raise SimplifyOrderSpecError(
                f"target spec {path}: 'simplify_order_target' must be a "
                f"list of integers, got {type(raw_target).__name__}"
            )
        for i, v in enumerate(raw_target):
            if not isinstance(v, int) or isinstance(v, bool):
                raise SimplifyOrderSpecError(
                    f"target spec {path}: 'simplify_order_target[{i}]' = "
                    f"{v!r} is not an integer"
                )
            target.append(v)

    if raw_target_late is not None:
        if not isinstance(raw_target_late, (list, tuple)):
            raise SimplifyOrderSpecError(
                f"target spec {path}: 'simplify_order_target_late' must be "
                f"a list of integers, got {type(raw_target_late).__name__}"
            )
        for i, v in enumerate(raw_target_late):
            if not isinstance(v, int) or isinstance(v, bool):
                raise SimplifyOrderSpecError(
                    f"target spec {path}: "
                    f"'simplify_order_target_late[{i}]' = "
                    f"{v!r} is not an integer"
                )
            target_late.append(v)
```

Then in the final `return SimplifyOrderTargetSpec(...)` block, pass `simplify_order_target_late=tuple(target_late)` alongside the existing fields.

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add simplify_order_target_late to SimplifyOrderTargetSpec

Adds an optional `simplify_order_target_late: tuple[int, ...]` field
that encodes "target ig_idx values should appear at the END of
simplify order." Mutually exclusive with the existing
`simplify_order_target` (front-target) — the loader rejects specs
that set both.

The new field is for cases where target physicals are high-volatile
(r10-r12) and MWCC's volatile dispense (lowest free bit first) only
reaches them when the target virtuals are processed LATE in the
simplify queue. Phase 1's polarity check flagged these as WRONG
POLARITY against `--want-first`; this is the alternative syntax.

This is plumbing for the scorer logic in compute_lex_score (Phase 3).
Score integration lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend compute_lex_score with late-mode scoring

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (extend score function)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add late-mode tests)

- [ ] **Step 3.1: Write late-mode score tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
def test_compute_lex_score_late_full_match(tmp_path: Path) -> None:
    """Late-mode: observed ends with [46, 44] exactly → common_suffix_length=2,
    score = (2-2)*LEX_BIG + distance = distance only."""
    # Build a baseline with a known simplify order, candidate with the
    # target ig_idx at the END of simplify order.
    # Use whatever existing fixture pattern the file uses; the key is
    # to construct a candidate whose filtered simplify order ends with
    # [46, 44] and a spec with simplify_order_target_late=[46, 44].
    ...
    # Assert score < LEX_BIG (no prefix-miss penalty since suffix is full)
    assert result.score < LEX_BIG
    assert result.common_suffix_length == 2  # if the result exposes this
    # Or whatever the equivalent field is — match what the implementation
    # adds to SimplifyOrderScoreResult


def test_compute_lex_score_late_partial_match(tmp_path: Path) -> None:
    """Late-mode: observed ends with [99, 44] → only last position matches,
    common_suffix_length=1, score = (2-1)*LEX_BIG + distance."""
    ...
    assert LEX_BIG <= result.score < 2 * LEX_BIG


def test_compute_lex_score_late_no_match(tmp_path: Path) -> None:
    """Late-mode: observed ends with unrelated values → 0 common suffix."""
    ...
    assert result.score >= 2 * LEX_BIG


def test_compute_lex_score_late_constraint_still_applies(tmp_path: Path) -> None:
    """Late-mode + coalesce-preservation: a coalesced target ig_idx still
    triggers structural rejection, regardless of which target syntax is
    used."""
    # Build a candidate where ig_idx 46 (in the late target) is coalesced.
    # Expected: score == STRUCTURAL_REJECTION_SCORE, structural_rejection=True
    ...
    assert result.score == STRUCTURAL_REJECTION_SCORE
    assert result.structural_rejection is True


def test_compute_lex_score_uses_late_when_late_set(tmp_path: Path) -> None:
    """If spec.simplify_order_target_late is non-empty, compute_lex_score
    uses suffix matching (not prefix matching)."""
    # Build a candidate whose simplify order ends with [46, 44] but does
    # NOT start with them. Spec uses simplify_order_target_late=[46, 44].
    # Expected: full match (common_suffix_length=2).
    # If the function were buggy and still used prefix matching, the
    # score would show common_prefix=0 and a large miss penalty.
    ...
    assert result.common_suffix_length == 2  # or whatever field name
```

The implementer reads the existing `compute_lex_score` test fixtures (added in Phase 2 Task 3) and mirrors that pattern. The new tests need a candidate-pcdump construction that lets the implementer control the simplify order so they can produce specific suffix shapes.

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "compute_lex_score_late" -v`
Expected: 5 failures.

- [ ] **Step 3.3: Extend compute_lex_score**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, find `compute_lex_score`. Add a new field to `SimplifyOrderScoreResult` for the suffix length (parallel to whatever the existing prefix length field is):

```python
@dataclass(frozen=True)
class SimplifyOrderScoreResult:
    # ... existing fields preserved (score, common_prefix_length, etc.) ...
    common_suffix_length: int = 0
```

Then in `compute_lex_score`, branch on `spec.simplify_order_target_late`. Pseudocode (adapt to actual code shape):

```python
def compute_lex_score(
    baseline: BaselineSignature,
    candidate: BaselineSignature,
    target: tuple[int, ...],
    *,
    candidate_events=None,
    spec=None,
) -> SimplifyOrderScoreResult:
    # ... existing setup ...

    # ... existing coalesce-preservation check (from Phase 2 Task 3) ...
    if (spec is not None
        and spec.coalesce_preservation
        and spec.force_phys
        and candidate_events is not None):
        coalesced = find_coalesced_targets(
            candidate_events,
            targets=set(spec.force_phys.keys()),
            class_id=spec.class_id,
        )
        if coalesced:
            return SimplifyOrderScoreResult(
                score=STRUCTURAL_REJECTION_SCORE,
                # ... other fields ...
                structural_rejection=True,
                coalesced_targets=frozenset(coalesced),
            )

    # New: determine which target mode we're in
    target_late = spec.simplify_order_target_late if spec is not None else ()
    if target_late:
        # Late mode: suffix-match
        observed = candidate.filtered_simplify_order  # whatever the field is
        common_suffix = common_suffix_length(observed, target_late)
        target_len = len(target_late)
        score = (target_len - common_suffix) * LEX_BIG + distance.total
        return SimplifyOrderScoreResult(
            score=score,
            # ... existing fields ...
            common_prefix_length=0,
            common_suffix_length=common_suffix,
            # ... etc.
        )

    # Existing: front-mode prefix-match (unchanged)
    common_prefix = score_simplify_order(...)
    target_len = len(target)
    score = (target_len - common_prefix) * LEX_BIG + distance.total
    return SimplifyOrderScoreResult(
        score=score,
        # ... existing fields ...
        common_prefix_length=common_prefix,
        common_suffix_length=0,
    )
```

The exact field names depend on the existing code. The implementer reads the current `compute_lex_score` and adapts the branch insertion.

**Important:** the late branch must coexist cleanly with the coalesce-preservation check from Phase 2 Task 3. The coalesce check runs FIRST, regardless of target mode. If it rejects, the function returns immediately with the rejection sentinel — the late-mode score path doesn't run.

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: late-target mode in compute_lex_score

When spec.simplify_order_target_late is non-empty, compute_lex_score
switches from prefix-matching against simplify_order_target to
suffix-matching against simplify_order_target_late. Score encoding
is parallel to the front-mode encoding:
  score = (target_len - common_suffix_length) * LEX_BIG + distance

Adds common_suffix_length to SimplifyOrderScoreResult so the
breakdown CLI can render the new field. The coalesce-preservation
constraint (Phase 2) is checked BEFORE the target-mode branch, so
it applies equally to front-mode and late-mode targets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update classify_polarity with target_position parameter

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (extend polarity classifier)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (test new direction)

- [ ] **Step 4.1: Write tests for target_position**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
def test_classify_polarity_late_high_volatile_safe() -> None:
    """For --want-late, high-volatile (r10-r12) is the CORRECT polarity."""
    polarity = classify_polarity(
        {44: 10, 46: 12},
        target_position="late",
    )
    assert polarity is Polarity.SAFE


def test_classify_polarity_late_top_non_volatile_wrong() -> None:
    """For --want-late, top-down non-volatiles (r28-r31) are the WRONG
    polarity (they're dispensed first by obtain_nonvolatile_register, so
    target ig_idx at end won't get them)."""
    polarity = classify_polarity(
        {34: 31, 37: 30},
        target_position="late",
    )
    assert polarity is Polarity.WRONG_POLARITY


def test_classify_polarity_late_r3_wrong() -> None:
    """For --want-late, r3 (lowest workingMask bit) is wrong polarity
    (consumed first; target at end won't get it)."""
    polarity = classify_polarity(
        {44: 3},
        target_position="late",
    )
    assert polarity is Polarity.WRONG_POLARITY


def test_classify_polarity_late_mid_volatile_uncertain() -> None:
    """For --want-late, mid-volatile (r4-r9) is UNCERTAIN — depends on
    interference."""
    polarity = classify_polarity(
        {44: 5, 46: 6},
        target_position="late",
    )
    assert polarity is Polarity.UNCERTAIN


def test_classify_polarity_late_empty_safe() -> None:
    """Empty force_phys with target_position=late: SAFE (no targets to check)."""
    polarity = classify_polarity({}, target_position="late")
    assert polarity is Polarity.SAFE


def test_classify_polarity_default_position_is_first() -> None:
    """Default target_position=first preserves Phase 1 behavior."""
    # r10-r12 was WRONG_POLARITY in Phase 1's classifier
    polarity = classify_polarity({44: 10, 46: 12})  # no target_position kw
    assert polarity is Polarity.WRONG_POLARITY  # same as target_position=first


def test_classify_polarity_first_high_volatile_still_wrong() -> None:
    """Explicit target_position=first preserves the Phase 1 classification."""
    polarity = classify_polarity(
        {44: 10, 46: 12},
        target_position="first",
    )
    assert polarity is Polarity.WRONG_POLARITY
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "classify_polarity_late or classify_polarity_default_position or first_high_volatile_still_wrong" -v`
Expected: Failures (the function doesn't accept `target_position` yet).

- [ ] **Step 4.3: Extend classify_polarity**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, find `classify_polarity`. Add a module-level constant for the additional "wrong polarity in the late direction" set, then update the function signature + body:

```python
from typing import Literal


# Top-down non-volatile dispense order from obtain_nonvolatile_register.
# These are the first non-volatiles MWCC dispenses to virtuals that need
# a callee-save. For target_position="late", target physicals in this set
# are the WRONG polarity — they go to virtuals processed EARLY in the
# colorgraph, but --want-late puts target ig_idx at the END.
TOP_NON_VOLATILE_REGS: frozenset[int] = frozenset({28, 29, 30, 31})


def classify_polarity(
    force_phys: Mapping[int, int],
    *,
    target_position: Literal["first", "late"] = "first",
) -> Polarity:
    """Classify whether the target syntax matches the dispense direction
    implied by the target physicals.

    Args:
        force_phys: Mapping of ig_idx -> physical register number.
        target_position: Which end of simplify order the target syntax
            anchors to. "first" (default) corresponds to --want-first
            (target ig_idx values at the START of simplify order).
            "late" corresponds to --want-late (target ig_idx values at
            the END of simplify order). Phase 1 shipped target_position
            handling for "first" only; Phase 3 added "late" support.

    Returns:
        SAFE if force_phys is empty, or if every target physical matches
        the dispense direction for the chosen target_position.
        UNCERTAIN if any target physical is mid-volatile (r4-r9) and no
        physicals are in a definitely-wrong set.
        WRONG_POLARITY if any target physical is in a set that
        structurally cannot match the chosen target_position.

    For target_position="first":
        WRONG_POLARITY when any physical is in HIGH_VOLATILE_REGS
        (r10-r12) — these can't be assigned to early virtuals via
        lowest-first volatile dispense.

    For target_position="late":
        WRONG_POLARITY when any physical is in TOP_NON_VOLATILE_REGS
        (r28-r31) — these are dispensed FIRST by
        obtain_nonvolatile_register, so target ig_idx at the end won't
        get them.
        Also WRONG_POLARITY when any physical is r3 — the lowest
        workingMask bit, consumed first by lowest-first dispense.
    """
    if not force_phys:
        return Polarity.SAFE

    if target_position == "first":
        polarity = Polarity.SAFE
        for phys in force_phys.values():
            if phys in HIGH_VOLATILE_REGS:
                return Polarity.WRONG_POLARITY
            if phys in UNCERTAIN_VOLATILE_REGS:
                polarity = Polarity.UNCERTAIN
        return polarity

    if target_position == "late":
        polarity = Polarity.SAFE
        for phys in force_phys.values():
            if phys in TOP_NON_VOLATILE_REGS or phys == 3:
                return Polarity.WRONG_POLARITY
            if phys in UNCERTAIN_VOLATILE_REGS:
                polarity = Polarity.UNCERTAIN
            # r10-r12 are SAFE for late mode (correct polarity)
            # r25-r27 are the remaining non-volatiles; treat as SAFE
            # (top-down dispense might or might not reach them by the
            # end; not the WRONG_POLARITY case the check is for)
        return polarity

    raise ValueError(f"target_position must be 'first' or 'late', got {target_position!r}")
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: classify_polarity accepts target_position

Extends classify_polarity with a keyword-only target_position
parameter (default "first" preserves Phase 1 behavior). When
target_position="late", high-volatile physicals (r10-r12) classify
as SAFE (the correct polarity for --want-late targets), while
top non-volatiles (r28-r31) and r3 classify as WRONG_POLARITY
(those are dispensed to early-processed virtuals, not late ones).

Adds TOP_NON_VOLATILE_REGS = {28,29,30,31} as the parallel constant
to HIGH_VOLATILE_REGS, used for the late-direction polarity check.

This is plumbing for the CLI integration (next task) which will
pass target_position based on which target field is set in
target.yaml.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: --want-late CLI flag on setup-simplify-order-scorer

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (add flag + mutual exclusion check)
- Modify: `tools/melee-agent/src/mwcc_debug/permuter_config.py` (render simplify_order_target_late)
- Modify: `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` (test flag)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` (test rendering)

- [ ] **Step 5.1: Write renderer tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py`:

```python
def test_render_target_yaml_with_late_target(tmp_path: Path) -> None:
    """When simplify_order_target_late is provided, render it instead
    of simplify_order_target."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml

    yaml_text = render_simplify_order_target_yaml(
        function="lbDvd_test",
        simplify_order_target=(),
        simplify_order_target_late=(46, 44),
        class_id=0,
        baseline_dump=tmp_path / "base.txt",
        force_phys={44: 10, 46: 12},
    )
    assert "simplify_order_target_late: [46, 44]" in yaml_text
    # The front target key should NOT appear when only late is set
    assert "simplify_order_target:" not in yaml_text


def test_render_target_yaml_late_roundtrip(tmp_path: Path) -> None:
    """Rendered YAML with simplify_order_target_late loads back correctly."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml
    from src.mwcc_debug.simplify_order_scoring import load_simplify_order_target_spec

    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump", encoding="utf-8")
    yaml_text = render_simplify_order_target_yaml(
        function="lbDvd_test",
        simplify_order_target=(),
        simplify_order_target_late=(46, 44),
        class_id=0,
        baseline_dump=baseline,
        force_phys={44: 10, 46: 12},
    )
    spec_path = tmp_path / "target.yaml"
    spec_path.write_text(yaml_text, encoding="utf-8")

    spec = load_simplify_order_target_spec(spec_path)
    assert spec.simplify_order_target_late == (46, 44)
    assert spec.simplify_order_target == ()
```

- [ ] **Step 5.2: Run renderer tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -k "late" -v`
Expected: 2 failures.

- [ ] **Step 5.3: Update render_simplify_order_target_yaml**

In `tools/melee-agent/src/mwcc_debug/permuter_config.py`, extend the function signature with `simplify_order_target_late`. Make either `simplify_order_target` OR `simplify_order_target_late` required (mirroring the loader's mutual-exclusion enforcement). Modify the body to render whichever is non-empty:

```python
def render_simplify_order_target_yaml(
    *,
    function: str,
    simplify_order_target: tuple[int, ...] | list[int] = (),
    simplify_order_target_late: tuple[int, ...] | list[int] = (),
    class_id: int,
    baseline_dump: Path,
    force_phys: Mapping[int, int] | None = None,
    coalesce_preservation: bool = True,
) -> str:
    """Render a SimplifyOrderTargetSpec to YAML.

    Exactly one of simplify_order_target (front-target) or
    simplify_order_target_late (end-target) must be non-empty. The
    renderer emits only the non-empty one.

    [other docstring sections preserved...]
    """
    if bool(simplify_order_target) == bool(simplify_order_target_late):
        # Both empty OR both non-empty
        raise ValueError(
            "render_simplify_order_target_yaml requires exactly one of "
            "simplify_order_target or simplify_order_target_late"
        )

    lines: list[str] = [
        f"function: {function}",
    ]
    if simplify_order_target:
        lines.append(f"simplify_order_target: {list(simplify_order_target)}")
    else:
        lines.append(
            f"simplify_order_target_late: {list(simplify_order_target_late)}"
        )
    lines.extend([
        f"class_id: {class_id}",
        f"baseline_dump: {baseline_dump}",
    ])
    if force_phys:
        # [existing force_phys block]
        ...
    if not coalesce_preservation:
        lines.append("coalesce_preservation: false")
    return "\n".join(lines) + "\n"
```

The XOR-style mutual exclusion check is important: if a caller forgets to set either, they should get a clear error rather than producing an invalid YAML.

- [ ] **Step 5.4: Run renderer tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -v`
Expected: All tests pass.

- [ ] **Step 5.5: Write setup CLI tests**

Append to `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py`:

```python
def test_setup_want_late_writes_simplify_order_target_late(
    tmp_path: Path, monkeypatch
) -> None:
    """`--want-late 46,44` writes simplify_order_target_late to target.yaml."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    perm_dir = _make_perm_dir(tmp_path, "lbDvd_test")
    baseline = _make_baseline_dump(tmp_path)
    _stub_wibo_and_compiler(monkeypatch)

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "lbDvd_test",
            "--want-late", "46,44",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force-phys", "44:10,46:12",
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    content = (perm_dir / "simplify_order_target.yaml").read_text(encoding="utf-8")
    assert "simplify_order_target_late: [46, 44]" in content
    assert "simplify_order_target:" not in content


def test_setup_want_first_and_want_late_mutually_exclusive(
    tmp_path: Path, monkeypatch
) -> None:
    """Passing both --want-first and --want-late is an error."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    perm_dir = _make_perm_dir(tmp_path, "x")
    baseline = _make_baseline_dump(tmp_path)
    _stub_wibo_and_compiler(monkeypatch)

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "x",
            "--want-first", "1,2",
            "--want-late", "3,4",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force",
        ],
    )

    assert result.exit_code != 0
    output = result.output.lower()
    assert "mutually exclusive" in output or "both" in output


def test_setup_neither_want_first_nor_want_late_errors(
    tmp_path: Path, monkeypatch
) -> None:
    """Passing neither --want-first nor --want-late is an error."""
    from typer.testing import CliRunner
    from src.cli.debug import debug_app

    perm_dir = _make_perm_dir(tmp_path, "x")
    baseline = _make_baseline_dump(tmp_path)
    _stub_wibo_and_compiler(monkeypatch)

    runner = CliRunner()
    result = runner.invoke(
        debug_app,
        [
            "permute",
            "setup-simplify-order-scorer",
            "-f", "x",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force",
        ],
    )

    assert result.exit_code != 0
```

- [ ] **Step 5.6: Run setup CLI tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -k "want_late or want_first_and_want_late or neither_want_first_nor_want_late" -v`
Expected: Failures.

- [ ] **Step 5.7: Add --want-late flag**

In `tools/melee-agent/src/cli/debug.py`, find `setup_simplify_order_scorer`. The existing `--want-first` parameter is a string like `"34,37,32"`. Add a parallel `--want-late` parameter and enforce mutual exclusion + at-least-one-required:

```python
    want_first: Optional[str] = typer.Option(
        None,
        "--want-first",
        help=(
            "Target ig_idx sequence at the START of simplify order, "
            "comma-separated (e.g., '34,37,32'). Mutually exclusive "
            "with --want-late."
        ),
    ),
    want_late: Optional[str] = typer.Option(
        None,
        "--want-late",
        help=(
            "Target ig_idx sequence at the END of simplify order, "
            "comma-separated (e.g., '46,44'). Mutually exclusive with "
            "--want-first. Use for high-volatile target physicals "
            "(r10-r12) per deferred-debt #20 Phase 3."
        ),
    ),
```

(The current `--want-first` is likely already `Optional[str]` from prior tasks — if not, change it.)

After parsing both, enforce the mutual exclusion + at-least-one requirement:

```python
    if want_first is not None and want_late is not None:
        typer.echo(
            "error: --want-first and --want-late are mutually exclusive",
            err=True,
        )
        raise typer.Exit(code=2)
    if want_first is None and want_late is None:
        typer.echo(
            "error: must specify exactly one of --want-first or --want-late",
            err=True,
        )
        raise typer.Exit(code=2)

    parsed_targets: tuple[int, ...] = ()
    parsed_targets_late: tuple[int, ...] = ()
    if want_first is not None:
        parsed_targets = tuple(int(s.strip()) for s in want_first.split(",") if s.strip())
    if want_late is not None:
        parsed_targets_late = tuple(int(s.strip()) for s in want_late.split(",") if s.strip())
```

Then update the call to `render_simplify_order_target_yaml` to pass both:

```python
    yaml_text = render_simplify_order_target_yaml(
        function=function,
        simplify_order_target=parsed_targets,
        simplify_order_target_late=parsed_targets_late,
        class_id=class_id,
        baseline_dump=resolved_baseline,
        force_phys=parsed_force_phys or None,
        coalesce_preservation=coalesce_preservation,
    )
```

- [ ] **Step 5.8: Run setup tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -v`
Expected: All tests pass.

- [ ] **Step 5.9: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/src/mwcc_debug/permuter_config.py \
        tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py \
        tools/melee-agent/tests/test_mwcc_debug_permuter_config.py
git commit -m "$(cat <<'EOF'
feat: --want-late flag on setup-simplify-order-scorer

Adds --want-late as a parallel target-syntax flag to --want-first.
Mutually exclusive with --want-first; exactly one must be specified.
Captured into target.yaml's simplify_order_target_late field.

For high-volatile target physicals (r10-r12), --want-late N,M
encodes "ig_idx N and M should appear at the END of simplify order"
— the correct polarity for MWCC's lowest-first volatile dispense.
Deferred-debt #20 Phase 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update --breakdown to show late-mode + correct polarity hint

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (extend --breakdown output for late mode + polarity-direction-aware)
- Modify: `tools/melee-agent/tests/test_cli_score_simplify_order.py` (test late-mode breakdown)

- [ ] **Step 6.1: Write tests**

Append to `tools/melee-agent/tests/test_cli_score_simplify_order.py`:

```python
def test_breakdown_late_mode_shows_observed_suffix(tmp_path: Path) -> None:
    """Late-mode target → --breakdown shows the observed suffix and the
    target suffix instead of prefix."""
    # Build a spec with simplify_order_target_late=[46, 44]
    # Run --breakdown
    # Assert "Target suffix:" (or similar wording) appears
    # Assert "Observed suffix:" appears
    # The current "Target prefix:" / "Observed prefix:" lines should NOT
    # appear (those are for front-mode)
    ...


def test_breakdown_late_mode_polarity_safe_for_high_volatile(tmp_path: Path) -> None:
    """Late-mode + high-volatile target → polarity SAFE."""
    # Build spec with simplify_order_target_late=[46,44] + force_phys={44:10, 46:12}
    # Run --breakdown
    # Assert "Polarity check:" → "SAFE"
    # NOT "WRONG POLARITY"
    ...


def test_breakdown_late_mode_polarity_wrong_for_top_non_volatile(
    tmp_path: Path,
) -> None:
    """Late-mode + r28-r31 target → WRONG POLARITY (wrong direction)."""
    # Build spec with simplify_order_target_late=[34,37] + force_phys={34:31, 37:30}
    # Run --breakdown
    # Assert "Polarity check:" → "WRONG POLARITY"
    # The hint should mention --want-first (since the target physicals
    # actually want first-position semantics)
    ...


def test_breakdown_first_mode_polarity_wrong_hint_mentions_want_late(
    tmp_path: Path,
) -> None:
    """Phase 1's hint text said --want-late is "future work"; Phase 3
    lands the flag so the hint should now actively recommend it."""
    # Build spec with simplify_order_target=[46,44] + force_phys={44:10, 46:12}
    # (front-mode targeting high-volatile — Phase 1's wrong-polarity case)
    # Run --breakdown
    # Assert "WRONG POLARITY"
    # Assert "--want-late" in output (active recommendation, not "future")
    # The text should NOT say "deferred debt #20 full" — that's stale.
    ...
```

- [ ] **Step 6.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -k "late_mode or want_late_or_recommends_want_late" -v`
Expected: Multiple failures.

- [ ] **Step 6.3: Update --breakdown rendering**

In `tools/melee-agent/src/cli/debug.py`, find the existing `--breakdown` rendering in `score_simplify_order`. Three changes:

1. **Branch on late-mode for the prefix/suffix lines.** When `spec.simplify_order_target_late` is non-empty, render:

```python
        if spec.simplify_order_target_late:
            print(f"Target suffix:     {list(spec.simplify_order_target_late)}")
            print(f"Observed suffix:   {list(result.observed_suffix or [])}")
            print(f"Common suffix:     {result.common_suffix_length} / {len(spec.simplify_order_target_late)}")
        else:
            print(f"Target prefix:     {list(spec.simplify_order_target)}")
            print(f"Observed prefix:   {list(result.observed_prefix or [])}")
            print(f"Common prefix:     {result.common_prefix_length} / {len(spec.simplify_order_target)}")
```

(Adapt to the actual existing variable names in the code.)

2. **Update the polarity check call to pass target_position.** Find the existing `classify_polarity(spec.force_phys)` call. Change to:

```python
        target_position = "late" if spec.simplify_order_target_late else "first"
        polarity = classify_polarity(spec.force_phys, target_position=target_position)
```

3. **Update the WRONG POLARITY hint text** to recommend the actual flag instead of "future work":

```python
            if polarity is Polarity.WRONG_POLARITY:
                print("Polarity check:    WRONG POLARITY")
                if target_position == "first":
                    print(
                        "  At least one target physical is in the high-volatile "
                        "range (r10-r12). MWCC's volatile dispense is lowest-"
                        "first, so target ig_idx values at simplify positions "
                        "0/1/... get r3/r4/... not r10-r12. --want-first is the "
                        "wrong polarity for this target."
                    )
                    print(
                        "  Recommend: switch to `--want-late N,M` (Phase 3 of "
                        "deferred debt #20, shipped). The target ig_idx values "
                        "need to be at the END of simplify order so the lower "
                        "volatiles are consumed first."
                    )
                else:  # target_position == "late"
                    print(
                        "  At least one target physical is in the top "
                        "non-volatile range (r28-r31) or is r3. Those are "
                        "dispensed FIRST by MWCC's allocator, so target "
                        "ig_idx values at the END of simplify order won't "
                        "get them. --want-late is the wrong polarity for "
                        "this target."
                    )
                    print(
                        "  Recommend: switch to `--want-first N,M`. The "
                        "target ig_idx values should be at the START of "
                        "simplify order."
                    )
```

- [ ] **Step 6.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -v`
Expected: All tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_cli_score_simplify_order.py
git commit -m "$(cat <<'EOF'
feat: --breakdown rendering for late-mode targets

When spec.simplify_order_target_late is set, --breakdown renders
"Target suffix:", "Observed suffix:", "Common suffix:" instead of
the prefix variants. Polarity check is direction-aware: late-mode
WRONG POLARITY now points at top non-volatiles (r28-r31) and r3
rather than high-volatiles.

Updates the front-mode WRONG POLARITY hint text to actively
recommend --want-late (Phase 3 of deferred debt #20 is shipped),
replacing the stale "future work" language from Phase 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update SKILL.md docs

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md` (document --want-late in workflow + Step 0)

- [ ] **Step 7.1: Locate the relevant sections**

Open `.claude/skills/mwcc-debug/SKILL.md` and find:
- The "Stuck-function workflow with custom simplify-order scorer" section
- The Step 0 pre-flight check subsection (currently three checks per Phase 2 Task 6)
- The example command(s) showing `--want-first ...`

- [ ] **Step 7.2: Extend the workflow with --want-late as an alternative**

Add a brief subsection or paragraph (placement: just after the existing Step 0 description, before the example commands) documenting:

```markdown
**Two target-syntax options:** depending on the function's target
physical class, pick the right syntax:

- **`--want-first N,M`** (Phase 1/2): target `ig_idx` values appear at
  the **start** of simplify order. Use when target physicals are
  non-volatile (r25–r31) or r3.
- **`--want-late N,M`** (Phase 3): target `ig_idx` values appear at the
  **end** of simplify order. Use when target physicals are high-volatile
  (r10–r12). MWCC's volatile dispense is lowest-first, so high-volatile
  targets need to be processed LATE so lower volatiles are consumed first.

Step 0's polarity check tells you which to use. If the breakdown reports
**WRONG POLARITY** with `--want-first`, the hint will recommend switching
to `--want-late` (and vice versa).
```

The exact location and surrounding wording depend on the current SKILL.md state. Adapt while preserving the spirit: document `--want-late` as a real, currently-available flag (not "future work").

- [ ] **Step 7.3: Update the example commands**

If the SKILL.md has example commands like `--want-first 42,32` in the Stuck-function workflow, leave them as-is (they're valid for grVenom-style functions). Just ensure there's at least one example showing `--want-late` for the high-volatile case — could be a comment in the polarity-check section, or a sibling example block.

- [ ] **Step 7.4: Commit**

```bash
git add -f .claude/skills/mwcc-debug/SKILL.md
git commit -m "$(cat <<'EOF'
docs: document --want-late in Stuck-function workflow

Phase 3 of deferred-debt #20 shipped the late-target scorer syntax.
SKILL.md now describes both --want-first and --want-late as live
options, with guidance on which to use based on target physical
class:
- --want-first for non-volatile (r25-r31) or r3 targets
- --want-late for high-volatile (r10-r12) targets

Step 0's polarity check tells the agent which to use; the hints in
--breakdown actively recommend the correct flag when polarity is
wrong.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Local validation against lbDvd target

**Files:**
- No files modified. This task validates the build against the canonical lbDvd_80018A2C case.

- [ ] **Step 8.1: Build a target.yaml with --want-late for lbDvd**

In a temp dir:

```bash
mkdir -p /tmp/late-target-acceptance
cd /tmp/late-target-acceptance

# Use the lbDvd baseline pcdump (regenerate if not cached)
touch base.txt

cat > target.yaml <<EOF
function: lbDvd_80018A2C
simplify_order_target_late: [46, 44]
class_id: 0
baseline_dump: $(pwd)/base.txt
force_phys:
  44: 10
  46: 12
EOF
```

If the lbDvd baseline pcdump doesn't exist, generate it via `melee-agent debug dump local <path-to-lbdvd-source> --function lbDvd_80018A2C --output ./base.txt`.

- [ ] **Step 8.2: Verify polarity reports SAFE**

Run:

```bash
echo "" > candidate.o
cp base.txt candidate.o.pcdump.txt

melee-agent debug target score-simplify-order \
  -f lbDvd_80018A2C \
  --target /tmp/late-target-acceptance/target.yaml \
  /tmp/late-target-acceptance/candidate.o \
  --breakdown
```

Expected output:
- `Target suffix: [46, 44]` (not Target prefix)
- `Polarity check: SAFE` (not WRONG POLARITY — high-volatile is correct for late mode)
- Exit code 0

If WRONG POLARITY fires, the classifier extension is incorrect — STOP and debug.

- [ ] **Step 8.3: Verify front-mode polarity still warns + suggests --want-late**

Build a front-mode variant of the same target:

```bash
cat > /tmp/late-target-acceptance/target-frontmode.yaml <<EOF
function: lbDvd_80018A2C
simplify_order_target: [46, 44]
class_id: 0
baseline_dump: $(pwd)/base.txt
force_phys:
  44: 10
  46: 12
EOF

melee-agent debug target score-simplify-order \
  -f lbDvd_80018A2C \
  --target /tmp/late-target-acceptance/target-frontmode.yaml \
  /tmp/late-target-acceptance/candidate.o \
  --breakdown
```

Expected output:
- `Polarity check: WRONG POLARITY`
- The hint text includes `--want-late` as an active recommendation (not "deferred debt #20 full" / "future work")

- [ ] **Step 8.4: Verify late-mode + r28-r31 target → WRONG POLARITY**

Build an artificial misconfigured target:

```bash
cat > /tmp/late-target-acceptance/target-wrong-late.yaml <<EOF
function: lbDvd_80018A2C
simplify_order_target_late: [46, 44]
class_id: 0
baseline_dump: $(pwd)/base.txt
force_phys:
  44: 31
  46: 30
EOF

melee-agent debug target score-simplify-order \
  -f lbDvd_80018A2C \
  --target /tmp/late-target-acceptance/target-wrong-late.yaml \
  /tmp/late-target-acceptance/candidate.o \
  --breakdown
```

Expected:
- `Polarity check: WRONG POLARITY` (top non-volatiles want first-mode)
- The hint recommends `--want-first`

- [ ] **Step 8.5: Run full test suite**

```bash
cd /Users/mike/code/melee/tools/melee-agent && pytest
```

Verify all tests pass.

- [ ] **Step 8.6: No commit (acceptance is verification only)**

If any step fails, return to the failing task and fix. If all pass, Task 9 (remote campaign brief) is ready.

---

## Task 9: Remote validation campaign brief (handed off to campaign agent)

**Files:**
- No files modified by this task directly. The campaign agent will commit a campaign writeup at completion.

- [ ] **Step 9.1: Generate the campaign brief**

After Task 8 passes, the controller writes a ready-to-send brief for the campaign agent that:
1. References Phase 3 build commits + the lbDvd campaign writeup
2. Specifies: re-import lbDvd_80018A2C, set up scorer with `--want-late 46,44` (NEW) + `--force-phys '44:10,46:12'`, launch a 200K+ iteration remote permuter run
3. Triage the surviving pool by real-tree match%
4. Report outcome categories (CLEAN SUCCESS / PARTIAL / NO PROGRESS)
5. Append findings to `docs/mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md`

The brief follows the same shape as the Phase 2 Task 8 brief (campaign agent has done this twice already).

- [ ] **Step 9.2: Await campaign results**

Standing by for the campaign agent's report. Time budget: 2-3 hours for the remote permuter run + ~15 min for triage and writeup.

- [ ] **Step 9.3: Update the roadmap based on outcome**

Three possible outcomes:

**CLEAN SUCCESS (100% match found):** Phase 3 validates #20 as the right answer end-to-end. lbDvd matches via `--want-late`. Update the roadmap to mark #20 as fully shipped. Strong empirical evidence that scoring sophistication still has unlock value for the right function shape.

**PARTIAL (best match > 99.53% but < 100%):** Phase 3 ships the constraint as a real refinement; lbDvd narrows but doesn't close. Still a useful tool for future high-volatile-target functions.

**NO PROGRESS (best match ≤ 99.53%):** Like gm_80173EEC: the scorer works correctly, but lbDvd's match neighborhood is exhausted by permuter's current mutation library. The flag ships as a tool but lbDvd specifically joins gm as a known ceiling. Strong signal that #16 (backwards inference / new mutation primitives) is the real next move, NOT Phase 4.

The outcome of Phase 3 specifically informs the Phase 4 (#18 phys-iter scorer) decision: if Phase 3 is CLEAN SUCCESS, Phase 4 has a clearer expected payoff (different shape but same kind of refinement); if Phase 3 is NO PROGRESS, Phase 4 is also unlikely to unlock anything new and we should redirect to #16 or stop building scorer extensions.

---

## Self-Review Notes

Spec coverage check:
- ✅ `common_suffix_length` helper: Task 1
- ✅ `simplify_order_target_late` field on target spec: Task 2
- ✅ Late-mode logic in `compute_lex_score`: Task 3
- ✅ `target_position` parameter on `classify_polarity`: Task 4
- ✅ `--want-late` CLI flag + mutual exclusion with `--want-first`: Task 5
- ✅ Late-mode `--breakdown` rendering + polarity hint update: Task 6
- ✅ SKILL.md documentation: Task 7
- ✅ Local validation against lbDvd: Task 8
- ✅ Remote validation campaign brief: Task 9

Placeholder scan: Tasks 3 and 6 have skeleton test bodies (`...`) where the implementer mirrors existing fixture patterns. This is intentional — the existing tests for `compute_lex_score` and `--breakdown` rendering have well-established fixture helpers that I'd be reproducing if I inlined them in the plan.

Type consistency:
- `target_position: Literal["first", "late"]` — consistent across `classify_polarity` (Task 4) and the CLI's polarity-direction selection (Task 6)
- `simplify_order_target_late: tuple[int, ...]` — added to dataclass (Task 2), referenced by renderer (Task 5), the score function (Task 3), and the breakdown rendering (Task 6)
- `common_suffix_length` field on `SimplifyOrderScoreResult` — added in Task 3, referenced by Task 6's breakdown

Forward-compatibility:
- Phase 4 (#18 phys-iter scorer) will add a third target shape. The current `target_position` enum is `Literal["first", "late"]`; Phase 4 may extend to `Literal["first", "late", "phys_iter"]` or use a separate spec entirely. No collision.

## Validation Campaign (post-merge)

Task 9 IS the validation campaign — the remote permuter run on lbDvd_80018A2C with `--want-late 46,44`. After Task 9 reports, the roadmap update closes out Phase 3.
