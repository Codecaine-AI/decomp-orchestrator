# Target Project Workspace Tree

This objective should make the orchestrator repository the platform root. Melee
becomes one configured project below that root, or an external checkout selected
by a local override.

Preferred in-workspace shape:

```text
decomp-orchestrator/
+-- apps/
+-- packages/
+-- knowledge/
+-- docs/
+-- objectives/
+-- projects/
|   +-- README.md
|   +-- melee/
|       +-- project.json              # tracked portable defaults
|       +-- local.project.json        # ignored machine-specific overrides
|       +-- local.env                 # ignored local environment
|       +-- checkout/                 # ignored doldecomp/melee clone or worktree
|       +-- state/                    # ignored orchestrator SQLite/run artifacts
|       +-- graph/
|       |   +-- graph.sqlite          # ignored project graph DB
|       +-- .pi-sessions/             # ignored Pi transcripts if stored locally
+-- package.json
+-- bun.lock
+-- Makefile
```

Supported compatibility shape:

```text
decomp-orchestrator/
+-- projects/
|   +-- melee/
|       +-- project.json
|       +-- local.project.json        # repoRoot points to /path/to/melee
|       +-- state/
|       +-- graph/
```

Path rules:

- Paths in tracked `project.json` are resolved relative to the descriptor
  directory unless absolute.
- Paths in ignored `local.project.json` override tracked defaults for one
  machine.
- Explicit CLI flags or dashboard advanced overrides still win over both config
  files.
- Checkout, state, graph DB, local env, and session directories stay ignored by
  the orchestrator git repository.
