<validation_and_handoff>
    <validation_ladder>
        - `python3 knowledge/sources/decomp_standards/api/status.py --json`:
          reports global standard count, index readiness, and proposal/apply
          status.
        - `python3 knowledge/sources/decomp_standards/api/search.py --query typed --limit 10 --json`:
          returns global standards hits with evidence refs.
        - `python3 knowledge/sources/path_facts/api/status.py --json`:
          reports path fact count, directory inventory count, index readiness,
          resolver readiness, and proposal/apply status.
        - `python3 knowledge/sources/path_facts/api/search.py --query GET_ITEM --limit 10 --json`:
          returns item-related fact hits with evidence refs.
        - `python3 knowledge/sources/path_facts/api/resolve_for_path.py --path src/melee/it/items/itlinkarrow.c --json`:
          returns bounded item facts.
        - A second `resolve_for_path.py` smoke on a non-item path: proves
          unrelated item facts are not injected.
        - `bun run kg:rebuild -- --sources all`: indexes the new source and
          preserves existing graph slices.
        - `bun run kg:smoke -- --strict`: passes after graph rebuild.
        - Worker packet smoke: verifies global standards plus relevant path
          facts are present for a worker/writer target.
        - QA/PR handoff smoke: verifies global standards are present and
          directory facts are absent unless explicitly requested.
        - Curator proposal smoke: proves standards/path-fact proposals are
          emitted with provenance and remain proposal-only before validation.
        - Slice quality audit: compare every created source-specific slice
          against `examples/item_decomp_slice_quality_reference.md` and reject
          shallow, generic, or evidence-free files.
        - `bun run check`: TypeScript validation passes.
        - Python `py_compile`: changed source APIs, commands, and scripts
          compile.
    </validation_ladder>

    <artifact_contract>
        - `objectives/path-scoped-decomp-knowledge/artifacts/directory_inventory.json`:
          per-directory rows with `directory`, `status`, `fact_ids`,
          `evidence_refs`, `no_fact_reason`, and `notes`.
        - `objectives/path-scoped-decomp-knowledge/artifacts/path_fact_smoke.json`:
          command, target path, matched fact IDs, excluded fact IDs when
          relevant, and evidence refs.
        - `objectives/path-scoped-decomp-knowledge/artifacts/injection_smoke.json`:
          worker and QA packet summaries, injected standards/facts, and packet
          size notes.
        - `objectives/path-scoped-decomp-knowledge/artifacts/curator_proposal_smoke.json`:
          sample inputs, proposal records, validation disposition, and whether
          any apply step was run.
        - `objectives/path-scoped-decomp-knowledge/artifacts/slice_quality_audit.json`:
          one row per created slice with checklist results, evidence refs,
          rejected/lazy sections, and pass/fail status.
        - `objectives/path-scoped-decomp-knowledge/artifacts/run_summary.json`:
          commands, pass/fail status, fact counts, directory coverage counts,
          graph/source status, and residual risks.
    </artifact_contract>

    <acceptance_gates>
        - Global standards are runtime-accessible and loadable by worker/writer
          and QA/PR handoff flows.
        - Path facts are scoped, bounded, evidence-backed, and absent from
          unrelated target packets.
        - First-pass directory coverage is complete across `cm`, `db`, `ef`,
          `ft`, `gm`, `gr`, `if`, `it`, `lb`, `mn`, `mp`, `pl`, `sc`, `sfx`,
          `ty`, and `vi`.
        - Every created source-specific slice is high quality and actionable.
          Do not be lazy: generic summaries, copied global standards, or facts
          without evidence/examples fail acceptance.
        - Curator proposals for standards target `decomp_standards`; curator
          proposals for path facts target `path_facts`; both preserve
          provenance and cannot silently mutate source files.
        - Graph rebuild/smoke and language validation pass.
    </acceptance_gates>

    <report_contract>
        - Final report must summarize source design, directory coverage counts,
          created fact families, injection behavior, curator update behavior,
          slice quality audit results, validation commands, artifacts, and
          remaining risks.
        - If some directories intentionally have no facts, report the count and
          link `directory_inventory.json` rather than treating them as missed.
    </report_contract>

    <current_state_update>
        - Update `current_state.md` at the start of implementation, after each
          major phase, before compaction, and before final response.
        - Include exact next command if blocked by missing QA surface, schema
          conflict, graph ingestion issue, model failure, or evidence gap.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If the objective cannot complete, preserve artifacts, name the
          failing phase, and define the smallest useful next step.
        - Do not mark the objective complete when only the item example exists;
          completion requires the full directory inventory and source/injection
          plumbing.
    </blocked_or_failed_handoff>
</validation_and_handoff>
