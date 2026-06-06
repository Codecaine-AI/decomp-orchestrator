# Frame Local Dematerialize Design

## Goal

Add a safe semantic source lever for `debug mutate frame-transform-search` when
the current frame is larger than the target frame, the desired delta is negative,
and there is no explicit `PAD_STACK` reservation to shrink.

This closes issue #369's root cause: frame-transform-search can already compile
and score candidate sources, but its frame-size-capable source operators are
limited to PAD_STACK and a few FP-constant patterns. Matching agents need a
bounded candidate family that can remove or relocate a simple local stack home
without changing C semantics.

## Chosen Approach

Add a generated probe operator named `frame-local-dematerialize` to
`generate_frame_directed_probes` in
`tools/melee-agent/src/mwcc_debug/pressure_explorer.py`.

The operator searches the target function with tree-sitter-backed statement
spans first. It rewrites exact captured spans only, after masking comments and
strings for identifier counts. It only produces candidates for a local that
meets all of these requirements:

- the declaration, assignment when present, and use are sibling statements in
  the same compound block and `scope_path`;
- the local is a single simple scalar or pointer declarator, not an array,
  aggregate, function pointer, storage-class declaration, volatile declaration,
  macro-shaped declaration, or multi-declarator statement;
- the value comes from either `type name = expr;` or from `type name;` followed
  by a single `name = expr;`;
- `expr` is side-effect-free by syntax: no calls, assignment, comma operator,
  ternary, increment/decrement, volatile keyword, or address-taking/dereference
  operation;
- the assignment and use are adjacent except for blank lines, comments, and
  declaration statements; any intervening executable statement, preprocessor
  directive, label, call, assignment, increment/decrement, or mutation of an RHS
  dependency rejects the candidate;
- the local has exactly one read after its value is established;
- the read is a standalone rvalue occurrence in a call argument or simple RHS,
  not an lvalue, address-taken value, increment/decrement, member assignment
  target, condition rewrite, loop header, return statement, goto, label, case,
  break, or continue;
- no statement between value establishment and the read references the local;
- all edited spans are within one tree-sitter statement scope.

For declaration-with-initializer candidates, the mutation removes the local
declaration and substitutes the one safe rvalue use with a parenthesized cast to
the declared local type, preserving assignment conversion semantics:
`((type) (expr))`. For declaration-plus-assignment candidates, the mutation
removes both the declaration and assignment only when the declaration is a
standalone simple declaration. It substitutes the one safe rvalue use with the
assignment RHS using the same casted form.

The operator deliberately does not rewrite lvalues, cross control-flow
boundaries, duplicate function calls, duplicate increment/decrement expressions,
or try to prove alias behavior. If a candidate fails any guard, it is rejected and
reported through aggregate rejection metadata rather than partially rewritten.

## Alternatives Considered

### Extend PAD_STACK only

PAD_STACK is the safest existing source lever, and the #366 work made it
delta-aware. It cannot shrink a frame when no explicit pad exists, which is the
specific #369 failure mode.

### Reuse generic lifetime-layout probes

Generic lifetime probes are still valuable fallback candidates, but they are not
frame-size-capable enough to support a ceiling verdict. The evaluator correctly
treats unchanged generic probes as inconclusive. They do not give agents a
specific source-actionable explanation for no-pad `-8` frame deltas.

### Full C semantic analysis

A full semantic analyzer would be safer and broader, but it is too large for the
current issue. Tree-sitter statement spans plus conservative expression guards
cover the one-use local dematerialization pattern without changing the broader
tool architecture.

## Data Flow

1. `mutate_frame_transform_search_cmd` derives `current_frame`,
   `expected_frame`, and `frame_reservation_delta` as it does today.
2. It calls `generate_frame_directed_probes(...)`.
3. The generator emits existing PAD_STACK and FP-constant probes.
4. When the frame appears too large or unknown, it also asks the new
   `frame-local-dematerialize` helper for bounded one-use local probes. The
   operator is included in frame-transform-search's default directed operators,
   frame-size-capable operator set, and first-divergence operator priority.
5. The CLI materializes generated `.c` files, compiles them when requested, and
   scores them with the existing frame-transform evaluator.
6. Each generated probe carries provenance:
   - `kind: "frame-local-dematerialize"`;
   - `local`;
   - `action: "remove-initialized-local"` or `"remove-assigned-local"`;
   - `expression`;
   - `use_kind`;
   - source line ranges for the declaration, assignment when present, and use.
7. If no dematerialization candidate can be emitted for a shrink/no-pad case, the
   probe plan and frame-transform evaluation surface `no-safe-semantic-lever`
   instead of promoting unchanged generic probes to a ceiling. The status is only
   used when a source file was provided, the semantic operator was not filtered
   out, and the source scan completed with no safe candidate. Missing source or
   an explicit operator filter that excludes the semantic operator remain
   separate inconclusive states.

## Output Contract

Generated probe records include the existing fields plus the new operator and
provenance. Example:

```json
{
  "label": "frame-local-dematerialize-dy",
  "operator": "frame-local-dematerialize",
  "description": "Inline one-use local `dy` into its final rvalue use.",
  "provenance": {
    "kind": "frame-local-dematerialize",
    "local": "dy",
    "action": "remove-initialized-local",
    "expression": "pos->y - prev->y",
    "cast_type": "f32",
    "use_kind": "call-argument",
    "decl_line": 4,
    "use_line": 7
  }
}
```

For no-candidate shrink cases, JSON output includes:

```json
{
  "semantic_lever_status": {
    "status": "no-safe-semantic-lever",
    "operator": "frame-local-dematerialize",
    "reason": "no one-use side-effect-free local could be safely dematerialized"
  }
}
```

The frame-transform evaluator uses this metadata to set an inconclusive stop
condition rather than a ceiling verdict for shrink/no-pad searches that measured
no frame-size-capable semantic candidate.

## Error Handling And Safety

Tree-sitter unavailability, parse errors, ambiguous declarations, multiple reads,
or unsafe expressions produce no source mutation. The generator should never
throw for ordinary source. It should return no candidate and, where the CLI has a
probe plan payload, include aggregate rejection counters such as
`unsafe-expression`, `multiple-reads`, `not-rvalue-use`, `cross-scope`,
`not-adjacent`, `dependency-mutation`, or `unsupported-type`.

Generated source is still validated by the existing compile and real-tree score
path before any candidate is treated as source-reachable. A generated source
candidate that does not compile is reported as a failed variant with the retained
source path, matching existing frame-transform-search behavior.

## Testing

Add tests before implementation:

- generator emits a `frame-local-dematerialize` probe for a one-use initialized
  local used as a call argument in the next executable statement, and the
  retained source has the local removed with the casted expression inlined;
- generator emits the same operator for `type name; name = expr;` followed by a
  single safe adjacent rvalue use;
- generator rejects side-effectful initializer calls, ternary/comma/assignment
  RHS, increments, lvalue uses, address-taking, multiple reads, cross-scope or
  nested-block cases, condition and return uses, side-effectful sibling call
  arguments, intervening executable statements, dependency mutation,
  preprocessor directives, shadowing, multi-declarators, volatile/storage-class
  declarations, and unsupported narrowing/aggregate cases;
- `debug mutate frame-transform-search --no-compile-probes --json` lists the
  generated operator and provenance for a too-large/no-pad source;
- with a fake compiler returning the target frame, the CLI ranks the generated
  candidate as `source-reachable-frame-transform`;
- shrink/no-pad with no safe semantic candidate reports
  `no-safe-semantic-lever` and does not emit a ceiling verdict.

## Scope

This spec does not add a general C optimizer, does not reorder statements across
branches or loops, does not introduce new AST infrastructure outside the existing
mwcc-debug source-span helpers, and does not change PAD_STACK behavior.
