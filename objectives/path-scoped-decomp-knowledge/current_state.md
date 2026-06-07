<current_state>
<last_updated>2026-06-07</last_updated>

<status>
    - Objective implementation is complete for the requested first pass.
    - `decomp_standards` is registered, indexed, graph-ingested, searchable,
      and injected into worker/writer plus PR-review contexts.
    - `path_facts` is registered, indexed, graph-ingested, searchable, and
      resolved by target path for worker/writer contexts only.
    - Directory inventory covers all 16 top-level Melee source directories:
      15 accepted-facts dispositions and `sc` recorded as no-fact-needed.
</status>

<completed>
    - Defined the target architecture: global standards are always injected;
      path facts are resolved by target path and injected only for worker/writer
      packets where relevant.
    - Defined curator behavior: standards/path-fact changes enter as
      source-update proposals with provenance and are applied only through a
      source-specific validation/apply path.
    - Defined first-pass coverage scope across parent Melee directories:
      `cm`, `db`, `ef`, `ft`, `gm`, `gr`, `if`, `it`, `lb`, `mn`, `mp`, `pl`,
      `sc`, `sfx`, `ty`, and `vi`.
    - Added the item decomp writeup as the explicit quality reference for
      source-specific slices and made high-quality, non-lazy slice files a
      completion requirement.
    - Added `knowledge/sources/decomp_standards/` with schema, README,
      accepted standards data, status/search/proposals APIs, and an index
      builder.
    - Added `knowledge/sources/path_facts/` with schema, README, 15 accepted
      path facts, four slice files, status/search/resolve/proposals APIs, and
      an index builder.
    - Created
      `objectives/path-scoped-decomp-knowledge/artifacts/directory_inventory.json`
      with all 16 top-level directories accounted for.
    - Added shared runtime loader `src/knowledge/decomp-context.ts` for global
      standards and bounded path-fact resolution.
    - Added graph builders for `decomp_standards` and `path_facts`, and added
      both to default graph source rebuilding.
    - Wired worker knowledge context to include global standards and resolved
      path facts for the leased target path.
    - Wired PR-review prompt context to include global standards without path
      facts.
    - Extended deterministic curator routing so broad standards target
      `decomp_standards` with `update_kind: global_standard`, and scoped known
      wins target `path_facts` with `update_kind: path_fact`; proposal
      metadata carries evidence refs and remains proposal-only.
    - Wrote smoke and handoff artifacts under
      `objectives/path-scoped-decomp-knowledge/artifacts/`.
</completed>

<in_progress>
    - None.
</in_progress>

<next_actions>
    - No required next action for this objective.
    - Future maintenance can add source-specific apply/validation commands for
      curator proposals if operators want an approved path beyond
      proposal-listing.
</next_actions>

<risks_or_open_questions>
    - QA is represented by the current PR-review prompt surface for this pass;
      it now loads global standards and intentionally excludes path facts.
    - Path facts must stay compact and evidence-backed so they do not supersede
      the graph or local source evidence.
    - Curator application remains proposal-only; applying standards or path
      facts still requires source-owner validation.
</risks_or_open_questions>

<validation>
    - `python3 knowledge/sources/decomp_standards/commands/build_index.py`:
      passed, 12 records written.
    - `python3 knowledge/sources/path_facts/commands/build_index.py`: passed,
      15 records written.
    - `python3 knowledge/sources/decomp_standards/api/status.py --json`:
      passed, 12 accepted standards and ready index.
    - `python3 knowledge/sources/decomp_standards/api/search.py --query typed
      --limit 10 --json`: passed, returned the typed-fields standard.
    - `python3 knowledge/sources/path_facts/api/status.py --json`: passed, 15
      accepted facts, 16 inventory rows, one no-fact-needed directory.
    - `python3 knowledge/sources/path_facts/api/search.py --query GET_ITEM
      --limit 10 --json`: passed, returned the item fact.
    - `python3 knowledge/sources/path_facts/api/resolve_for_path.py --path
      src/melee/it/items/itlinkarrow.c --json`: passed, returned the item
      fact.
    - `python3 knowledge/sources/path_facts/api/resolve_for_path.py --path
      src/melee/gm/gm_1B03.c --json`: passed, returned the gm fact and no item
      fact.
    - `bun run kg:rebuild -- --sources all`: passed, indexed
      `decomp_standards` and `path_facts` with no skipped sources.
    - `bun run kg:smoke -- --strict`: passed; both new sources were ready.
    - `find knowledge/sources/decomp_standards knowledge/sources/path_facts
      -name '*.py' -print0 | xargs -0 python3 -m py_compile`: passed.
    - `bun run check`: passed.
    - Direct runtime injection/classification smoke: passed; worker item
      context included 12 standards plus the item path fact, worker non-item
      context excluded the item fact, PR-review context included standards and
      excluded path facts, and curator classifications preserved evidence
      refs.
</validation>

<artifacts>
    - `objectives/path-scoped-decomp-knowledge/artifacts/directory_inventory.json`
    - `objectives/path-scoped-decomp-knowledge/artifacts/path_fact_smoke.json`
    - `objectives/path-scoped-decomp-knowledge/artifacts/injection_smoke.json`
    - `objectives/path-scoped-decomp-knowledge/artifacts/curator_proposal_smoke.json`
    - `objectives/path-scoped-decomp-knowledge/artifacts/slice_quality_audit.json`
    - `objectives/path-scoped-decomp-knowledge/artifacts/run_summary.json`
</artifacts>

<important_paths>
    - `objectives/path-scoped-decomp-knowledge/goal.md`
    - `objectives/path-scoped-decomp-knowledge/context/`
    - `objectives/path-scoped-decomp-knowledge/examples/item_path_fact.json`
    - `objectives/path-scoped-decomp-knowledge/examples/item_decomp_slice_quality_reference.md`
    - `docs/20-implementation/knowledge/20-melee-pr-review-qa-standards.md`
    - `docs/20-implementation/knowledge/21-melee-pr-review-qa-coverage-audit.md`
    - `knowledge/sources/decomp_standards/`
    - `knowledge/sources/path_facts/`
    - `src/knowledge/decomp-context.ts`
    - `src/knowledge/graph/source-slices.ts`
    - `src/knowledge/graph/rebuild.ts`
    - `src/agents/worker/`
    - `src/agents/pr-review/`
    - `src/agents/knowledge-curator/`
    - `src/knowledge/curator.ts`
</important_paths>
</current_state>
