<working_plan>
    <overview>
        1. baseline_and_schema - Define source shape, fact schema, trust rules,
           and current injection surfaces.
        2. directory_inventory - Audit every top-level Melee source directory
           and decide where path facts are worthwhile.
        3. sources_and_resolver - Implement separate standards and path-facts
           sources, APIs, indexes, resolver, and graph ingestion.
        4. packet_injection - Wire worker/writer and QA contexts with the
           correct separation between global standards and path facts.
        5. curator_update_flow - Add curator proposal support and a
           source-specific validation/apply path.
        6. validation_and_handoff - Run smoke checks, write artifacts, and
           update objective state.
    </overview>

    <operating_principles>
        - Keep facts small, scoped, evidence-backed, and easy to invalidate.
        - Prefer exact path and narrow directory matches over broad subsystem
          facts when resolving worker context.
        - Store enough provenance that a future agent can check why a fact
          exists before changing source code.
        - Treat "no fact needed" as a valid inventory result when the graph or
          local source already answers the question cheaply.
        - Do not be lazy. Each created slice must be a high-quality, actionable
          worker aid with concrete patterns, known traps, locations, and
          source-level examples.
    </operating_principles>

    <phase id="1" name="baseline_and_schema">
        <objective>
            - Establish the runtime source design and fact schema before
              collecting facts.
        </objective>
        <inputs>
            - `docs/20-implementation/knowledge/20-melee-pr-review-qa-standards.md`
            - `docs/20-implementation/knowledge/21-melee-pr-review-qa-coverage-audit.md`
            - `src/agents/context/manifest.json`
            - `src/agents/worker/context/*.md`
            - `src/knowledge/resources.ts`
            - `src/knowledge/graph/source-slices.ts`
            - `src/agents/knowledge-curator/templates/system.md`
            - `objectives/path-scoped-decomp-knowledge/examples/item_path_fact.json`
            - `objectives/path-scoped-decomp-knowledge/examples/item_decomp_slice_quality_reference.md`
        </inputs>
        <process>
            - Decide final source IDs. Default to `decomp_standards` for global
              standards and `path_facts` for path-scoped known wins unless
              implementation reveals better local names.
            - Define JSON schemas for `global_standard`, `path_fact`, and
              `directory_disposition` records.
            - Write the quality checklist for source-specific slices using the
              item reference as the minimum bar, not as a special-case one-off.
            - Define resolver ranking: exact file, narrow directory, broader
              directory, then global metadata.
            - Define stale-check fields for path facts, such as watched paths,
              symbol/header references, or source schema version.
        </process>
        <outputs>
            - `knowledge/sources/decomp_standards/data/schema.md` or
              equivalent: standards source layout, record fields, and trust
              rules.
            - `knowledge/sources/path_facts/data/schema.md` or equivalent:
              path fact source layout, record fields, trust rules, stale
              checks, and resolver ranking.
        </outputs>
        <gate>
            - A fresh agent can author a valid path fact and know how it will
              be resolved, injected, stale-checked, and curated.
        </gate>
        <failure_handling>
            - If either source needs a different name, update every API,
              curator target, and artifact contract consistently.
        </failure_handling>
    </phase>

    <phase id="2" name="directory_inventory">
        <objective>
            - Complete the first pass over top-level Melee source directories
              and identify worthwhile path facts.
        </objective>
        <inputs>
            - Parent source directories:
              `../src/melee/{cm,db,ef,ft,gm,gr,if,it,lb,mn,mp,pl,sc,sfx,ty,vi}`
            - Headers under `../src/melee/**` and `../include/**`.
            - `knowledge/sources/past_prs/data/prs/index.jsonl`
            - `knowledge/sources/past_prs/data/prs/known_fixes.md`
            - `knowledge/sources/past_prs/data/current/analysis/review_comments.md`
            - `knowledge/resource_graph/graph.sqlite` and `kg:file-card`.
        </inputs>
        <process>
            - For each directory, gather recurring patterns from source/header
              idioms, PR lessons, review comments, and file-card/resource hits.
            - Accept a candidate fact only when it is recurring, path-specific,
              easy to misuse, and useful to know before editing.
            - For directories that get a source-specific slice, write it to the
              same quality level as the item reference: common patterns, key
              structures, repeated m2c/tooling mistakes, final-source examples,
              header/prototype expectations, macros/helpers, and file
              organization.
            - Record no-fact-needed when the directory has no durable pattern
              beyond global standards or when graph/local source lookup is
              already sufficient.
            - Start with `it` using the item example, then continue across the
              remaining directories.
        </process>
        <outputs>
            - `objectives/path-scoped-decomp-knowledge/artifacts/directory_inventory.json`:
              one row per top-level directory with `directory`, `status`,
              `fact_ids`, `evidence_refs`, `no_fact_reason`, and `notes`.
            - `knowledge/sources/path_facts/data/path_facts/*.jsonl`:
              accepted path-fact records grouped by directory or scope family.
        </outputs>
        <gate>
            - Every listed top-level directory has a disposition, and every
              accepted fact has scope, evidence, stale checks, and do/do-not
              guidance.
            - Every created slice passes the quality checklist; shallow or
              generic slice files fail this phase.
        </gate>
        <failure_handling>
            - If evidence is thin, leave a no-fact-needed or proposal-only
              disposition instead of inventing a pattern.
        </failure_handling>
    </phase>

    <phase id="3" name="sources_and_resolver">
        <objective>
            - Make the standards source searchable and the path-facts source
              searchable, resolvable by target path, and graph-indexed.
        </objective>
        <inputs>
            - Outputs from phases 1 and 2.
            - Existing source API patterns under `knowledge/sources/*/api`.
            - Existing graph source builders in `src/knowledge/graph`.
        </inputs>
        <process>
            - Add `source.json`, README, `api/status.py`, and `api/search.py`
              for `decomp_standards`.
            - Add `source.json`, README, `api/status.py`, `api/search.py`, and
              `api/resolve_for_path.py` for `path_facts`.
            - Generate deterministic indexes for global standards and path
              facts in their separate source folders.
            - Register both sources and add graph ingestion that links path
              facts to matching source files when scope globs can be resolved.
            - Keep trust tier as a hint/reference tier, not canonical code.
        </process>
        <outputs>
            - Registered source files under `knowledge/sources/decomp_standards/**`.
            - Registered source files under `knowledge/sources/path_facts/**`.
            - Generated indexes under `knowledge/sources/decomp_standards/indexes/`.
            - Generated indexes under `knowledge/sources/path_facts/indexes/`.
            - Graph builder changes, if needed.
        </outputs>
        <gate>
            - Both sources return useful JSON through their APIs, and graph
              rebuild indexes both sources.
        </gate>
        <failure_handling>
            - If glob-to-file linking is expensive or ambiguous, index facts as
              searchable chunks first and leave direct file edges for a later
              deterministic pass.
        </failure_handling>
    </phase>

    <phase id="4" name="packet_injection">
        <objective>
            - Wire standards and path facts into the correct agent contexts.
        </objective>
        <inputs>
            - `src/agents/worker/prompt.ts`
            - `src/agents/worker/templates/system.md`
            - QA/PR handoff agent or command surfaces once located.
            - `src/knowledge/resources.ts`
            - `knowledge/sources/path_facts/api/resolve_for_path.py`
        </inputs>
        <process>
            - Ensure worker/writer packets include the global standards summary
              and bounded path facts for the target source path.
            - Ensure QA/PR handoff standards checks load global standards and
              verifier requirements, but do not automatically load all path
              facts.
            - Add packet metadata showing which standards/facts were injected
              and their evidence refs.
            - Keep packet size bounded and deterministic.
        </process>
        <outputs>
            - Worker packet integration changes.
            - QA/PR standards integration changes or a documented target path
              for follow-up if the QA surface is not yet implemented.
            - `objectives/path-scoped-decomp-knowledge/artifacts/injection_smoke.json`.
        </outputs>
        <gate>
            - Representative worker packet smoke shows global standards plus
              item path facts for `src/melee/it/**`, and QA smoke shows global
              standards without unrelated directory facts.
        </gate>
        <failure_handling>
            - If QA agent code does not exist yet, document the expected
              injection contract and wire the existing PR handoff path that is
              closest to QA.
        </failure_handling>
    </phase>

    <phase id="5" name="curator_update_flow">
        <objective>
            - Let the knowledge curator route reusable lessons into standards
              and path-fact update proposals.
        </objective>
        <inputs>
            - `src/agents/knowledge-curator/templates/system.md`
            - `src/agents/knowledge-curator/schema.json`
            - `src/knowledge/curator.ts`
            - `src/knowledge/graph/knowledge-curator.ts`
            - Worker/QA/PR report shapes that include reusable lessons.
        </inputs>
        <process>
            - Extend curator prompt/schema as needed so proposals can name
              `target_source_id: decomp_standards`, `update_kind:
              global_standard`, evidence refs, or `target_source_id:
              path_facts`, `update_kind: path_fact`, scope globs, and evidence
              refs.
            - Add deterministic reduction for clear worker/PR lessons where
              safe; leave uncertain updates as proposal-only.
            - Add a source-specific updater or validation command that can
              list, validate, and optionally apply proposed standards/fact
              changes.
        </process>
        <outputs>
            - Curator update support.
            - `objectives/path-scoped-decomp-knowledge/artifacts/curator_proposal_smoke.json`.
        </outputs>
        <gate>
            - A sample accepted worker/PR/QA lesson can become a proposal for a
              global standard or path fact with provenance, and no direct
              mutation occurs without validation.
        </gate>
        <failure_handling>
            - If automatic application is too risky, keep the apply step manual
              but make listing, validation, and evidence review deterministic.
        </failure_handling>
    </phase>

    <phase id="6" name="validation_and_handoff">
        <objective>
            - Prove the system is working and leave durable completion evidence.
        </objective>
        <inputs>
            - Outputs from phases 1 through 5.
            - `context/04_validation_and_handoff.md`.
        </inputs>
        <process>
            - Run the validation ladder.
            - Write artifacts with command outputs, counts, dispositions, and
              remaining risks.
            - Update `current_state.md` before handoff or final response.
        </process>
        <outputs>
            - `objectives/path-scoped-decomp-knowledge/artifacts/run_summary.json`
            - Updated `objectives/path-scoped-decomp-knowledge/current_state.md`
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and validation gates in
              `context/04_validation_and_handoff.md` are satisfied.
        </gate>
        <failure_handling>
            - If validation fails, preserve artifacts, identify the failed
              phase, and set the next action to the smallest concrete repair.
        </failure_handling>
    </phase>
</working_plan>
