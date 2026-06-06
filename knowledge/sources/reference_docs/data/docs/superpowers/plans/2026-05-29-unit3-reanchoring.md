# Unit 3 — Target Re-anchoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express a fixed `TargetSpec` in a freshly-edited compile's ig-numbering — `reanchor(target, new_compile) -> ReanchorResult` — emitting a force-phys map of only confident, round-trip-confirmed roles plus per-role diagnostics, in the `{function, virtuals, spilled}` shape `first-divergence` already consumes.

**Architecture:** Re-anchoring is a thin wrapper over the validated matcher (`match_roles`). Forward match (target → new) proposes `original_ig → new_ig`; an inverse match (new → target) round-trip-confirms each one. Only `matched` + round-trip-confirmed roles become force-phys entries; `gone`/`merged`/`split`/`ambiguous`/`non_comparable`/no-descriptor roles are routed to diagnostics and **excluded** from the map (validation lesson: AMBIGUOUS/SPLIT are first-class, never coerced). Multi-anchor consensus (original/previous-rev/last-stable) is deferred to Unit 4 — it needs loop history that does not exist at standalone Unit 3.

**Tech Stack:** Python 3.11, pytest (`--no-cov` for focused runs, keep every run under `timeout 120`). Reuses `role_descriptor` (`Compile`, `TargetSpec`, `build_descriptors`), `role_matcher` (`match_roles`, `MatchStatus`), `first_divergence` (`decision_coloring`, `TargetColoring`). New code only.

---

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/role_reanchor.py` — `ReanchorResult` + `reanchor()` + `reanchor_to_target_spec()`. One responsibility: map a fixed target into a new compile.
- Create `tools/melee-agent/tests/test_role_reanchor.py` — unit tests, the no-op control, and the cross-rev corpus gate.
- Modify `tools/melee-agent/src/cli/debug.py` — add `target reanchor` command (loads a saved `TargetSpec` + a new pcdump, prints the force-phys-safe spec + diagnostics).

Reanchor reuses these exact APIs:
- `rd.Compile.from_text(pcdump_text, function, source)` → `Compile`
- `rd.build_descriptors(compile, class_id)` → `dict[int, RoleDescriptor]`
- `rd.TargetSpec.load_json(path)` / `.roles` of `TargetRoleSpec{original_ig, desired_phys, class_id, descriptor, role_order_rank}` (descriptor may be `None`)
- `rm.match_roles(ref_descs, cand_descs)` → `dict[int, RoleMatch{new_ig, status, confidence}]`; `rm.MatchStatus.MATCHED`
- `fd.decision_coloring(events, class_id)` → `dict[int, int]` (new compile's ig→phys); spilled via `events.simplify_sections`

---

## Task 1: ReanchorResult + forward re-anchor (matched → force-phys)

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/role_reanchor.py`
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test (no-op control = perfect identity)**

```python
# tools/melee-agent/tests/test_role_reanchor.py
import pathlib, pytest
from src.mwcc_debug import role_descriptor as rd
from src.mwcc_debug import role_reanchor as rr

FIX = pathlib.Path(__file__).parent / "fixtures" / "role_identity"


def _compile(stem, fn):
    p = FIX / f"{stem}_pcdump.txt"
    if not p.exists():
        pytest.skip(f"{p.name} missing")
    return rd.Compile.from_text(p.read_text(), fn, "")


def test_reanchor_noop_control_is_identity():
    """Re-anchoring a target into the SAME compile it was derived from must map
    every role to its own ig at its own phys (perfect 1:1) — the cleanest ground
    truth. Uses the committed mnvibration matched dump."""
    fn = "mnVibration_80248644"
    c = _compile("mnVibration_matched", fn)
    descs = rd.build_descriptors(c, 0)
    force_phys = {ig: 13 + (ig % 5) for ig in list(descs)[:6]}   # arbitrary target physregs
    target = rd.build_target_spec(c, force_phys, 0, "force_proof_proxy",
                                  provenance={"src": "noop"})
    res = rr.reanchor(target, c, class_id=0)
    # Every force-phys entry maps a role to ITSELF at its own desired phys.
    # (Identical siblings can be honestly AMBIGUOUS on self-match — Gate 1a — so
    # the map is a subset, not necessarily all 6; what must hold is no wrong/drifted
    # placement.)
    for new_ig, phys in res.force_phys.items():
        assert new_ig in force_phys and force_phys[new_ig] == phys
    assert len(res.force_phys) >= 0.8 * len(force_phys), res.diagnostics
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_reanchor_noop_control_is_identity -q --no-cov`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.mwcc_debug.role_reanchor'`.

- [ ] **Step 3: Implement the forward re-anchor**

```python
# tools/melee-agent/src/mwcc_debug/role_reanchor.py
from __future__ import annotations
from dataclasses import dataclass, field
from . import role_matcher as rm
from . import role_descriptor as rd


@dataclass(frozen=True)
class ReanchorResult:
    class_id: int
    force_phys: dict          # new_ig -> desired_phys (matched + round-trip-confirmed only)
    diagnostics: dict         # original_ig -> status string (everything excluded from the map)


def reanchor(target: "rd.TargetSpec", new_compile: "rd.Compile", class_id: int = 0) -> ReanchorResult:
    """Map a fixed TargetSpec into new_compile's ig-numbering via the matcher.
    Only `matched` roles become force-phys entries (round-trip confirmation is
    added in Task 2). Roles without a descriptor (structural Case D/E) or with a
    non-matched status are routed to diagnostics and excluded from the map."""
    cand = rd.build_descriptors(new_compile, class_id)
    roles = [r for r in target.roles if r.class_id == class_id]
    desired = {r.original_ig: r.desired_phys for r in roles}
    ref = {r.original_ig: r.descriptor for r in roles if r.descriptor is not None}

    diagnostics = {r.original_ig: "no_descriptor"
                   for r in roles if r.descriptor is None}
    out = rm.match_roles(ref, cand) if ref else {}
    force_phys = {}
    for orig_ig, m in out.items():
        if m.status == rm.MatchStatus.MATCHED:
            force_phys[m.new_ig] = desired[orig_ig]
        else:
            diagnostics[orig_ig] = m.status.value
    return ReanchorResult(class_id=class_id, force_phys=force_phys, diagnostics=diagnostics)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_reanchor_noop_control_is_identity -q --no-cov`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_reanchor.py tools/melee-agent/tests/test_role_reanchor.py
git commit -m "feat(reanchor): forward re-anchor + no-op identity control"
```

---

## Task 2: Round-trip (inverse) cross-check

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_reanchor.py`
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_confirm_round_trip_demotes_non_invertible_match():
    """A forward match stays in the map only if the new node maps BACK to the
    original role (inverse consistency, spec section 7 / review #4). The decision
    is a pure helper over forward + inverse match dicts, tested directly with
    synthetic RoleMatches: match_roles' min-cost assignment is symmetric, so a
    forward/inverse disagreement only arises from TOP_K pruning asymmetry on real
    data and cannot be staged through cost alone — hence the helper-level test."""
    from src.mwcc_debug.role_matcher import RoleMatch, MatchStatus as S
    forward = {10: RoleMatch(10, 70, 0.9, S.MATCHED, {}),    # 10 -> 70
               11: RoleMatch(11, 71, 0.8, S.MATCHED, {})}    # 11 -> 71
    inverse = {70: RoleMatch(70, 11, 0.9, S.MATCHED, {}),    # 70 maps back to 11, NOT 10
               71: RoleMatch(71, 11, 0.8, S.MATCHED, {})}    # 71 -> 11
    fp, diag = rr._confirm_round_trip(forward, inverse, desired={10: 13, 11: 14})
    assert 70 not in fp and diag[10] == "unstable_identity"  # 10's match is not invertible
    assert fp.get(71) == 14 and 11 not in diag               # 11 <-> 71 round-trips cleanly
```

Note: round-trip is a pure helper `_confirm_round_trip(forward, inverse, desired)`; `reanchor_descs(ref, cand, desired, class_id)` computes the forward + inverse matches and calls it, and is also a descriptor-level seam so re-anchoring is unit-testable without a full `TargetSpec`. `reanchor()` calls `reanchor_descs`.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_confirm_round_trip_demotes_non_invertible_match -q --no-cov`
Expected: FAIL — `AttributeError: module ... has no attribute '_confirm_round_trip'`.

- [ ] **Step 3: Implement the round-trip helper + the descriptor-level seam**

```python
def _confirm_round_trip(forward: dict, inverse: dict, desired: dict):
    """Keep a forward MATCHED role only if the new node maps back to it.
    forward: orig_ig -> RoleMatch (target->new); inverse: new_ig -> RoleMatch
    (new->target). Returns (force_phys{new_ig: phys}, diagnostics{orig_ig: status})."""
    force_phys, diagnostics = {}, {}
    for orig_ig, m in forward.items():
        if m.status != rm.MatchStatus.MATCHED:
            diagnostics[orig_ig] = m.status.value
            continue
        inv = inverse.get(m.new_ig)
        if inv is not None and inv.status == rm.MatchStatus.MATCHED and inv.new_ig == orig_ig:
            force_phys[m.new_ig] = desired[orig_ig]
        else:
            diagnostics[orig_ig] = "unstable_identity"   # forward-only, not invertible
    return force_phys, diagnostics


def reanchor_descs(ref: dict, cand: dict, desired: dict, class_id: int = 0,
                   pre_diag=None) -> ReanchorResult:
    forward = rm.match_roles(ref, cand) if ref else {}
    inverse = rm.match_roles(cand, ref) if (cand and ref) else {}
    force_phys, diagnostics = _confirm_round_trip(forward, inverse, desired)
    if pre_diag:
        diagnostics = {**pre_diag, **diagnostics}
    return ReanchorResult(class_id=class_id, force_phys=force_phys, diagnostics=diagnostics)
```

Then rewrite `reanchor()` to delegate:

```python
def reanchor(target, new_compile, class_id: int = 0) -> ReanchorResult:
    cand = rd.build_descriptors(new_compile, class_id)
    roles = [r for r in target.roles if r.class_id == class_id]
    desired = {r.original_ig: r.desired_phys for r in roles}
    ref = {r.original_ig: r.descriptor for r in roles if r.descriptor is not None}
    pre_diag = {r.original_ig: "no_descriptor" for r in roles if r.descriptor is None}
    return reanchor_descs(ref, cand, desired, class_id, pre_diag=pre_diag)
```

- [ ] **Step 4: Run both reanchor tests**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py -q --no-cov`
Expected: PASS (no-op control still passes; round-trip test passes).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_reanchor.py tools/melee-agent/tests/test_role_reanchor.py
git commit -m "feat(reanchor): round-trip inverse cross-check (unstable_identity)"
```

---

## Task 3: Diagnostics coverage — gone / no-descriptor excluded from the map

**Files:**
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reanchor_routes_gone_and_no_descriptor_to_diagnostics():
    """A target role with no candidate (GONE) and a role with descriptor=None
    (structural Case D/E) must both be excluded from force_phys and recorded in
    diagnostics — never coerced into a force-phys entry."""
    from src.mwcc_debug.role_descriptor import RoleDescriptor as RD, TargetRoleSpec, TargetSpec
    def d(ig, sig): return RD(ig_idx=ig, first_def_sig=sig, use_site_multiset=(("lwz",1),),
        is_param=False, var_name=None, var_confidence=None, assigned_reg=10, live_range=(0,5),
        use_count=1, spilled=False)
    roles = [
        TargetRoleSpec(40, 31, 0, d(40, "lwz r#,44(r#)"), 0),     # present in cand
        TargetRoleSpec(50, 30, 0, d(50, "fmadds f#,f#,f#,f#"), 1),# GONE (no GPR cand matches)
        TargetRoleSpec(60, 29, 0, None, None),                    # structural, no descriptor
    ]
    target = TargetSpec("fn", "force_proof_proxy", 1.0, False, {}, roles)
    cand = {40: d(40, "lwz r#,44(r#)")}
    res = rr.reanchor_descs({40: roles[0].descriptor, 50: roles[1].descriptor}, cand,
                            desired={40:31, 50:30}, class_id=0,
                            pre_diag={60: "no_descriptor"})
    assert res.force_phys.get(40) == 31           # role 40 matched cand 40 (self), phys preserved
    assert res.diagnostics.get(50) == "gone"       # no GPR candidate -> GONE
    assert res.diagnostics.get(60) == "no_descriptor"
    assert 30 not in res.force_phys.values() and 29 not in res.force_phys.values()
```

- [ ] **Step 2: Run it**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_reanchor_routes_gone_and_no_descriptor_to_diagnostics -q --no-cov`
Expected: PASS already if Task 2 is correct (this is a behavior-lock test). If it fails, fix `reanchor_descs` so non-matched statuses and `pre_diag` are preserved.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_role_reanchor.py
git commit -m "test(reanchor): lock gone/no-descriptor diagnostics routing"
```

---

## Task 4: Emit the first-divergence-compatible target spec

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_reanchor.py`
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reanchor_to_target_spec_shape_matches_force_phys_safe():
    """reanchor_to_target_spec emits {function, virtuals, spilled} — the same shape
    `target derive --force-phys-safe` produces and `first-divergence` consumes."""
    res = rr.ReanchorResult(class_id=0, force_phys={39: 31, 43: 30}, diagnostics={})
    spec = rr.reanchor_to_target_spec(res, "fn_x", spilled=[])
    assert spec == {"function": "fn_x", "virtuals": {39: 31, 43: 30}, "spilled": []}
```

- [ ] **Step 2: Run it (fails: no attribute)**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_reanchor_to_target_spec_shape_matches_force_phys_safe -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement**

```python
def reanchor_to_target_spec(res: ReanchorResult, function: str, spilled: list | None = None) -> dict:
    """The {function, virtuals, spilled} dict that `first-divergence` consumes
    (same shape as `target derive --force-phys-safe`)."""
    return {"function": function, "virtuals": dict(res.force_phys),
            "spilled": sorted(spilled or [])}
```

- [ ] **Step 4: Run; PASS. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/role_reanchor.py tools/melee-agent/tests/test_role_reanchor.py
git commit -m "feat(reanchor): emit first-divergence-compatible target spec"
```

---

## Task 5: `target reanchor` CLI command

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test (via the Typer runner)**

```python
def test_cli_target_reanchor_emits_spec_and_diagnostics(tmp_path):
    """`target reanchor TARGET.json NEW_PCDUMP -f FN` prints the force-phys-safe
    spec on stdout and a per-role diagnostics summary on stderr."""
    from typer.testing import CliRunner
    from src.cli.debug import app
    fn = "mnVibration_80248644"
    matched = (FIX / "mnVibration_matched_pcdump.txt")
    if not matched.exists():
        pytest.skip("corpus missing")
    c = rd.Compile.from_text(matched.read_text(), fn, "")
    descs = rd.build_descriptors(c, 0)
    fp = {ig: 13 + (ig % 5) for ig in list(descs)[:6]}
    target = rd.build_target_spec(c, fp, 0, "force_proof_proxy", provenance={"src": "test"})
    tpath = tmp_path / "target.json"; target.save_json(tpath)
    r = CliRunner().invoke(app, ["target", "reanchor", str(tpath), str(matched),
                                 "-f", fn, "--format", "json"])
    assert r.exit_code == 0, r.output
    import json as _j
    out = _j.loads(r.stdout)
    assert out["function"] == fn and out["virtuals"]          # non-empty on the no-op case
```

- [ ] **Step 2: Run it (fails: no such command)**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_cli_target_reanchor_emits_spec_and_diagnostics -q --no-cov`
Expected: FAIL (exit code != 0 / "No such command 'reanchor'").

- [ ] **Step 3: Implement the CLI command (add near `derive_target`, ~debug.py:1494)**

```python
@target_app.command(name="reanchor")
def reanchor_target(
    target_json: Annotated[Path, typer.Argument(help="Saved TargetSpec JSON (from build_target_spec.save_json).")],
    pcdump: Annotated[Optional[Path], typer.Argument(help="New compile's pcdump. Auto-resolves via -f if omitted.")] = None,
    function: Annotated[str, typer.Option("--function", "-f", help="Function name.")] = "",
    class_id: Annotated[int, typer.Option("--class", help="Register class (0=GPR).")] = 0,
    output_format: Annotated[str, typer.Option("--format", help="yaml|json.")] = "yaml",
) -> None:
    """Express a saved TargetSpec in a new compile's ig-numbering (Unit 3).

    Runs the role matcher (forward + inverse round-trip) and prints the
    force-phys-safe target spec {function, virtuals, spilled} for the new compile
    on stdout; per-role diagnostics (gone/merged/split/ambiguous/unstable_identity/
    no_descriptor — all EXCLUDED from the map) go to stderr. Feed stdout to
    `inspect first-divergence` as the --force-phys target.
    """
    from ..mwcc_debug import role_descriptor as rd
    from ..mwcc_debug import role_reanchor as rr
    from ..mwcc_debug import first_divergence as fd
    target = rd.TargetSpec.load_json(target_json)
    fn = function or target.function
    pcdump = _resolve_pcdump_path(pcdump, fn)
    new_c = rd.Compile.from_text(pcdump.read_text(), fn, "")
    res = rr.reanchor(target, new_c, class_id=class_id)
    spilled = sorted({e.ig_idx for s in new_c.fev.simplify_sections if s.class_id == class_id
                      for e in s.entries if e.spilled and e.ig_idx >= 0}) if new_c.fev else []
    spec = rr.reanchor_to_target_spec(res, fn, spilled=spilled)
    for ig, status in sorted(res.diagnostics.items()):
        print(f"[reanchor] role {ig}: {status} (excluded)", file=sys.stderr)
    print(f"[reanchor] {len(spec['virtuals'])} matched -> force-phys, "
          f"{len(res.diagnostics)} excluded", file=sys.stderr)
    if (output_format or "yaml").lower() == "json":
        print(json.dumps(spec, indent=2))
    else:
        print(f"function: {spec['function']}")
        print("virtuals:")
        for v in sorted(spec["virtuals"]):
            print(f"  {v}: {spec['virtuals'][v]}")
        if spec["spilled"]:
            print("spilled:")
            for v in spec["spilled"]:
                print(f"  - {v}")
```

- [ ] **Step 4: Run; PASS. Commit.**

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_role_reanchor.py
git commit -m "feat(reanchor): target reanchor CLI command"
```

---

## Task 6: Gate — cross-rev corpus re-anchoring

**Files:**
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the gate test (parametrized over the labeled corpus)**

```python
import json, collections
FIX_LABELS = sorted(FIX.glob("*_labels.json"))

@pytest.mark.parametrize("lab_path", FIX_LABELS, ids=lambda p: p.stem)
def test_reanchor_gate_cross_rev_lands_on_labeled_igs(lab_path):
    """Build a target from the reference rev over the adjudicated roles, re-anchor
    into the drifted rev, and assert each role's desired_phys lands on its
    adjudicated wip ig (the ground truth that defeats raw ig_idx). Confirms Unit 3
    produces a correct force-phys map over the new compile, end to end."""
    lab = json.loads(lab_path.read_text())
    fn, cls = lab["function"], lab["class_id"]
    mp, wp = FIX / lab["matched_dump"], FIX / lab["wip_dump"]
    if not (mp.exists() and wp.exists()):
        pytest.skip("corpus dumps missing")
    same = {int(k): v for k, v in lab["same"].items()}
    mc = rd.Compile.from_text(mp.read_text(), fn, "")
    wc = rd.Compile.from_text(wp.read_text(), fn, "")
    mdescs = rd.build_descriptors(mc, cls)
    scored = [ig for ig in same if ig in mdescs]
    if len(scored) < 3:
        pytest.skip("too few adjudicated roles")
    # give each adjudicated role a distinct desired phys so we can trace it
    desired = {ig: 13 + i for i, ig in enumerate(scored)}
    target = rd.build_target_spec(mc, desired, cls, "force_proof_proxy", provenance={"src": "gate"})
    res = rr.reanchor(target, wc, class_id=cls)
    # every recovered role's phys must appear at its adjudicated wip ig
    landed = sum(1 for ig in scored if res.force_phys.get(same[ig]) == desired[ig])
    assert landed >= 0.8 * len(scored), (
        f"{lab_path.stem}: re-anchored {landed}/{len(scored)} roles onto their wip ig "
        f"(diagnostics: {res.diagnostics})")
    # and NO desired phys may land on the WRONG ig (no confident-wrong force-phys)
    wrong = {ig: res.force_phys.get(same[ig]) for ig in scored
             if same[ig] in res.force_phys and res.force_phys[same[ig]] != desired[ig]}
    assert not wrong, f"{lab_path.stem}: phys landed on wrong ig: {wrong}"
```

- [ ] **Step 2: Run the gate over the whole corpus**

Run: `cd tools/melee-agent && timeout 120 python -m pytest tests/test_role_reanchor.py -q --no-cov`
Expected: PASS for all label-file functions (the matcher recovered 104/104 in Gate 1b, so re-anchoring lands ≥0.8 with no wrong placements).

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_role_reanchor.py
git commit -m "test(reanchor): cross-rev corpus gate (lands on adjudicated wip igs)"
```

---

## Task 7: End-to-end smoke — reanchor output drives first-divergence

**Files:**
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the smoke test**

```python
def test_reanchor_output_feeds_first_divergence_without_error():
    """The reanchored {virtuals} map builds a fd.TargetColoring that first-divergence
    consumes on the new compile without raising — the integration contract."""
    from src.mwcc_debug import first_divergence as fd
    fn = "mnVibration_80248644"
    mp, wp = FIX / "mnVibration_matched_pcdump.txt", FIX / "mnVibration_wip_pcdump.txt"
    if not (mp.exists() and wp.exists()):
        pytest.skip("corpus missing")
    mc = rd.Compile.from_text(mp.read_text(), fn, "")
    wc = rd.Compile.from_text(wp.read_text(), fn, "")
    md = rd.build_descriptors(mc, 0)
    desired = {ig: 13 + (i % 5) for i, ig in enumerate(list(md)[:6])}
    target = rd.build_target_spec(mc, desired, 0, "force_proof_proxy", provenance={})
    res = rr.reanchor(target, wc, class_id=0)
    tc = fd.TargetColoring(class_id=0, force_phys=res.force_phys)
    assert set(tc.force_phys.keys()) == fd.target_identity_set(tc)   # contract holds
```

- [ ] **Step 2: Run; PASS. Commit.**

```bash
git add tools/melee-agent/tests/test_role_reanchor.py
git commit -m "test(reanchor): end-to-end TargetColoring contract with first-divergence"
```

---

## Final verification

- [ ] Run the focused suite: `cd tools/melee-agent && timeout 120 python -m pytest tests/test_role_reanchor.py tests/test_role_identity_gate1.py tests/test_role_matcher.py tests/test_role_descriptor.py -q --no-cov` → all pass.
- [ ] Run the full package suite once (regression): `cd tools/melee-agent && python -m pytest -q --no-cov` → no new failures. **Do not delete the worktree while this runs** (a lesson from Gate-1b: deleting the worktree mid-run invalidates the result).
- [ ] Use superpowers:finishing-a-development-branch.

---

## Notes / deferred (Unit 4+, do NOT build here)

- **Multi-anchor consensus** (original / previous-rev / last-stable) and `drifted_identity` / `provisional_chained` — need loop rev-history; Unit 4.
- **The convergence loop, progress classifier, parallel harness** — Units 4–5.
- **Non-GPR classes** — `build_descriptors` is guarded to class 0; reanchor inherits that (class_id defaults 0).
