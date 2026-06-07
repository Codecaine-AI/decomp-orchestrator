<implementation_scope>
    <owned_surfaces>
        - `knowledge/sources/decomp_standards/**`: proposed registered source
          for global standards, source APIs, indexes, schemas, and README.
        - `knowledge/sources/path_facts/**`: proposed registered source for
          directory/path-specific known wins, resolver APIs, indexes, schemas,
          inventory, and README.
        - `knowledge/sources/registry.json`: add both sources when implemented.
        - `src/knowledge/graph/source-slices.ts` and related graph registry
          code: index standards and path facts as searchable/linkable source
          chunks.
        - `src/knowledge/resources.ts`: expose global standards and path-fact
          resolver commands in the resource map.
        - `src/agents/worker/**`: inject global standards plus resolved path
          facts into worker/writer packets.
        - `src/agents/knowledge-curator/**` and `src/knowledge/curator.ts`:
          teach the curator about standards/path-fact source-update proposals.
        - QA/PR handoff surfaces, once located: load global standards for
          standards checks without automatically injecting every path fact.
        - `docs/20-implementation/knowledge/**`: keep docs aligned with the
          runtime knowledge architecture, but do not rely on docs as the only
          runtime source.
    </owned_surfaces>

    <read_only_references>
        - Parent Melee source directories `../src/melee/{cm,db,ef,ft,gm,gr,if,it,lb,mn,mp,pl,sc,sfx,ty,vi}`:
          read for patterns and local evidence; do not edit as part of this
          objective.
        - `knowledge/sources/past_prs/data/**`: generated PR corpus; refresh
          or rebuild through PR commands rather than hand-editing individual
          postmortems.
        - `knowledge/resource_graph/graph.sqlite`: generated graph DB; rebuild
          through `bun run kg:rebuild`.
    </read_only_references>

    <generated_outputs>
        - `knowledge/sources/decomp_standards/indexes/*.jsonl`: generated
          global standards search indexes.
        - `knowledge/sources/path_facts/indexes/*.jsonl`: generated search and
          path-resolution indexes for path facts.
        - `knowledge/resource_graph/graph.sqlite`: rebuilt graph containing the
          new source chunks and file links.
        - `objectives/path-scoped-decomp-knowledge/artifacts/directory_inventory.json`:
          per-directory coverage, disposition, evidence refs, and fact counts.
        - `objectives/path-scoped-decomp-knowledge/artifacts/path_fact_smoke.json`:
          resolver results for representative target paths.
        - `objectives/path-scoped-decomp-knowledge/artifacts/injection_smoke.json`:
          worker and QA packet checks showing correct standards/fact injection.
        - `objectives/path-scoped-decomp-knowledge/artifacts/curator_proposal_smoke.json`:
          sample proposals and validation disposition.
    </generated_outputs>

    <commands_and_entrypoints>
        - `python3 knowledge/sources/decomp_standards/api/status.py --json`:
          report counts for global standards and index readiness.
        - `python3 knowledge/sources/decomp_standards/api/search.py --query <term> --limit 10 --json`:
          search global standards with evidence refs.
        - `python3 knowledge/sources/path_facts/api/status.py --json`:
          report path fact count, directory inventory count, indexed facts, and
          resolver readiness.
        - `python3 knowledge/sources/path_facts/api/resolve_for_path.py --path <source_path> --json`:
          return bounded known wins for a target path.
        - `python3 knowledge/sources/path_facts/api/search.py --query <term> --limit 10 --json`:
          search path facts with evidence refs.
        - `bun run kg:rebuild -- --sources all`: rebuild graph after source
          registration or fact changes.
        - `bun run kg:smoke -- --strict`: verify graph/source/tool readiness.
        - `bun run check` and Python `py_compile`: validate changed TypeScript
          and Python APIs.
    </commands_and_entrypoints>

    <adjacent_surfaces_requiring_caution>
        - Agent prompt/template files: keep injected material compact and avoid
          turning path facts into broad behavior instructions.
        - Curator agent schema: preserve backwards compatibility or update all
          prompt/schema/parser paths together.
        - Existing docs and dirty files: do not revert unrelated user or
          generated changes.
        - Path matching: parent checkout paths may appear as `src/melee/...`
          or relative to the orchestrator. Normalize before resolving facts.
    </adjacent_surfaces_requiring_caution>

    <out_of_scope>
        - Editing Melee decomp source to apply the facts.
        - Building a hosted vector DB or MCP server.
        - Creating exhaustive encyclopedic subsystem docs. This objective owns
          short, high-signal facts that are useful in worker packets.
        - Making QA responsible for every path-specific hint. QA owns global
          standards and verifier evidence unless a targeted path audit asks for
          more.
    </out_of_scope>
</implementation_scope>
