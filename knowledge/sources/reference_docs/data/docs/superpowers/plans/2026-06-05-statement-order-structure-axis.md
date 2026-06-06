# Statement-Order Structure Axis Plan

1. Add RED tests in `tools/melee-agent/tests/search/test_structure.py`.
   - `generate_statement_order_variants` emits split/fuse shift-or candidates.
   - It ignores comments/literals, preprocessor-touched statements, and RHS
     self-reference.
   - It rejects RHS assignment, `++`, `--`, comma, and ternary syntax.
   - It emits adjacent independent statement swaps and rejects dependent pairs
     plus unknown/global-looking identifiers.
   - `run_structure_search` accepts `statement-order`, produces retained
     candidate files, and removes `statement-order` from `future_axes`.
   - Unscored candidate-only payloads use `stop_condition.kind ==
     "candidates-generated"`.
   - Mixed scored non-improving variants plus unscored statement-order
     candidates also use `candidates-generated`.

2. Add CLI smoke tests in `tools/melee-agent/tests/search/test_cli_smoke.py`.
   - Help text documents `statement-order`.
   - JSON output for `--axis statement-order` includes a statement-order
     variant and source path.
   - Text output renders the statement-order axis/operator, retained source
     path, and `candidates-generated` stop condition coherently.

3. Implement the statement-order generator in
   `tools/melee-agent/src/search/structure.py`.
   - Add `statement-order` to `DEFAULT_STRUCTURE_AXES`.
   - Wire the axis in `run_structure_search`.
   - Add split/fuse shift-or scanners.
   - Add conservative local-scalar-only adjacent simple-statement swaps.
   - Add metadata helpers for touched lines and compact unified diffs.

4. Update payload stop conditions and future axes.
   - Remove `statement-order` from `future_axes`.
   - Return `candidates-generated` when unscored candidates exist and no
     measured improvement is available.

5. Verify.
   - Focused structure tests.
   - CLI smoke tests.
   - `python -m compileall tools/melee-agent/src/search/structure.py`
   - `git diff --check`
   - Real CLI smoke with a temporary source file using
     `melee-agent debug search structure --axis statement-order`.

6. Request independent subagent review.
   - First spec/plan review before implementation.
   - Code-quality/spec compliance review after tests and smoke pass.

7. Commit, refresh editable `melee-agent`, resolve #420, and list the open
   issue queue.
