# mwcc-debug handoff — 2026-05-22

`debug suggest-coalesce-source` shipped. Bridges `--force-coalesce`
(proves an allocation is reachable) and natural C-source patterns
(makes the match real, not a DLL artifact).

## CLI

```bash
# Pair mode — explain how to reach a confirmed coalesce naturally
melee-agent debug suggest-coalesce-source -f fn_802461BC -V 53=3

# Discover mode — find candidate coalesces that would shorten the cascade
melee-agent debug suggest-coalesce-source -f fn_802461BC --discover --top 3
```

## What it does

Pair mode: given the agent's confirmed force-coalesce target pair,
runs IR-level pattern checkers (DirectIdentity, ChainInit, AliasSplit,
CommonSubExpr, TernaryCollapse) over the function's pre-coloring pass.
Each matching checker emits a ranked Suggestion with IR evidence,
source-line hint (when the bridge is confident), and a catalog
cross-reference.

Discover mode: identifies the longest callee-save cascade in the
function and proposes coalesces that would shorten it. End-of-chain
candidates (which actually shrink the stmw range) are surfaced first;
mid-chain candidates carry depends_on annotations so the agent knows
which merges must succeed first.

## Workflow integration

1. Agent confirms `--force-coalesce 53=3` reaches the target (DLL artifact)
2. Run `suggest-coalesce-source -V 53=3` to get pattern-named C-source
   transformations
3. Try each suggestion; verify the natural compile reaches the target
4. If nothing fires, fall-through block shows raw IR facts so the agent
   can reason manually

## Tests

- 20+ unit tests across three layers (IR facts, pattern checkers,
  orchestrator)
- 2 calibration cases in coalesce_calibration.yaml (corpus grows
  organically — new historical wins added as YAML entries, no new
  test code)
- 1 CLI smoke test

## Files

- `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py` — IR analysis layer
- `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py` — 5 checkers
- `tools/melee-agent/src/mwcc_debug/suggest_coalesce.py` — orchestrator
- `tools/melee-agent/src/cli/debug.py` — CLI wiring
- `tools/melee-agent/tests/fixtures/coalesce_calibration.yaml` — corpus

Spec: `docs/superpowers/specs/2026-05-19-suggest-coalesce-source-design.md`
