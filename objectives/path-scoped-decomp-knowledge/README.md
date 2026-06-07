# Path-Scoped Decomp Knowledge

This objective builds the runtime knowledge layer for global Melee decomp
standards and target-path-specific quick facts.

The intended end state:

- workers/writers always receive global standards from the global standards
  source;
- workers/writers also receive bounded path facts resolved from the target
  source path from the path facts source;
- QA/PR handoff checks global standards and verifier evidence;
- the knowledge curator can propose updates to the standards source or path
  facts source without directly mutating source corpora;
- every top-level Melee source directory has either accepted path facts or a
  recorded no-fact-needed disposition.

Every created source-specific slice must be high quality. Do not be lazy:
generic summaries, copied global standards, or unverified facts do not meet the
bar. Use `examples/item_decomp_slice_quality_reference.md` as the quality
reference for the level of specificity expected.

## Objective Files

- `goal.md` - objective, context refresh, strategy, success metrics, non-goals,
  and completion criteria.
- `current_state.md` - compact objective-local handoff state for active work.
- `context/00_problem.md` - problem statement and motivation.
- `context/01_constraints.md` - hard constraints, validity rules, and
  boundaries.
- `context/02_implementation_scope.md` - files, modules, and systems this
  objective may change.
- `context/03_working_plan.md` - phase-gated execution plan with inputs,
  outputs, gates, and failure handling.
- `context/04_validation_and_handoff.md` - acceptance checks and handoff rules.
- `examples/item_path_fact.json` - example path fact record based on the item
  directory pattern.
- `examples/item_decomp_slice_quality_reference.md` - reference for the quality
  and specificity expected from source-specific slices.

Objective path: `objectives/path-scoped-decomp-knowledge/`
