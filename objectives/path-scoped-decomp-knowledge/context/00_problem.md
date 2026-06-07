<problem>
    <objective_question>
        - How should the orchestrator store, inject, update, and validate
          reusable decomp review standards and path-specific quick facts so
          workers move faster without treating hints as truth?
    </objective_question>

    <current_baseline>
        - The repo has a clean global rules document at
          `docs/20-implementation/knowledge/20-melee-pr-review-qa-standards.md`
          and a separate coverage audit at
          `docs/20-implementation/knowledge/21-melee-pr-review-qa-coverage-audit.md`.
        - The graph already indexes code, PRs, resource guides, reference docs,
          data sheets, tool outputs, and curator enrichments.
        - Workers currently receive compact default operating context and can
          opt into lookup/matching guides through
          `src/agents/context/manifest.json`.
        - The knowledge curator already emits accepted lessons and
          proposal-only `source_update_proposal` records, but it does not yet
          know how to target global standards or path-scoped fact files.
    </current_baseline>

    <why_current_state_is_insufficient>
        - Global standards are written as documentation, not as a runtime
          knowledge source that can be consistently injected into workers and
          QA agents.
        - Directory-specific patterns such as item `GET_ITEM`, `ItemVars`
          union arms, and `specialAttributes` typing are discoverable from
          graph/source evidence, but rediscovering them for every target is
          slow and inconsistent.
        - The current curation pipeline can preserve lessons, but it lacks
          separate source-specific update routes for global standards and path
          facts.
        - Without scope and trust rules, path facts could become stale prompt
          lore that outranks current source evidence.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `prompt_lore_supersedes_evidence`: path facts are treated as
          canonical and lead workers away from current headers, assembly, or
          objdiff.
        - `overinjection`: too many broad facts enter every worker packet and
          drown out target-specific evidence.
        - `stale_directory_fact`: a fact remains after source/header layout
          changes and misguides future edits.
        - `curator_direct_mutation`: a model-reviewed curator output edits
          source corpora without proposal validation.
        - `doc_only_rules`: standards exist as docs but are not reliably loaded
          by writer/worker or QA flows.
    </failure_modes>

    <prior_evidence>
        - `docs/20-implementation/knowledge/20-melee-pr-review-qa-standards.md`:
          direct global do/do-not rules mined from the PR corpus.
        - `docs/20-implementation/knowledge/21-melee-pr-review-qa-coverage-audit.md`:
          full corpus coverage and counted evidence.
        - `src/agents/worker/context/lookup-guide.md`: local source and graph
          evidence outrank PR notes and external hints.
        - `src/knowledge/graph/knowledge-curator.ts`: curator enrichment
          records already support accepted/proposal status and source paths.
        - User-provided item example: item functions often benefit from fast
          reminders about `Item_GObj*`, `GET_ITEM`, `ItemVars`, attributes,
          and header prototype cleanup.
    </prior_evidence>

    <expected_value>
        - Workers should begin common subsystem targets with the global QA
          rules and the few path-specific facts most likely to prevent known
          bad patterns.
        - QA should enforce global standards during PR handoff without needing
          all directory hints.
        - Curator updates should turn repeated worker/PR/QA evidence into
          proposed updates for either the global standards source or the path
          facts source, with provenance.
    </expected_value>
</problem>
