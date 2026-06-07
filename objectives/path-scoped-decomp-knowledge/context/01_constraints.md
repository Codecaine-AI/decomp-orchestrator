<constraints>
    <hard_rules>
        - Local source, headers, symbols, splits, assembly, objdiff/checkdiff,
          and regression output outrank global standards and path facts.
        - Global standards may be always injected; path facts must be resolved
          from the target path, symbol, or file-card evidence and injected only
          when relevant.
        - Every accepted path fact must include scope globs, evidence
          references, trust/strength, and a stale-check rule.
        - Every source-specific slice file must be high quality: concrete,
          path-scoped, evidence-backed, specific about useful wins, and useful
          before a worker edits code.
        - Do not be lazy. A slice that only says generic things, repeats the
          global standards, or lacks examples/locations/pitfalls is not
          acceptable.
        - The knowledge curator must not mutate standards or path facts
          directly. It may emit source-update proposals with provenance.
        - The first pass must account for every top-level Melee source
          directory, including directories with no accepted facts.
    </hard_rules>

    <forbidden_shortcuts>
        - `all_facts_global`: invalid because directory facts become prompt
          noise and can bias unrelated targets.
        - `graph_replacement`: invalid because quick facts are a cache of
          high-value hints, not the evidence graph.
        - `unproven_directory_fact`: invalid unless the fact is supported by
          source/header evidence, PR evidence, worker evidence, or explicit
          operator review.
        - `silent_standards_edit`: invalid because standards changes affect all
          workers and QA; they need provenance and review.
        - `coverage_by_guess`: invalid because every directory needs either
          accepted facts or a recorded no-fact-needed disposition.
        - `lazy_slice_file`: invalid because source-specific slices must be
          strong enough to improve the worker's first-pass context.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - `decomp_standards`: global behavior rules for worker/writer and QA.
          They are injected as policy, not graph proof.
        - `path_facts`: scoped known wins and easy pickups for worker/writer
          packets. They can be searched and graph-linked, but they are not
          final authority.
        - `code_graph`: current checkout-derived evidence. Do not manually
          edit graph DB output; rebuild it.
        - `curator_enrichment`: accepted lessons and proposal-only updates.
          Use it to route proposed changes into source-specific validators.
        - `QA`: checks global standards and verifier evidence at PR handoff.
          QA may recommend path-fact updates, but should not fail a PR solely
          because a non-authoritative hint was not followed.
    </data_and_feature_boundaries>

    <risk_budget>
        - `prompt_size`: path fact resolver should return a bounded top-N
          packet. If more facts match, rank exact file and narrow directory
          scopes above broad subsystem facts.
        - `staleness`: facts referencing structs, fields, headers, or tools
          need stale checks tied to source paths or schema version.
        - `conflict`: if a path fact conflicts with current source or objdiff,
          report the conflict and prefer local evidence.
        - `model_update_error`: curator proposals are safe to keep as proposal
          records; applying them requires deterministic validation or operator
          approval.
    </risk_budget>

    <promotion_or_completion_gates>
        - `source_registered`: global standards and path facts are represented
          by separate registered knowledge sources or an explicitly documented
          equivalent.
        - `resolver_bounded`: resolving a representative path returns a small,
          relevant packet with provenance and no unrelated directory facts.
        - `curator_route`: curator output can target `global_standard` and
          `path_fact` updates without direct mutation.
        - `directory_inventory_complete`: every top-level Melee source
          directory has a disposition in the coverage artifact.
        - `slice_quality`: every created source-specific slice matches the
          quality bar shown in
          `examples/item_decomp_slice_quality_reference.md`.
        - `qa_separation`: QA context can load global standards without
          directory facts unless an operator explicitly asks for target hints.
    </promotion_or_completion_gates>
</constraints>
