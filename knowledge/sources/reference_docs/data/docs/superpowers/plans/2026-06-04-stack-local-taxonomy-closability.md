# Stack Local Taxonomy Closability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add frame divergence cause and closability tier routing to stack-local-layout taxonomy artifacts, stuck diagnostics, and the dashboard.

**Architecture:** Implement a pure mapper in `mwcc_debug.frame_taxonomy`, then wire the mapper into the inventory script and stuck static digest. Dashboard changes consume the new record fields without changing artifact loading.

**Tech Stack:** Python, pytest, existing checkdiff JSON classifications, static HTML/JavaScript dashboard template.

---

### Task 1: Frame Taxonomy Mapper

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/frame_taxonomy.py`
- Test: `tools/melee-agent/tests/test_frame_taxonomy.py`

- [ ] **Step 1: Write mapper tests**

Add tests for:

```python
def test_checkdiff_pure_reservation_maps_to_current_tools_padstack():
    classification = {
        "primary": "stack-layout",
        "stack_frame_delta": {"missing_stack_bytes": 16},
    }
    result = classify_frame_taxonomy(
        "demo_fn",
        classification=classification,
        source_path="src/melee/demo.c",
    )
    assert result["cause"] == "pure-reservation"
    assert result["closability_tier"] == "current-tools-padstack"
    assert "--frame-reservation-bytes 16" in result["next_command"]
    assert "PAD_STACK(" not in result["next_command"]
```

Also test `missing_stack_bytes < 0` maps to `frame-too-large/gen-gated-366`, `stack-slot-layout` maps to `stack-object-offset-shift/reorder-gated-362`, and the real checkdiff marker shape `classification["stack_slot_localizer"]["reserved_low_spill_region"]` maps to `reserved-unused-low-spill-region/ceiling`. The current-tools command must be an executable frame-transform-search command and must not tell agents to commit `PAD_STACK`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_frame_taxonomy.py -q
```

Expected: import failure or missing function failure.

- [ ] **Step 3: Implement mapper**

Create `classify_frame_taxonomy(function, classification, source_path=None, frame_report=None) -> dict | None`. Return `None` unless the classification or frame report describes stack-layout or stack-slot-layout. Include `cause`, `raw_cause`, `verdict`, `raw_verdict`, `closability_tier`, `attribution_status`, `source_object`, `source_object_symbol`, `next_command`, and `reason`.

Add frame-report tests for source-attributed divergence, frame-size-only unattributed divergence, `source-reachable-validated`, `partial-source-reachable-validated`, `attributed-frame-unchanged`, and `internal-tiebreak-ceiling`. Preserve raw cause/verdict fields in every frame-report result.

Correction from #412: also test that `stack-object-size-or-alignment` and
`type-size-or-alignment` frame-report causes are preserved as size/alignment
causes rather than normalized to `lifetime-or-ordering-shift`; these remain
`gen-gated-366` and must not route through `lifetime-layout`.

- [ ] **Step 4: Verify mapper tests pass**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_frame_taxonomy.py -q
```

### Task 2: Inventory Records And Queues

**Files:**
- Modify: `tools/function_taxonomy_inventory.py`
- Modify: `tools/melee-agent/tests/test_function_taxonomy_inventory.py`

- [ ] **Step 1: Write inventory regression**

Extend fake checkdiff payloads to include stack frame metadata and assert records contain:

```python
assert records[0]["frame_cause"] == "stack-object-offset-shift"
assert records[0]["frame_closability_tier"] == "reorder-gated-362"
assert records[0]["next_command"] == records[0]["frame_next_command"]
assert "frame_closability_tier" in stack_queue_header
```

Add fake rows for pure reservation and reserved low spill ceiling.

- [ ] **Step 2: Verify inventory test fails**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_function_taxonomy_inventory.py -q
```

- [ ] **Step 3: Wire mapper into inventory**

Add a `tools/melee-agent` `sys.path` shim, then import `src.mwcc_debug.frame_taxonomy.classify_frame_taxonomy`. For stack-local-layout rows, attach mapper fields as `frame_cause`, `frame_raw_cause`, `frame_verdict`, `frame_raw_verdict`, `frame_closability_tier`, `frame_attribution_status`, `frame_source_object_symbol`, `frame_source_object`, `frame_next_command`, and replace `next_command` with `frame_next_command`.

Update `write_csv` and `write_queue` field lists to include the new fields.

- [ ] **Step 4: Verify inventory tests pass**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_function_taxonomy_inventory.py -q
```

### Task 3: Stuck Static Digest

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Write stuck routing regressions**

Update the existing frame-size and same-slot stuck tests to assert `frame_residual["closability_tier"]`. Add a reserved-low-spill classification payload using `classification.stack_slot_localizer.reserved_low_spill_region` and assert the first next step is a ceiling/banking instruction rather than lifetime-layout. Add a pcdump-backed `_frame_residual_hint_from_report` unit test that includes `frame_first_divergence` and verifies mapper fields are present.

- [ ] **Step 2: Verify stuck tests fail**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_inspect_stuck_routes_frame_size_rows_to_frame_tools tools/melee-agent/tests/test_debug_cli_reorg.py::test_inspect_stuck_routes_same_slot_rows_to_lifetime_layout -q
```

- [ ] **Step 3: Use mapper in `_frame_residual_hint_from_checkdiff_classification`**

Call `classify_frame_taxonomy` and build the existing hint shape from the mapper result in both `_frame_residual_hint_from_checkdiff_classification` and `_frame_residual_hint_from_report`. Preserve old `kind`, `subcategory`, `message`, `summary`, and `next_steps` keys for compatibility while adding `cause`, `raw_cause`, `verdict`, `raw_verdict`, `closability_tier`, `attribution_status`, `source_object_symbol`, and `source_object`.

- [ ] **Step 4: Verify stuck tests pass**

Run the focused tests from Step 2 plus the new reserved-low-spill test.

### Task 4: Dashboard Filters And Detail

**Files:**
- Modify: `tools/function_taxonomy_dashboard_template.html`
- Modify: `tools/melee-agent/tests/test_function_taxonomy_dashboard.py`

- [ ] **Step 1: Write dashboard template regression**

Assert the default template contains `closabilityFilter`, `frame_closability_tier`, `frame_source_object_symbol`, and `Frame closability`. Also assert the inline script references `closabilityFilter` in init/reset/filter paths.

- [ ] **Step 2: Verify dashboard test fails**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_function_taxonomy_dashboard.py -q
```

- [ ] **Step 3: Add dashboard UI**

Add a closability `<select>`, include it in control initialization/reset/filtering, search `frame_cause` and `frame_closability_tier`, show closability in the table and selected detail, and add a metric for `current-tools-padstack` stack rows.

- [ ] **Step 4: Verify dashboard tests pass**

Run:

```bash
PYTHONPATH=tools/melee-agent pytest tools/melee-agent/tests/test_function_taxonomy_dashboard.py -q
```

### Task 5: Verification And Commit

**Files:**
- All files above

- [ ] **Step 1: Run focused suite**

```bash
PYTHONPATH=tools/melee-agent pytest \
  tools/melee-agent/tests/test_frame_taxonomy.py \
  tools/melee-agent/tests/test_function_taxonomy_inventory.py \
  tools/melee-agent/tests/test_function_taxonomy_dashboard.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_inspect_stuck_routes_frame_size_rows_to_frame_tools \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_inspect_stuck_routes_same_slot_rows_to_lifetime_layout \
  -q
```

- [ ] **Step 2: Run command smoke checks**

```bash
python3 tools/function_taxonomy_inventory.py --report build/GALE01/report.json --output /tmp/function-taxonomy-smoke --limit 3 --workers 1 --skip-decl-order-eval
python3 tools/function_taxonomy_dashboard.py /tmp/function-taxonomy-smoke --skip-node-check
melee-agent debug inspect stuck fn_80000000 --help
```

- [ ] **Step 3: Refresh editable install**

```bash
python -m pip install -e tools/melee-agent
```

- [ ] **Step 4: Commit**

Commit the spec, plan, tests, and implementation:

```bash
git add docs/superpowers/specs/2026-06-04-stack-local-taxonomy-closability-design.md \
  docs/superpowers/plans/2026-06-04-stack-local-taxonomy-closability.md \
  tools/function_taxonomy_inventory.py \
  tools/function_taxonomy_dashboard_template.html \
  tools/melee-agent/src/mwcc_debug/frame_taxonomy.py \
  tools/melee-agent/src/cli/debug.py \
  tools/melee-agent/tests/test_frame_taxonomy.py \
  tools/melee-agent/tests/test_function_taxonomy_inventory.py \
  tools/melee-agent/tests/test_function_taxonomy_dashboard.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add stack local closability taxonomy"
```
