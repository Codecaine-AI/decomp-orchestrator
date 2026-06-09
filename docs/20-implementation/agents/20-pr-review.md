---
covers: PR-review agent slice and relationship to platform-owned PR knowledge
concepts: [pr-review-agent, pr-knowledge, schema, prompts, postmortems]
code-ref: decomp-orchestrator/packages/agents/src/pr-review, decomp-orchestrator/knowledge/sources/past_prs
---

# PR-Review Agent

The PR-review agent is the centralized agent surface for PR analysis and
postmortem-style review knowledge. It lives beside the director and worker
agents so future PR review behavior has one canonical agent slice.

## Files

| File | Purpose |
| --- | --- |
| `packages/agents/src/pr-review/index.ts` | Exposes the PR-review agent definition to the registry. |
| `packages/agents/src/pr-review/prompt.ts` | Builds PR-review prompt inputs. |
| `packages/agents/src/pr-review/schema.json` | Defines the structured output contract. |
| `packages/agents/src/pr-review/templates/system.md` | Defines review role, standards, and output expectations. |
| `packages/agents/src/pr-review/templates/initial_user.md` | Carries the PR-specific user prompt. |

## Knowledge Relationship

The platform owns historical PR data under `knowledge/sources/past_prs/data/`.
That directory contains current dumps, searchable postmortem records, and
refresh utilities. Legacy mirrored PR-agent prompt material can remain there as
source data, but the canonical live PR-review agent definition is in
`packages/agents/src/pr-review/`.

The postmortem builder supports pending-only discovery. `kg-maintain` calls the
builder with `--pending-only`, so newly fetched PRs are auto-discovered from
the current PR dump and only missing `postmortem.json` records are queued.
Live `trigger-agent` maintenance enables the PR-review agent by default for
bounded pending batches. Direct `kg-maintain` enables model-reviewed
postmortems with `--run-pr-agent`; otherwise deterministic scaffold records
keep the corpus indexable.

The default live review runtime is provider `codex-lb`, model `gpt-5.5`, and
thinking `medium`. Root `local.env` remains supported, and selected projects can
load their configured ignored `localEnv` file so PR indexing can be attributed
separately from other projects.

PR-review output is evidence for the resource graph. It is not the final graph
writer. The past-PR graph adapter and knowledge curator ingest the generated
postmortems, attach provenance, and expose file edges, lessons, and source
update proposals.

## Key Rules

- PR-review is a named agent in the same registry as director and worker.
- PR-review prompt/schema changes should happen in the agent slice, not in
  scattered scripts.
- PR knowledge refresh utilities update the evidence library; they do not
  replace the centralized agent definition.
- PR-review records should be processed by graph ingestion/curation rather than
  mutating source corpora directly.

## Related

- [Knowledge implementation](../knowledge/00-overview.md)
- [Agent model](../../10-system-design/20-agent-model.md)
