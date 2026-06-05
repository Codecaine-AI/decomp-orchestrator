# Decomp Orchestrator Knowledge

This directory is the runtime knowledge surface for director and worker Pi
agents. It was migrated from repo-local Codex skills so the orchestrator can
render explicit, role-specific knowledge packs without depending on Codex skill
loading.

The runner includes a small default set for each role and adds capability packs
for worker packets. Agents should treat these files as authoritative local
workflow guidance, then verify every decomp claim with the repo resources and
commands listed in their prompt.

Entry point:

- `manifest.json`

Reusable corpora:

- `decomp_resources/` - data-sheet CSVs, PowerPC indexes, external hint
  indexes, manifests, and resource notes for Melee decomp research.
- `past_prs/` - stable PR dump, searchable per-PR postmortem library, shared
  PR-agent prompts, and refresh/postmortem utilities.

Knowledge packs:

- `packs/decomp-find/` - target discovery, ranking, and ROI triage.
- `packs/melee-decomp/` - core Melee decomp workflow, matching tactics,
  resource-guided research, review standards, and the context helper.
- `packs/melee-decomp-sweep/` - sweep run layout, candidate matrices,
  high-throughput batches, Pareto scoring, post-sweep analysis, charts, and
  sweep scripts.

Package command surface:

- `bun run pr:refresh:dry` previews recent PR discovery.
- `bun run pr:refresh` refreshes missing PR slices and rebuilds deterministic
  searchable records.
- `bun run pr:postmortems -- --dump-root knowledge/past_prs/current --run-agent`
  reruns model-reviewed PR records.
- `bun run pr:sync` syncs the local branch and PR library together.
