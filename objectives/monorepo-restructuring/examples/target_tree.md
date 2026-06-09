# Target Monorepo Tree

The final layout should look approximately like this. Exact filenames can vary
when implementation reveals a cleaner local pattern, but the ownership boundary
should remain stable.

```text
decomp-orchestrator/
+-- apps/
|   +-- cli/
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |       +-- bin/decomp-orchestrator.ts
|   |       +-- main.ts
|   |       +-- args.ts
|   |       +-- defaults.ts
|   |       +-- usage.ts
|   |       +-- commands/
|   +-- dashboard/
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- vite.config.ts
|   |   +-- index.html
|   |   +-- src/
|   |       +-- main.tsx
|   |       +-- styles.css
|   |       +-- components/
|   |       +-- hooks/
|   |       +-- lib/
|   +-- dashboard-server/
|       +-- package.json
|       +-- tsconfig.json
|       +-- src/
|           +-- server.ts
|           +-- trusted-report.ts
|           +-- dashboard-data.ts
|
+-- packages/
|   +-- core/
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |       +-- state/
|   |       +-- board/
|   |       +-- shell/
|   |       +-- report/
|   |       +-- objdiff/
|   |       +-- handoff/
|   |       +-- env/
|   |       +-- types/
|   +-- agents/
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |       +-- director/
|   |       +-- worker/
|   |       +-- pr-review/
|   |       +-- knowledge-curator/
|   |       +-- runtime/
|   |       +-- context/
|   +-- knowledge/
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |   +-- src/
|   |       +-- graph/
|   |       +-- paths.ts
|   |       +-- resources.ts
|   |       +-- decomp-context.ts
|   +-- ui-contract/
|       +-- package.json
|       +-- tsconfig.json
|       +-- src/
|           +-- dashboard.ts
|           +-- index.ts
|
+-- knowledge/
|   +-- sources/
|   +-- tools/
|   +-- resource_graph/
+-- docs/
+-- tests/
+-- testdata/
+-- objectives/
+-- ai_docs/
+-- package.json
+-- tsconfig.base.json
+-- tsconfig.json
+-- bun.lock
+-- Makefile
```

## Dependency Direction

```text
apps/dashboard        -> packages/ui-contract
apps/dashboard-server -> packages/core, packages/ui-contract
apps/cli              -> packages/core, packages/agents, packages/knowledge
packages/agents       -> packages/core, packages/knowledge
packages/knowledge    -> packages/core
packages/ui-contract  -> no runtime package deps
packages/core         -> no app, agents, or knowledge deps
```

Root `knowledge/` remains repo-level runtime data/tooling. The
`packages/knowledge` TypeScript package owns code that reads, indexes, and
describes that data; it does not absorb all corpora or generated graph state.
