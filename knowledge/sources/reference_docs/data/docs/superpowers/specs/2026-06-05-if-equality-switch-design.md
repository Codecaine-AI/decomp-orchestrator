# If Equality Switch Control-Flow Shape Design

## Goal

Add a conservative `control-flow-shape-search` source transform that can try the known MWCC shape lever where `if (x == C) { body }` compiles as an inverted branch, but the target object may use the non-inverted single-case switch layout.

## Scope

The feature adds one local control-flow-shape operator: `if-equality-to-single-case-switch`.

The operator is intentionally narrow:

- Match safe tree-sitter `if_statement` nodes anywhere in the target function body. The motivating case is a leading `if`, but the operator is safe to generate for any matching equality `if` because the CLI compile/score step decides whether the rewrite helps.
- Require no `else` clause.
- Require an equality condition using `==`.
- Require a compound consequence body.
- Rewrite only one side of the comparison as the switch expression and the other side as the case expression.
- Reject preprocessor-touched regions.
- Reject moved bodies containing labels, `case`, `default`, `break`, `continue`, or `goto`.
- Reject obvious non-integral switch/case expressions such as `NULL`, string literals, float literals, and variable-vs-variable comparisons.

Out of scope:

- Multi-case switches.
- Relational comparisons.
- Switch rewrites with `else` bodies.
- Type inference beyond simple syntactic safety checks.

## Rewrite Shape

The generated source should preserve local scope by placing the original body inside braces under the case label:

```c
switch (expr) {
case C: {
    body;
    break;
}
}
```

This avoids invalid declaration-after-label cases and keeps variables declared in the original `if` body scoped to that body.

## Integration

`tools/melee-agent/src/mwcc_debug/control_flow_shape.py` owns the operator. It must add the operator to `DEFAULT_CONTROL_FLOW_OPERATORS`, exclude it from `_DELEGATED_OPERATORS` by including it in the local operator set, and dispatch it from `_local_control_flow_probes`.

The CLI in `tools/melee-agent/src/cli/debug.py` already validates operators against `DEFAULT_CONTROL_FLOW_OPERATORS` and compiles generated probes. No CLI behavior change is planned beyond the new operator becoming discoverable.

## Validation

Focused unit tests must cover:

- Operator registry inclusion.
- Successful `if (state->mode == 0x13) { call(state); }` rewrite.
- Constant-on-left rewrite such as `if (0x13 == state->mode)`.
- Scope preservation for bodies with declarations.
- Rejection of preprocessor-touched regions.
- Rejection of `else` clauses, pointer/`NULL`, float literals, variable case labels, and moved bodies containing labels, `case`, `default`, `break`, `continue`, or `goto`.

Command-level checks:

- `python -m pytest tools/melee-agent/tests/test_control_flow_shape.py -q --no-cov`
- `python -m pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_control_flow_shape_search_help_works -q --no-cov`
- `python -m compileall tools/melee-agent/src/mwcc_debug/control_flow_shape.py`
- A dry-run or live command against `fn_8019A71C` showing the operator produces at least one probe and, when practical, reaches a validated 100% candidate.
- A harvest dry-run or equivalent bounded sweep over the control-flow-shape rows from #388, recording how many rows the new operator closes beyond `fn_8019A71C`. The issue can still resolve if the count is zero beyond `fn_8019A71C`, but the count must be recorded.
