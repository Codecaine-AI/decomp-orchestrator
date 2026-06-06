# mwcc-debug Coalesce-Preservation Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the coalesce-preservation constraint in the custom simplify-order scorer that rejects candidates where any target `ig_idx` (from `force_phys`) has been coalesced into another root virtual. The empirical sub-experiment (commit `93e64a3de` in the gm_80173EEC campaign writeup) confirmed that 322 / 500 candidates in the existing pool preserve all 6 force-phys ig_idx as independent nodes — there's a real search neighborhood for the constraint to shape.

**Architecture:** Add a `find_coalesced_targets(events, targets, class_id) -> set[int]` helper to `simplify_order_scoring.py` that reuses the existing `colorgraph_parser` data. Extend `SimplifyOrderTargetSpec` with an optional `coalesce_preservation: bool = True` field (default-on when `force_phys` is non-empty; controls whether the constraint applies). In `compute_lex_score`, when the constraint is active and any target ig_idx is coalesced, return a sentinel "structural rejection" score (`LEX_BIG * (target_len + 1)`) that dominates any normal score and pushes the candidate to the bottom of the ranking. Add `--no-coalesce-preservation` opt-out flag on the setup CLI. Add `Coalesce preservation:` line in `score-simplify-order --breakdown` showing the check status.

**Tech Stack:** Python 3.11+, pytest, existing `colorgraph_parser` + `simplify_order_scoring` + `permuter_config`. No new dependencies.

**Spec:** Deferred technical debt item #19 in `docs/mwcc-debug-diff-roadmap.md`. Stage 1 (the empirical sub-experiment) lives in `docs/superpowers/plans/2026-05-26-mwcc-debug-coalesce-preservation.md`.

**Phase roadmap:** Phase 2 Stage 2 of 4. Phase 1 (#20 pre-flight polarity check) shipped at `ef0f95b2c`. Phase 2 Stage 1 (the empirical sub-experiment) shipped at `93e64a3de`. Phases 3 (full late-target syntax) and 4 (phys-iter scorer mode) follow.

---

## Scope Check

This plan is one deliverable: the coalesce-preservation constraint added to the existing custom scorer. It does NOT build a new scoring mode and does NOT invent late-target syntax. The constraint piggybacks on the existing `--want-first` / `force_phys` machinery from Phase 1.

Out of scope for this plan:
- Late-target syntax (Phase 3)
- Phys-iter scorer mode (Phase 4)
- Any structural rewrite of the scorer architecture
- New mutation primitives in permuter

In scope:
- `find_coalesced_targets` helper function
- Optional `coalesce_preservation` bool on `SimplifyOrderTargetSpec`
- Sentinel rejection in `compute_lex_score` when constraint triggers
- `--no-coalesce-preservation` CLI flag on `setup-simplify-order-scorer`
- `Coalesce preservation:` line in `--breakdown` output
- `permuter_config` rendering of the new field
- SKILL.md documentation update
- Local validation pass (re-score existing gm pool with constraint, verify expected rejection count)
- Remote validation campaign brief (handed off to campaign agent)

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` | Modify | Add `find_coalesced_targets` helper; extend `SimplifyOrderTargetSpec` with `coalesce_preservation`; extend `compute_lex_score` with constraint logic |
| `tools/melee-agent/src/cli/debug.py` | Modify | Add `--no-coalesce-preservation` flag to setup; add `Coalesce preservation:` line to `--breakdown` |
| `tools/melee-agent/src/mwcc_debug/permuter_config.py` | Modify | Render `coalesce_preservation` to target.yaml when explicitly disabled |
| `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` | Modify | Tests for helper + field + score logic |
| `tools/melee-agent/tests/test_cli_score_simplify_order.py` | Modify | Tests for --breakdown coalesce line |
| `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` | Modify | Tests for --no-coalesce-preservation flag |
| `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` | Modify | Test for coalesce_preservation rendering |
| `.claude/skills/mwcc-debug/SKILL.md` | Modify | Document the constraint in the Stuck-function workflow |

---

## Task 1: `find_coalesced_targets` helper in scoring module

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add helper function)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add helper tests)

- [ ] **Step 1.1: Write helper tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
from src.mwcc_debug.simplify_order_scoring import find_coalesced_targets
from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function


def _build_minimal_events_text(
    function: str,
    natural_mappings: list[tuple[int, int]],
    class_id: int = 0,
) -> str:
    """Build a minimal pcdump text with a single COALESCE section."""
    lines = [
        f"Starting function {function}",
        "",
        f"[COALESCE] enter class={class_id} n_virtuals=10",
        "[COALESCE] natural mappings (virt -> root):",
    ]
    for virt, root in natural_mappings:
        lines.append(f"  {virt} -> {root}")
    lines.extend([
        f"[COALESCE] exit class={class_id} n_virtuals=10 distinct_roots=8 forced=0",
        "",
        f"IG CONSTRUCTED (class={class_id}, n_nodes=10)",
    ])
    return "\n".join(lines)


def test_find_coalesced_targets_none_coalesced() -> None:
    """Returns empty set when no target ig_idx is coalesced."""
    text = _build_minimal_events_text(
        "test_fn",
        natural_mappings=[(5, 4), (6, 3)],  # neither 5 nor 6 in target set
    )
    events = parse_hook_events(text)
    fn = find_function(events, "test_fn")
    assert fn is not None

    result = find_coalesced_targets(fn, targets={34, 37, 32}, class_id=0)
    assert result == set()


def test_find_coalesced_targets_one_coalesced() -> None:
    """Returns the single coalesced target ig_idx."""
    text = _build_minimal_events_text(
        "test_fn",
        natural_mappings=[(38, 3), (5, 4)],  # 38 is in target set
    )
    events = parse_hook_events(text)
    fn = find_function(events, "test_fn")

    result = find_coalesced_targets(fn, targets={34, 37, 32, 38, 42, 52}, class_id=0)
    assert result == {38}


def test_find_coalesced_targets_multiple_coalesced() -> None:
    """Returns all coalesced target ig_idx values (gm_80173EEC output-139-1 case)."""
    text = _build_minimal_events_text(
        "gm_test",
        natural_mappings=[(42, 3), (38, 3), (99, 50)],  # 42, 38 in target set
    )
    events = parse_hook_events(text)
    fn = find_function(events, "gm_test")

    result = find_coalesced_targets(
        fn, targets={34, 37, 32, 42, 52, 38}, class_id=0
    )
    assert result == {42, 38}


def test_find_coalesced_targets_wrong_class_ignored() -> None:
    """Mappings in other register classes are ignored."""
    # Build text with a class-1 COALESCE section that would otherwise match
    text = _build_minimal_events_text(
        "test_fn",
        natural_mappings=[(38, 3)],
        class_id=1,  # FPR, not GPR
    )
    events = parse_hook_events(text)
    fn = find_function(events, "test_fn")

    # Looking for class 0 — class 1 coalesces should not appear
    result = find_coalesced_targets(fn, targets={38}, class_id=0)
    assert result == set()


def test_find_coalesced_targets_empty_targets_returns_empty() -> None:
    """Empty target set always returns empty (no work to do)."""
    text = _build_minimal_events_text(
        "test_fn",
        natural_mappings=[(38, 3), (42, 3)],
    )
    events = parse_hook_events(text)
    fn = find_function(events, "test_fn")

    result = find_coalesced_targets(fn, targets=set(), class_id=0)
    assert result == set()


def test_find_coalesced_targets_root_in_targets_not_coalesced() -> None:
    """A target ig_idx appearing only as a coalesce ROOT (RHS) is NOT
    coalesced — it's the destination, not the alias."""
    text = _build_minimal_events_text(
        "test_fn",
        natural_mappings=[(5, 32)],  # 32 is RHS (root); 5 aliases TO 32
    )
    events = parse_hook_events(text)
    fn = find_function(events, "test_fn")

    # 32 is a target, but appears only as the root of a coalesce. It's
    # still an independent allocator node, so it should NOT be in the
    # returned set.
    result = find_coalesced_targets(fn, targets={32}, class_id=0)
    assert result == set()
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "find_coalesced_targets" -v`
Expected: 6 failures with `ImportError: cannot import name 'find_coalesced_targets'`.

- [ ] **Step 1.3: Implement the helper**

Add to `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, after `classify_polarity` (around line 120 — verify actual line):

```python
def find_coalesced_targets(
    events,  # FunctionEvents (avoid circular import; type checked at runtime)
    *,
    targets: set[int],
    class_id: int,
) -> set[int]:
    """Return the subset of `targets` that are coalesced as aliases in
    the function's natural coalesce mappings for the given register class.

    "Coalesced as alias" means the target ig_idx appears as the LHS
    (virt) in a `virt -> root` mapping — i.e., MWCC merged it into
    another virtual's allocator node. A target appearing only as the
    RHS (root) of a mapping is still an independent allocator node and
    is NOT considered coalesced.

    Args:
        events: FunctionEvents for the function (from parse_hook_events
            + find_function).
        targets: Set of ig_idx values to check (typically the keys of
            a force_phys mapping).
        class_id: Register class to inspect (0 = GPR, 1 = FPR).

    Returns:
        The subset of `targets` that appears as a coalesce alias LHS.
        Empty if no targets are coalesced, or if `events` is None, or
        if `targets` is empty.
    """
    if events is None or not targets:
        return set()

    coalesced: set[int] = set()
    for section in events.coalesce_sections:
        if section.class_id != class_id:
            continue
        for virt, _root in section.natural_mappings:
            if virt in targets:
                coalesced.add(virt)
    return coalesced
```

The exact type of `events` (FunctionEvents) lives in `colorgraph_parser`. The function signature uses an untyped parameter to avoid the circular import — runtime dispatch handles whatever shape the caller passes. If the existing module already imports from `colorgraph_parser` cleanly (the existing `score_simplify_order` does), use that pattern instead.

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "find_coalesced_targets" -v`
Expected: 6 passes.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add find_coalesced_targets helper

Adds find_coalesced_targets(events, targets, class_id) to the scoring
module. Given a function's parsed pcdump events plus a set of target
ig_idx values, returns the subset that are coalesced as aliases (LHS
of natural coalesce mappings) for the given register class.

This is the core check for the coalesce-preservation constraint
(deferred debt #19). Pure function with no I/O; the score-function
integration lands in follow-up commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `coalesce_preservation` field to SimplifyOrderTargetSpec

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (add field + YAML loader support)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add field tests)

- [ ] **Step 2.1: Write tests for the new field**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
def test_load_spec_default_coalesce_preservation_true(tmp_path: Path) -> None:
    """Specs without explicit coalesce_preservation default to True."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_test
        simplify_order_target: [34, 37, 32]
        class_id: 0
        baseline_dump: base.txt
        force_phys:
          34: 31
          37: 30
        """,
    )
    spec = load_simplify_order_target_spec(spec_path)
    assert spec.coalesce_preservation is True


def test_load_spec_coalesce_preservation_explicit_false(tmp_path: Path) -> None:
    """Specs can opt out via coalesce_preservation: false."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_test
        simplify_order_target: [34, 37, 32]
        baseline_dump: base.txt
        force_phys:
          34: 31
        coalesce_preservation: false
        """,
    )
    spec = load_simplify_order_target_spec(spec_path)
    assert spec.coalesce_preservation is False


def test_load_spec_coalesce_preservation_explicit_true(tmp_path: Path) -> None:
    """coalesce_preservation: true loads correctly (explicit-default case)."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_test
        simplify_order_target: [34, 37, 32]
        baseline_dump: base.txt
        coalesce_preservation: true
        """,
    )
    spec = load_simplify_order_target_spec(spec_path)
    assert spec.coalesce_preservation is True


def test_load_spec_coalesce_preservation_rejects_non_bool(tmp_path: Path) -> None:
    """coalesce_preservation must be a boolean."""
    spec_path = _write_spec(
        tmp_path,
        """
        function: gm_test
        simplify_order_target: [34, 37, 32]
        baseline_dump: base.txt
        coalesce_preservation: "yes"
        """,
    )
    with pytest.raises(SimplifyOrderSpecError, match="coalesce_preservation.*bool"):
        load_simplify_order_target_spec(spec_path)
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "coalesce_preservation" -v`
Expected: 4 failures (`AttributeError: 'SimplifyOrderTargetSpec' object has no attribute 'coalesce_preservation'`).

- [ ] **Step 2.3: Extend the dataclass**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`, find the `SimplifyOrderTargetSpec` dataclass. Add the new field:

```python
@dataclass(frozen=True)
class SimplifyOrderTargetSpec:
    """Configuration for the score-simplify-order command.

    [existing docstring...]

    Fields:
      function: ...
      simplify_order_target: ...
      class_id: ...
      baseline_dump: ...
      force_phys: ...
      coalesce_preservation: When True (default) and `force_phys` is
        non-empty, candidates that coalesce any `force_phys` key
        ig_idx into another root are rejected by the scorer. When
        False, the constraint is disabled. Has no effect when
        `force_phys` is empty (the check has nothing to look at).
        Deferred-debt #19 Phase 2 build (2026-05-26).
    """

    function: str
    simplify_order_target: tuple[int, ...]
    class_id: int
    baseline_dump: Path
    force_phys: Mapping[int, int] = field(default_factory=dict)
    coalesce_preservation: bool = True
```

Then extend `load_simplify_order_target_spec` to parse the new field. Locate the section after `force_phys` parsing (added in Phase 1 Task 2) and before the final `return SimplifyOrderTargetSpec(...)` block. Insert:

```python
    # Optional coalesce_preservation flag (deferred debt #19).
    raw_coalesce = data.get("coalesce_preservation", True)
    if not isinstance(raw_coalesce, bool):
        raise SimplifyOrderSpecError(
            f"target spec {path}: 'coalesce_preservation' must be a bool "
            f"(true/false), got {type(raw_coalesce).__name__}"
        )
```

Then update the `return SimplifyOrderTargetSpec(...)` block to pass `coalesce_preservation=raw_coalesce`.

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass (including the 4 new ones and all pre-existing).

- [ ] **Step 2.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: add coalesce_preservation field to SimplifyOrderTargetSpec

Adds an optional `coalesce_preservation: bool = True` field. When True
(default) and force_phys is non-empty, the scorer will reject
candidates that coalesce any force_phys key. When False, the
constraint is disabled. The YAML loader accepts an explicit
true/false override and rejects non-bool values.

This is plumbing for the constraint logic in compute_lex_score
(deferred debt #19 Phase 2 build). Score integration lands next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend `compute_lex_score` with the constraint

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py` (extend score function)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py` (add score-with-constraint tests)

- [ ] **Step 3.1: Write tests for the constraint**

Append to `tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py`:

```python
from src.mwcc_debug.simplify_order_scoring import (
    SimplifyOrderScoreResult,
    compute_lex_score,
)


def test_compute_lex_score_no_coalesce_no_rejection(tmp_path: Path) -> None:
    """No target ig_idx coalesced → normal scoring applies."""
    # [Use the existing test fixtures for compute_lex_score; the
    # critical assertion is that the score is NOT the sentinel value]
    # ... [see existing tests for compute_lex_score; mirror their setup
    # but with a candidate whose pcdump has no coalesce events for
    # the target ig_idx values]
    ...
    assert result.score < SimplifyOrderScoreResult.STRUCTURAL_REJECTION
    # Or whatever the sentinel naming ends up being


def test_compute_lex_score_coalesced_target_rejected(tmp_path: Path) -> None:
    """Coalesced target ig_idx → score is the structural rejection sentinel.

    Uses a candidate pcdump where ig_idx 42 (in the target set) is
    coalesced into root 3. The score must be >= LEX_BIG * (target_len + 1)
    so it dominates any normal candidate's score.
    """
    ...
    assert result.score >= LEX_BIG * (len(target) + 1)
    # And the result should carry a flag indicating structural rejection
    assert result.structural_rejection is True


def test_compute_lex_score_coalesce_preservation_disabled(tmp_path: Path) -> None:
    """coalesce_preservation=False → constraint skipped even when coalesced."""
    ...
    # Same fixture as the rejection test, but with the spec's flag flipped
    # off. Expect normal scoring, no rejection sentinel.
    assert result.score < LEX_BIG * (len(target) + 1)


def test_compute_lex_score_no_force_phys_skips_check(tmp_path: Path) -> None:
    """No force_phys → coalesce check skipped (nothing to check)."""
    ...
    # Spec with force_phys={} (default). Constraint should be a no-op.
    assert result.score < LEX_BIG * (len(target) + 1)
```

These test bodies are skeletons because the existing `compute_lex_score` test patterns in the file are more elaborate than what's reasonable to inline here. **The implementer should:**
1. Look at the existing `compute_lex_score` test fixtures (likely there's a helper that builds a pcdump + baseline + spec)
2. Mirror that pattern for the 4 new tests
3. Use a coalesce-event-injecting helper similar to `_build_minimal_events_text` from Task 1 if needed
4. The key assertion is the sentinel rejection score vs. normal score

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -k "coalesce" -v`
Expected: 4 tests fail (the new ones — Task 1's tests should still pass; Task 2's tests should pass).

- [ ] **Step 3.3: Add the structural rejection sentinel + constraint logic**

In `tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py`:

1. Add a module-level constant after `LEX_BIG`:

```python
# Sentinel score for candidates rejected by the coalesce-preservation
# constraint. Equal to LEX_BIG * (max plausible target_len + 1), which
# dominates any normal score the function can produce (a normal score
# is at most LEX_BIG * target_len + distance.total). Using a constant
# rather than computing per-call keeps the rejection score stable
# across candidates so permuter can sort them consistently.
STRUCTURAL_REJECTION_SCORE: int = LEX_BIG * 1000
```

2. Extend `SimplifyOrderScoreResult` with a new field:

```python
@dataclass(frozen=True)
class SimplifyOrderScoreResult:
    # [existing fields...]
    structural_rejection: bool = False
    coalesced_targets: frozenset[int] = frozenset()
```

3. Extend `compute_lex_score` to apply the constraint. After the function extracts the candidate's events but before it computes the prefix score, add:

```python
    # Coalesce-preservation constraint (deferred debt #19).
    coalesced: frozenset[int] = frozenset()
    if spec.coalesce_preservation and spec.force_phys:
        coalesced = frozenset(find_coalesced_targets(
            candidate_events,
            targets=set(spec.force_phys.keys()),
            class_id=spec.class_id,
        ))
        if coalesced:
            return SimplifyOrderScoreResult(
                score=STRUCTURAL_REJECTION_SCORE,
                # [other existing fields with placeholder values; see
                # existing return statement for the full field list]
                structural_rejection=True,
                coalesced_targets=coalesced,
            )
```

The exact placement and the existing return-statement field list depend on the current shape of `compute_lex_score` — match the existing return signature, just substitute the sentinel score and set the two new fields.

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_simplify_order_scoring.py -v`
Expected: All tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/simplify_order_scoring.py \
        tools/melee-agent/tests/test_mwcc_debug_simplify_order_scoring.py
git commit -m "$(cat <<'EOF'
feat: coalesce-preservation constraint in compute_lex_score

When spec.coalesce_preservation is True (default) and spec.force_phys
is non-empty, compute_lex_score now checks whether any force_phys key
ig_idx is coalesced in the candidate's class-N natural coalesce
mappings. If so, returns the STRUCTURAL_REJECTION_SCORE sentinel
(LEX_BIG * 1000) and sets the new structural_rejection +
coalesced_targets fields on the result.

This drives permuter to reject candidates whose mutations destroy
the allocator-graph structure the force_phys mapping presupposes.

Empirical basis: the gm_80173EEC pool experiment (93e64a3de) showed
322/500 candidates preserve all 6 force-phys ig_idx as independent
nodes, and the top match% candidates are all in that preserved set.
The constraint redirects ~35% of search budget away from
structurally-infeasible candidates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `--no-coalesce-preservation` flag on setup CLI

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (add flag to setup command)
- Modify: `tools/melee-agent/src/mwcc_debug/permuter_config.py` (render coalesce_preservation when explicitly false)
- Modify: `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py` (test flag)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` (test rendering)

- [ ] **Step 4.1: Write rendering tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py`:

```python
def test_render_target_yaml_omits_coalesce_preservation_when_default(tmp_path: Path) -> None:
    """When coalesce_preservation is True (default), the key is omitted
    from the rendered YAML — relies on the loader's default-true behavior."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml

    yaml_text = render_simplify_order_target_yaml(
        function="gm_test",
        simplify_order_target=(34, 37),
        class_id=0,
        baseline_dump=tmp_path / "base.txt",
        force_phys={34: 31},
        coalesce_preservation=True,  # default
    )
    assert "coalesce_preservation" not in yaml_text


def test_render_target_yaml_emits_coalesce_preservation_when_false(tmp_path: Path) -> None:
    """When coalesce_preservation is False, the key IS emitted as
    `coalesce_preservation: false` so the loader sees the opt-out."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml

    yaml_text = render_simplify_order_target_yaml(
        function="gm_test",
        simplify_order_target=(34, 37),
        class_id=0,
        baseline_dump=tmp_path / "base.txt",
        force_phys={34: 31},
        coalesce_preservation=False,
    )
    assert "coalesce_preservation: false" in yaml_text


def test_render_target_yaml_roundtrip_coalesce_preservation(tmp_path: Path) -> None:
    """Rendered YAML with coalesce_preservation: false loads back correctly."""
    from src.mwcc_debug.permuter_config import render_simplify_order_target_yaml
    from src.mwcc_debug.simplify_order_scoring import load_simplify_order_target_spec

    baseline = tmp_path / "base.txt"
    baseline.write_text("pcdump", encoding="utf-8")
    yaml_text = render_simplify_order_target_yaml(
        function="gm_test",
        simplify_order_target=(34,),
        class_id=0,
        baseline_dump=baseline,
        force_phys={34: 31},
        coalesce_preservation=False,
    )
    spec_path = tmp_path / "target.yaml"
    spec_path.write_text(yaml_text, encoding="utf-8")

    spec = load_simplify_order_target_spec(spec_path)
    assert spec.coalesce_preservation is False
```

- [ ] **Step 4.2: Run rendering tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -k "coalesce_preservation" -v`
Expected: 3 failures.

- [ ] **Step 4.3: Update render_simplify_order_target_yaml**

In `tools/melee-agent/src/mwcc_debug/permuter_config.py`, update the signature and body of `render_simplify_order_target_yaml`:

```python
def render_simplify_order_target_yaml(
    *,
    function: str,
    simplify_order_target: tuple[int, ...] | list[int],
    class_id: int,
    baseline_dump: Path,
    force_phys: Mapping[int, int] | None = None,
    coalesce_preservation: bool = True,
) -> str:
    """Render a SimplifyOrderTargetSpec to YAML.

    [existing docstring...]

    coalesce_preservation is True by default and the key is omitted
    in that case (the loader defaults to True). When False, emits
    `coalesce_preservation: false` so the loader sees the opt-out.
    """
    lines: list[str] = [
        # ... existing lines ...
    ]
    if force_phys:
        lines.append("force_phys:")
        for ig_idx, phys in sorted(force_phys.items()):
            lines.append(f"  {ig_idx}: {phys}")
    if not coalesce_preservation:
        lines.append("coalesce_preservation: false")
    return "\n".join(lines) + "\n"
```

- [ ] **Step 4.4: Run rendering tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_mwcc_debug_permuter_config.py -v`
Expected: All tests pass.

- [ ] **Step 4.5: Write setup CLI tests**

Append to `tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py`:

```python
def test_setup_default_coalesce_preservation_omits_key(
    tmp_path: Path, monkeypatch
) -> None:
    """Without --no-coalesce-preservation, target.yaml omits the key."""
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
            "--want-first", "1",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force-phys", "34:31",
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    content = (perm_dir / "simplify_order_target.yaml").read_text(encoding="utf-8")
    assert "coalesce_preservation" not in content


def test_setup_no_coalesce_preservation_writes_false(
    tmp_path: Path, monkeypatch
) -> None:
    """--no-coalesce-preservation writes the opt-out into target.yaml."""
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
            "--want-first", "1",
            "--class", "0",
            "--baseline-dump", str(baseline),
            "--perm-root", str(tmp_path / "perm"),
            "--force-phys", "34:31",
            "--no-coalesce-preservation",
            "--force",
        ],
    )

    assert result.exit_code == 0, result.output
    content = (perm_dir / "simplify_order_target.yaml").read_text(encoding="utf-8")
    assert "coalesce_preservation: false" in content
```

Reuse the existing test helpers (`_make_perm_dir`, `_make_baseline_dump`, `_stub_wibo_and_compiler`) — see how Phase 1 Task 3 tests use them.

- [ ] **Step 4.6: Run setup tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -k "coalesce_preservation" -v`
Expected: 2 failures.

- [ ] **Step 4.7: Add --no-coalesce-preservation flag to the setup command**

In `tools/melee-agent/src/cli/debug.py`, locate the `setup_simplify_order_scorer` function. Add a new Typer option (placement: after `--force-phys` since the two are conceptually linked):

```python
    no_coalesce_preservation: bool = typer.Option(
        False,
        "--no-coalesce-preservation",
        help=(
            "Disable the coalesce-preservation constraint in the scorer. "
            "By default (when --force-phys is provided), candidates that "
            "coalesce any force_phys key ig_idx into another root are "
            "rejected as structurally infeasible. Pass this flag to opt "
            "out — useful for diagnostic runs or when the target tolerates "
            "coalescing."
        ),
    ),
```

In the function body, compute `coalesce_preservation = not no_coalesce_preservation` and pass it to the renderer call:

```python
    coalesce_preservation = not no_coalesce_preservation
    yaml_text = render_simplify_order_target_yaml(
        function=function,
        simplify_order_target=parsed_targets,
        class_id=class_id,
        baseline_dump=resolved_baseline,
        force_phys=parsed_force_phys or None,
        coalesce_preservation=coalesce_preservation,
    )
```

- [ ] **Step 4.8: Run setup tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_setup_simplify_order_scorer.py -v`
Expected: All tests pass.

- [ ] **Step 4.9: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/src/mwcc_debug/permuter_config.py \
        tools/melee-agent/tests/test_cli_setup_simplify_order_scorer.py \
        tools/melee-agent/tests/test_mwcc_debug_permuter_config.py
git commit -m "$(cat <<'EOF'
feat: --no-coalesce-preservation flag on setup-simplify-order-scorer

Adds --no-coalesce-preservation as an opt-out flag. When set, target.yaml
gets `coalesce_preservation: false` and the scorer's coalesce-preservation
constraint is disabled.

Default behavior (without the flag) is to enable the constraint, but
target.yaml omits the key — the loader's default-true handles it. This
keeps target.yaml minimal for the common case.

Useful for diagnostic runs or targets that tolerate coalescing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Coalesce-preservation diagnostic in --breakdown

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (extend --breakdown output)
- Modify: `tools/melee-agent/tests/test_cli_score_simplify_order.py` (test new output)

- [ ] **Step 5.1: Write breakdown tests**

Append to `tools/melee-agent/tests/test_cli_score_simplify_order.py`:

```python
def test_breakdown_with_coalesce_preservation_safe(tmp_path: Path) -> None:
    """When no target ig_idx is coalesced, --breakdown reports
    'Coalesce preservation: ALL TARGETS INDEPENDENT'."""
    # Build a target.yaml with force_phys = {34: 31}, simplify_order_target = [34]
    # Build a candidate pcdump where ig_idx 34 is NOT coalesced
    # Run --breakdown
    # Assert "Coalesce preservation:" appears in output
    # Assert "ALL TARGETS INDEPENDENT" (or equivalent positive wording) appears
    # Assert exit code 0
    ...


def test_breakdown_with_coalesce_preservation_rejected(tmp_path: Path) -> None:
    """When a target ig_idx IS coalesced, --breakdown reports
    'Coalesce preservation: REJECTED' with the coalesced ig_idx listed."""
    # Build a target.yaml with force_phys = {42: 28}, simplify_order_target = [42]
    # Build a candidate pcdump where ig_idx 42 IS coalesced into root 3
    # Run --breakdown
    # Assert "Coalesce preservation:" appears
    # Assert "REJECTED" or "COALESCED" appears
    # Assert "42" (the coalesced ig_idx) is mentioned
    # Assert exit code 0 (warn-only; no strict mode for this constraint)
    ...


def test_breakdown_without_force_phys_no_coalesce_line(tmp_path: Path) -> None:
    """Specs without force_phys → no coalesce line in --breakdown."""
    # Build target.yaml with no force_phys
    # Run --breakdown
    # Assert "coalesce preservation" not in output (case-insensitive)
    ...


def test_breakdown_coalesce_preservation_disabled_emits_note(tmp_path: Path) -> None:
    """When coalesce_preservation is explicitly false, --breakdown emits
    a 'Coalesce preservation: DISABLED' note even if a target is coalesced."""
    # Build target.yaml with force_phys + coalesce_preservation: false
    # Build a candidate that WOULD trigger rejection
    # Run --breakdown
    # Assert "Coalesce preservation:" appears
    # Assert "DISABLED" appears
    # Assert exit code 0
    ...
```

Use the same helper-building pattern from Phase 1 Task 4 (`_build_target_spec`, `_build_candidate_obj`, plus a new variant that injects coalesce events into the candidate's pcdump).

- [ ] **Step 5.2: Run breakdown tests to verify they fail**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -k "coalesce_preservation" -v`
Expected: 4 failures.

- [ ] **Step 5.3: Add the coalesce diagnostic to --breakdown**

In `tools/melee-agent/src/cli/debug.py`, locate the polarity-check section in the breakdown rendering (added in Phase 1 Task 4). Add a coalesce-preservation section BEFORE the polarity check (so the breakdown reads in pipeline order: structural check first, then polarity check). The new block:

```python
        # Coalesce-preservation diagnostic (deferred debt #19).
        # Only runs when force_phys is present (the check needs targets).
        if spec.force_phys:
            print("")  # separator
            if not spec.coalesce_preservation:
                print("Coalesce preservation:    DISABLED")
                print(
                    "  Constraint disabled via coalesce_preservation: false. "
                    "Candidates that coalesce target ig_idx values are NOT "
                    "rejected."
                )
            elif result.structural_rejection:
                aliased = ",".join(str(x) for x in sorted(result.coalesced_targets))
                print("Coalesce preservation:    REJECTED")
                print(
                    f"  Target ig_idx [{aliased}] coalesced as alias(es) into "
                    f"another root. The candidate's allocator graph has fewer "
                    f"independent nodes than the force_phys mapping presupposes. "
                    f"Rejected with score={result.score}."
                )
            else:
                print("Coalesce preservation:    ALL TARGETS INDEPENDENT")
```

- [ ] **Step 5.4: Run breakdown tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_cli_score_simplify_order.py -v`
Expected: All tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_cli_score_simplify_order.py
git commit -m "$(cat <<'EOF'
feat: coalesce preservation diagnostic in score-simplify-order --breakdown

Adds a Coalesce preservation: line to the --breakdown output when
spec.force_phys is present. Three states:

- ALL TARGETS INDEPENDENT: no target ig_idx coalesced, constraint
  passes
- REJECTED: at least one target ig_idx coalesced; shows the coalesced
  ig_idx values and the structural rejection score
- DISABLED: spec.coalesce_preservation is False; constraint not
  applied even if a target would be coalesced

Renders before the polarity check so the breakdown reads in pipeline
order (structural → polarity). Always exit 0 — coalesce-preservation
has no strict mode (the constraint already drives permuter to reject
via the score; a CLI exit would only help end-user verification, which
is not the use case).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update SKILL.md Step 0 docs

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md` (extend Step 0 description with coalesce check)

- [ ] **Step 6.1: Locate the Step 0 section**

Open `.claude/skills/mwcc-debug/SKILL.md` and find the "Stuck-function workflow with custom simplify-order scorer" section + Step 0 subsection (added in Phase 1 Task 6).

- [ ] **Step 6.2: Add a third check to Step 0**

The current Step 0 documents two checks (Observed prefix non-empty, Polarity SAFE). Add a third for coalesce preservation. The new structure should read:

```markdown
The breakdown emits three checks:

1. **`Observed prefix:`** must contain non-`-1` `ig_idx` values. If it
   is empty or all `-1`, the target shape is **phys-iter**
   (`COLORGRAPH DECISIONS` positions, not `SIMPLIFY GRAPH`) and Layer A
   cannot help. Abort before the 2–3 hour permuter run.

2. **`Coalesce preservation:`** should report **ALL TARGETS INDEPENDENT**
   for the baseline. If it reports **REJECTED** at screening time, that
   means the baseline itself coalesces target ig_idx values — a sign
   the force-phys mapping is misaligned with the function's allocator
   shape. Recheck the force proof: the target should presuppose
   independent virtuals for each ig_idx in the mapping. If the baseline
   genuinely has the right shape and the constraint should be disabled
   for this function, pass `--no-coalesce-preservation` to
   `setup-simplify-order-scorer`. The constraint will automatically
   reject coalescing candidates during the permuter run (no further
   action needed at scoring time). The gm_80173EEC campaign documented
   why this check matters.

3. **`Polarity check:`** must report **SAFE**. If it reports
   **WRONG POLARITY**, the target physicals are in the high-volatile
   range (r10–r12) and `--want-first` syntax is structurally wrong for
   this function. `--strict-polarity` makes this a hard refusal. The
   lbDvd_80018A2C campaign documented this gotcha.

See "Target shape" under Layer A in the roadmap for the full taxonomy
of when each pre-flight signal applies.
```

Replace the existing two-check listing with this three-check version.

- [ ] **Step 6.3: Commit**

```bash
git add -f .claude/skills/mwcc-debug/SKILL.md
git commit -m "$(cat <<'EOF'
docs: add coalesce-preservation check to Step 0

Documents the new coalesce-preservation diagnostic that lands with
deferred debt #19 Phase 2 build. Step 0 now has three checks:

1. Observed prefix non-empty (phys-iter detection — Phase 1)
2. Coalesce preservation (new — Phase 2)
3. Polarity check (high-volatile detection — Phase 1)

Renders in pipeline order so the agent reading the breakdown sees
structural → polarity, matching the order MWCC's compiler processes
the constraints.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Local validation against existing gm pool

**Files:**
- No files modified. This task validates the build against the empirical sub-experiment's data.

- [ ] **Step 7.1: Set up a target.yaml mirroring the gm campaign config**

In `/tmp/coalesce-acceptance/`:

```bash
mkdir -p /tmp/coalesce-acceptance
cd /tmp/coalesce-acceptance

# Use the gm baseline pcdump (it exists from prior campaigns)
cp /Users/mike/code/melee/build/mwcc_debug_cache/melee/gr/grvenom.txt ./gm-baseline.txt 2>/dev/null \
  || cp /Users/mike/code/melee/build/mwcc_debug_cache/melee/<gm-path>/gm.txt ./gm-baseline.txt

cat > target.yaml <<EOF
function: gm_80173EEC
simplify_order_target: [34, 37, 32]
class_id: 0
baseline_dump: $(pwd)/gm-baseline.txt
force_phys:
  34: 31
  37: 30
  32: 29
  42: 28
  52: 28
  38: 28
EOF
```

(If the gm baseline pcdump path doesn't exist yet, generate it via `melee-agent debug dump local <path-to-gm-source> --function gm_80173EEC --output ./gm-baseline.txt` first.)

- [ ] **Step 7.2: Verify the gm baseline itself passes the constraint**

Run:

```bash
melee-agent debug target score-simplify-order \
  -f gm_80173EEC \
  --target /tmp/coalesce-acceptance/target.yaml \
  /tmp/coalesce-acceptance/gm-baseline.txt \
  --breakdown
```

Expected output contains:
- `Coalesce preservation:    ALL TARGETS INDEPENDENT`
- The score is NOT the STRUCTURAL_REJECTION_SCORE sentinel
- Exit code 0

If the baseline itself triggers REJECTED, the force_phys mapping is misaligned and the constraint is incorrectly screening it. Stop and investigate.

- [ ] **Step 7.3: Verify a known-coalescing candidate triggers rejection**

Use `output-139-1` from the existing gm pool (it has ig_idx 42 and 38 coalesced into root 3). Score it:

```bash
# Compile output-139-1 to get its .o (or use an existing cached one)
# Then:
melee-agent debug target score-simplify-order \
  -f gm_80173EEC \
  --target /tmp/coalesce-acceptance/target.yaml \
  /path/to/output-139-1.o \
  --breakdown
```

Expected output contains:
- `Coalesce preservation:    REJECTED`
- The score IS the sentinel (`LEX_BIG * 1000`)
- The coalesced ig_idx list includes `42` and `38`
- Exit code 0 (warn-only; no strict mode for this constraint)

- [ ] **Step 7.4: Verify --no-coalesce-preservation disables the constraint**

Modify the target.yaml to add `coalesce_preservation: false`, then re-score output-139-1:

```bash
sed -i '' '$a\
coalesce_preservation: false
' /tmp/coalesce-acceptance/target.yaml

melee-agent debug target score-simplify-order \
  -f gm_80173EEC \
  --target /tmp/coalesce-acceptance/target.yaml \
  /path/to/output-139-1.o \
  --breakdown
```

Expected:
- `Coalesce preservation:    DISABLED`
- Normal scoring resumes (no sentinel)
- Exit code 0

- [ ] **Step 7.5: Run full test suite**

```bash
cd tools/melee-agent && pytest
```

Verify all tests pass (no regression from any prior Phase 2 commits).

- [ ] **Step 7.6: No commit (acceptance is verification only)**

If any step fails, return to the failing task and fix. If all pass, the local validation is complete and Task 8 (remote campaign brief) is ready.

---

## Task 8: Remote validation campaign (handed off to campaign agent)

**Files:**
- No files modified by this task directly. The campaign agent will commit a campaign writeup at completion.

- [ ] **Step 8.1: Generate the campaign brief**

After Task 7 passes, write a ready-to-send brief for the campaign agent that:
1. References the Phase 2 Stage 2 plan and the empirical sub-experiment findings
2. Specifies: re-import gm_80173EEC, set up scorer with `--force-phys` AND the new constraint (default-on), launch a 200K+ iteration remote permuter run
3. Triage the surviving pool by real-tree match%
4. Report outcome categories (CLEAN SUCCESS / PARTIAL / NO PROGRESS, same as Phase 1)
5. Append findings to `docs/mwcc-debug-gm_80173EEC-campaign-2026-05-25.md`

The controller (this conversation) generates the brief based on the Task 7 results and hands it to the user, who relays to the campaign agent.

- [ ] **Step 8.2: Await campaign results**

Standing by for the campaign agent's report. Time budget: 2-3 hours for the permuter run + ~15 min for triage and writeup.

- [ ] **Step 8.3: Update the roadmap based on outcome**

Three possible outcomes:

**CLEAN SUCCESS (100% match found):** The constraint successfully shaped the search to a 100% candidate. Update the roadmap to mark #19 as shipped + validated. Phase 2 closes.

**PARTIAL (match% improvement but no 100%):** The constraint helped but didn't close the gap. Update the roadmap to note #19 ships but gm is still unreached — possibly Phase 3 (late-target syntax) is also needed, OR gm is unreachable from decomp-permuter's mutation space regardless of scoring. Phase 2 still closes.

**NO PROGRESS (no improvement above 99.33%):** The constraint correctly rejected ~35% of mutations but the productive neighborhood didn't yield closer matches. This suggests gm is unreachable from current permuter mutations. Update the roadmap to document the ceiling. Phase 2 closes as a constraint-built-but-function-unreachable case.

In all three outcomes, Phase 2 is "done" from the deliverable perspective — the constraint is built, tested, and validated empirically.

---

## Self-Review Notes

Spec coverage check:
- ✅ `find_coalesced_targets` helper: Task 1
- ✅ `coalesce_preservation` field on target spec: Task 2
- ✅ Constraint logic in `compute_lex_score`: Task 3
- ✅ `--no-coalesce-preservation` CLI flag: Task 4
- ✅ `--breakdown` diagnostic: Task 5
- ✅ SKILL.md docs: Task 6
- ✅ Local validation: Task 7
- ✅ Remote validation campaign brief: Task 8

Placeholder scan: Task 3 and Task 5 have skeleton test bodies (`...`) where the implementer needs to mirror existing fixture patterns. This is intentional — the existing test files for `compute_lex_score` and `score-simplify-order --breakdown` have established helper patterns that I can't reproduce here without writing them out (and inlining 200+ lines of test code into the plan). The implementer reads the existing tests and follows the pattern.

Type consistency:
- `find_coalesced_targets`: signature stable across tasks
- `STRUCTURAL_REJECTION_SCORE: int`: constant used in score logic + breakdown
- `SimplifyOrderScoreResult` gains two new fields (`structural_rejection: bool`, `coalesced_targets: frozenset[int]`); referenced by breakdown rendering

Forward-compatibility:
- Phase 3 (late-target syntax) will add new target syntax but doesn't intersect with the coalesce constraint — they compose
- Phase 4 (phys-iter scorer) is a separate scorer mode that may have its own structural constraints; the `coalesce_preservation` field is scoped to simplify-order targets and shouldn't leak into phys-iter target specs

## Validation Campaign (post-merge)

Task 8 IS the validation campaign — the remote permuter run on gm_80173EEC with the constraint enabled. After Task 8 reports, the roadmap update closes out Phase 2.
