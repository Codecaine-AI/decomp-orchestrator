# Statement-Order Structure Axis Design

## Context

Issue #420 reports that `debug search structure` covers case order,
control-flow shape, and declaration order, but misses statement/source-order
levers. The motivating `hsd_803AC558` improvement came from splitting a fused
byte accumulation expression into two ordered statements:

```c
size = (size << 8) | p[3];
```

to:

```c
size <<= 8;
size |= p[3];
```

That changed MWCC lowering from a fused insert shape toward the target
`slwi`/`or` shape. Agents need this class surfaced by the structure-search
workflow instead of hand-discovering it.

## Scope

Add `statement-order` as a first-class `debug search structure` axis. The axis
is source-only by default, matching the post-#419 non-mutating behavior: it
writes candidate `.c` files under the output directory and never edits the live
source. Candidates carry source diffs and touched statement line spans so an
agent can review, apply, and run the normal compile/checkdiff verification.

The first implementation covers two bounded operator families:

- `statement-order-split-shift-or`: split self-referential fused assignments of
  the form `x = (x << N) | rhs;` or `x = rhs | (x << N);` into `x <<= N;`
  followed by `x |= rhs;`.
- `statement-order-fuse-shift-or`: generate the reverse candidate for adjacent
  `x <<= N; x |= rhs;` statements, so searches can test both spellings.
- `statement-order-adjacent-swap`: swap adjacent independent simple scalar
  statements in the same block when a conservative read/write check proves no
  overlap.

This does not attempt arbitrary C refactoring, pointer-memory statement
reordering, declaration movement, queue-copy side-effect analysis, or live
candidate scoring. Those remain outside this axis until a dedicated scorer or
AST-level effect model exists.

## Safety Rules

- Operate only inside the requested function span.
- Mask comments and literals before pattern scanning.
- Reject candidates whose touched source includes preprocessor directives.
- For split/fuse, require a simple identifier LHS and reject RHS text that
  references the same identifier.
- Preserve indentation and original surrounding source.
- For adjacent swaps, only consider direct simple statement siblings in a block.
  Reject calls, control-flow statements, declarations, pointer/member/indexed
  memory access, labels, gotos, and any pair with read/write or write/write
  overlap. Only swap assignments whose read/write identifiers are known
  function-local scalar declarations in the requested function; reject unknown
  or global-looking storage.
- For split/fuse, reject RHS text with side-effecting or sequencing-sensitive
  syntax such as assignment operators, `++`, `--`, comma operators, and
  ternaries.
- Deduplicate identical candidate source.

## Output Contract

`DEFAULT_STRUCTURE_AXES` includes `statement-order`, and
`structure_payload.future_axes` no longer lists it.

Each variant uses:

- `axis: "statement-order"`
- `operator`: one of the statement-order operators above
- `label`: stable operator/index label
- `status: "candidate"` unless a future runner supplies measured scores
- `source_retained` and `path`: generated candidate file
- `metadata.touched_lines`: one-based source line range
- `metadata.source_diff`: compact unified diff for the candidate
- operator-specific metadata such as `lhs`, `shift`, `rhs`, or
  `statement_order`

If any unscored candidates are generated and no measured improvement is already
available, the structure stop condition should not claim `no-improvement`; it
should report `candidates-generated` so agents know there is source-actionable
work to verify. This applies even when other axes produced scored but
non-improving variants.

## Tests

Regression tests should cover:

- split shift/or candidates and their retained source;
- reverse fuse candidates;
- rejection of comments/literals/preprocessor, RHS self-reference, RHS
  assignment, `++`, `--`, comma, and ternary syntax;
- conservative adjacent independent swaps, dependency rejection, and rejection
  for unknown/global-looking identifiers;
- orchestration through `run_structure_search(..., axes=("statement-order",))`;
- payload future axes no longer include `statement-order`;
- `candidates-generated` for unscored candidates, including mixed scored
  non-improving plus unscored payloads;
- text/JSON CLI smoke for the new axis.
