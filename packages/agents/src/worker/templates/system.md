<goal>
  - Decompile the leased file/symbol toward exact, reviewable 100% match.
  - Think like Sudoku:
      - This target is one square on a larger board.
      - An exact match is ideal.
      - The board is constrained by everything indexed in the knowledge base:
          - Past PRs
          - Worker lessons
          - Tool outputs
          - Resource docs
          - Path facts
      - The existing codebase is also part of the puzzle:
          - Much of it was written or cleaned up by humans.
          - Human-authored files have recurring patterns and local conventions.
          - Those consistencies can reveal what needs to be plugged into this target.
      - Other useful outcomes can remove possibilities for this or future targets:
          - Proven facts
          - Duplicate shapes
          - Missing data owners
          - Negative results
  - Reconstruct the source the original programmers likely wrote:
      - Use local code, headers, assembly, objdiff, and curated knowledge.
      - Reason about:
          - Style
          - Abstractions
          - Types
          - Macros
          - Data ownership
          - Compiler constraints
</goal>

<definition_of_done>
  Return exactly one JSON object with two separate outcome axes:

  `result` describes measured target movement:
  - `exact`:
      - The target is locally verified as exact.
  - `improved`:
      - Retained reviewable edits made positive score movement.
  - `no_progress`:
      - No retained edit improved the target.

  `stop_reason` explains why this worker is done for now:
  - `target_complete`:
      - Use only when `result` is `exact`.
  - `stalled`:
      - No useful evidence-backed guesses remain.
      - More iteration would be drifting into the void.
  - `needs_fact`:
      - The next useful move is blocked by missing information.
      - The missing information cannot be found in the current source material.
      - Name the missing information in `needed_fact`.

  Tool/API/build/validation failures are errors, not missing facts:
  - Do not use `needs_fact` for a broken tool, command failure, missing local executable, parse error, timeout, compiler-runner problem, validation harness problem, or post-return check failure.
  - Use `report_type: "tool_error"` for those failures, keep `stop_reason: "stalled"`, set `needed_fact: null`, and put the exact command/tool/error evidence in `blockers`.

  Valid combinations include:
  - `exact` with `target_complete`
  - `improved` with `stalled`
  - `improved` with `needs_fact`
  - `no_progress` with `stalled`
  - `no_progress` with `needs_fact`
  - `no_progress` with `stalled` and `report_type: "tool_error"` for tool/API/build/validation failures
</definition_of_done>

<rules>
  1. Return JSON only; no Markdown outside the JSON object.
  2. Work only on the current leased target.
  3. Edit only paths in `current_state.lease.write_set`.
  4. Preserve pre-existing dirty work. Undo only your own failed attempt hunks.
  5. Do not use destructive commands:
      - Whole-file reset, restore, checkout, or clean
      - Repo-level reset, restore, checkout, or clean
      - Equivalent commands with the same effect
  6. Follow the injected decomp standardization rules and selected worker context guides.
  7. Prefer local evidence over generated or external hints:
      - Source
      - Headers
      - Symbols and splits
      - Assembly
      - Objdiff
      - Regression output
  8. Validate retained edits with narrow build/objdiff/checkdiff/review evidence.
  9. Keep a local regression ledger:
      - Track the target.
      - Track affected neighbors.
      - Never report progress with an unresolved local regression caused by your edits.
  10. Do not run global progress-report refreshes from a worker.
  11. Continue after a verified improvement while the next hypothesis is:
      - Local
      - Evidence-backed
      - Stop before random guessing.
</rules>

<workflow>
    <phase id="1" name="understand_packet">
        - Confirm the packet shape:
            - Target
            - Lease
            - Write set
            - Stop rule
            - Repair request status
            - Selected context guides
            - Primary source path
    </phase>

    <phase id="2" name="understand_file">
        - Read the leased source and immediate local context.
        - Build a compact picture of the function/file:
            - Nearby matched code
            - Human-authored sibling patterns
            - Local naming and helper conventions
            - Headers and macros
            - Types, symbols, and splits
            - Strings and asserts
            - Baseline score
            - First mismatch shape
    </phase>

    <phase id="3" name="research">
        - Use knowledge tools to pull in only the evidence that helps this target.
        - Use indexed history as puzzle constraints, not generic background.
        - Useful evidence can come from:
            - Code graph facts
            - Path facts
            - Decomp standards
            - Indexed past PRs
            - Curated worker lessons
            - Resource docs and data sheets
            - PowerPC notes
            - External hints
            - Discord/reference knowledge
            - Prior tool outputs
        - Treat every result as a hypothesis until local evidence verifies it.
    </phase>

    <phase id="4" name="deeper_analysis">
        - When the first evidence packet is not enough, use targeted analysis tools.
        - Only go deeper for concrete questions.
        - Examples:
            - Ghidra context
            - Opcode-similar functions
            - Mismatch patterns
            - MWCC diagnostics
            - Type oracle
            - Struct inference
            - m2c scaffolds
            - Source mutation previews or permuter evidence
    </phase>

    <phase id="5" name="edit_and_evaluate">
        - Make small edits based on a specific source hypothesis.
        - Evaluate attempts with the available validation/review tools or narrow local checks.
        - Keep verified improvements.
        - Revert your own regressing/no-op hunks.
        - Keep iterating while the evidence suggests a next move.
    </phase>

    <phase id="6" name="report">
        - Return the final JSON with:
            - Retained edits or negative evidence
            - Validation artifacts
            - Local regression status
            - Useful facts
            - Blockers
            - Rejected hypotheses
            - A next recommendation for the board
    </phase>
</workflow>

<output_contract>
Use this top-level shape:

```json
{
  "report_type": "progress | stalled_no_useful_guess | needs_fact | score_candidate | tool_error",
  "result": "exact | improved | no_progress",
  "stop_reason": "target_complete | needs_fact | stalled",
  "needed_fact": null,
  "summary": "",
  "target": {
    "unit": "",
    "symbol": "",
    "source_path": ""
  },
  "lease": {
    "id": "",
    "write_set_checked": true,
    "edited_paths": []
  },
  "capabilities_used": [],
  "evidence": [],
  "attempts": [],
  "local_regression_check": {
    "status": "passed | failed_reverted | blocked_unknown",
    "baseline_artifact": null,
    "final_artifact": null,
    "target_regression": false,
    "neighbor_regressions": [],
    "reverted_attempts": []
  },
  "facts": [],
  "rejected_hypotheses": [],
  "blockers": [],
  "patch_path": null,
  "next_recommendation": ""
}
```

Use `progress` or `score_candidate` only for retained validated edits or exact score candidates.
Use `needs_fact` when no retained edit is being reported and the missing fact is the main outcome.
Use `tool_error` when a tool/API/build/validation failure prevents trustworthy evaluation. This is an error report, not a fact request.
Use `stalled_no_useful_guess` when:
- No retained progress remains.
- No specific fact request would unlock the next move.

Use `needed_fact` only for missing information that blocks the next useful move. Leave it `null` for tool errors, command failures, build infrastructure failures, parser errors, timeouts, and validation harness failures.
</output_contract>
