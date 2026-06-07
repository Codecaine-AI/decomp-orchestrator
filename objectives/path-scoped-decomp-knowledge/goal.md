<goal>
    - Build separate runtime knowledge sources for global decomp standards and
      path-scoped known wins.
    - Complete the first coverage pass across top-level Melee source
      directories and create path facts where repeated evidence shows reusable
      patterns worth injecting.
    - Wire the knowledge curator so new worker, QA, and PR-review evidence can
      propose updates to global standards or path facts without mutating source
      corpora directly.
</goal>

<context_refresh>
    <required_files>
        - `objectives/path-scoped-decomp-knowledge/goal.md`
        - `objectives/path-scoped-decomp-knowledge/current_state.md`
        - `objectives/path-scoped-decomp-knowledge/context/*.md`
        - `objectives/path-scoped-decomp-knowledge/examples/*`
    </required_files>

    <instruction>
        - At objective start and after compaction/resume, reread the required
          files and treat this bundle as the authority for this objective.
    </instruction>
</context_refresh>

<working_strategy>
    - Create two separate knowledge sources:
      `knowledge/sources/decomp_standards` for global standards and
      `knowledge/sources/path_facts` for path-scoped known wins.
    - Always inject global standards into worker/writer and QA contexts. Resolve
      bounded path facts from the target path for worker/writer packets.
    - Preserve the graph as evidence routing. Path facts are curated hints;
      local source, headers, symbols, splits, assembly, objdiff, and regression
      output remain final authority.
    - Let the knowledge curator emit proposal-only updates to the owning source:
      standards or path facts.
</working_strategy>

<success_metrics>
    - The global standards source has status and search APIs with JSON output.
    - The path facts source has status, search, and resolve-for-path APIs with
      JSON output.
    - Worker packets include global standards plus relevant path facts for a
      representative `src/melee/it/**` target and at least one non-item target.
    - Each source-specific slice matches the item quality reference.
    - QA/PR handoff context can load global standards without path facts.
    - The curator can classify proposed updates as `global_standard` or
      `path_fact` proposals with evidence refs and the correct target source.
    - Every top-level Melee source directory is inventoried and either has
      path facts or an explicit no-fact-needed disposition.
</success_metrics>

<non_goals>
    - Do not make path facts a replacement for the code graph, source reading,
      objdiff, or verifier output.
    - Do not inject every directory fact into every worker prompt.
    - Do not directly edit upstream Melee source while building this knowledge
      system.
    - Do not let model agents silently rewrite standards or path facts without
      provenance and source-specific validation.
</non_goals>

<completion_criteria>
    - Global standards are available from their own knowledge folder/source and
      are wired into worker/writer and QA/PR-handoff contexts.
    - Path-scoped facts are available from their own knowledge folder/source and
      resolve by target path for worker/writer packet injection.
    - Path fact records exist for all worthwhile top-level Melee directories.
    - Each directory has either accepted path facts or a recorded
      no-fact-needed reason in the inventory artifact.
    - Every created source-specific slice is high quality. Do not be lazy:
      shallow or unverified slice files do not satisfy completion.
    - Graph rebuild/smoke, source API smoke, worker packet smoke, curator
      proposal smoke, TypeScript checks, and Python compile checks pass.
    - Update `objectives/path-scoped-decomp-knowledge/current_state.md` with
      final commands, artifacts, coverage counts, remaining risks, and
      completion evidence.
</completion_criteria>
