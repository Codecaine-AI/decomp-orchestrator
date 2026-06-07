---
covers: Runtime knowledge sources, tools, resource graph, agent context, and PR evidence
concepts: [knowledge, sources, tools, resource-graph, agent-context, past-prs]
---

# Knowledge Model

Runtime knowledge is package-owned evidence selected or searched by agents. It
is not a Codex skill and it is not a generic pack system. The current model
separates `knowledge/` evidence infrastructure from role behavior:
`knowledge/` owns source slices, callable tools, and the resource graph, while
agent system prompts and routed worker context own role behavior.

## Knowledge Types

| Type | Purpose |
| --- | --- |
| Source slices | Shallow vertical slices for PRs, Discord knowledge, data sheets, PDFs, external mirrors, reference docs, and normalized tool output |
| Tools | CLI-first helpers that rank targets, gather context, refresh PR data, or analyze last-resort experiment output |
| Resource graph | SQLite graph state linking files, PR history, source hits, tool output, editability, and rank features |
| Agent context | Compact worker guidance selected by `src/agents/context/manifest.json`; director scheduling lives in the director system prompt |
| Graph enrichments | Durable learned facts, such as imported legacy shared-agent lessons and curator-produced worker/PR lessons, stored as graph-owned artifacts |

## Selection

The director gets scheduling policy directly in its system prompt. Workers get
one compact operating guide by default. Capability hints add focused lookup,
matching, or last-resort sweep context only when the packet needs it. The
one-symbol targeted iteration loop is part of the worker system prompt, not a
separate knowledge workflow.

This keeps the default worker posture careful and evidence-backed. Broader
experimental search and permuter handoff enter only when a packet or capability
route asks for compact last-resort sweep context.

## Naming-Guided Search

Worker search is thoughtful, not random. A worker should use the target symbol,
source path, nearby matched code, headers, splits, symbols, PR history, and
resource tables to infer likely names the original developer would have used:
struct fields, callbacks, states, helper functions, data owners, and sibling
files. Each new fact should narrow the next search query or suggest another
specific file to inspect.

When those evidence-backed names and paths run out, the worker should stop
before hard guessing. The next useful move is to identify what missing fact
would make the search grounded again, queue fact research, or move the worker
slot to a more constrained target.

## Resource Contract

Knowledge material should make agents better at choosing grounded next moves.
It should not swamp prompts with the whole repository or encourage random
sweeps. Useful knowledge names exact sources, explains when it applies, and
preserves provenance so facts can be checked later.

## Maintenance

When adding evidence, decide whether it is a source slice, tool, graph
enrichment, or past-PR artifact. When adding behavior, put it beside the agent
as context and route it through `src/agents/context/manifest.json`. Keep
archived legacy material out of default prompt routes.

PR and worker learning enters through a maintenance pipeline:

1. PR refresh/sync updates `knowledge/sources/past_prs/data/current`. Full
   corpus refresh uses `bun run pr:refresh:all`, which runs 32 fetch workers and
   32 PR-review workers by default.
2. The PR-review/indexing pass creates missing per-PR postmortems under
   `knowledge/sources/past_prs/data/prs`.
3. Source indexers generate source-local `indexes/*.jsonl` files for documents,
   CSVs, PDF page text, external mirrors, and normalized tool outputs.
4. `kg:tool-indexes` generates local JSONL indexes for callable tool APIs.
5. Workers persist reports in SQLite and artifact files after the return gate.
6. The knowledge curator reduces worker reports and PR postmortems into
   `knowledge/resource_graph/enrichments/knowledge_curator_updates.jsonl`.
7. Graph rebuild ingests all registered sources plus legacy/curator
   enrichments.
8. `kg:smoke -- --strict` verifies every source has graph chunks and every
   registered tool API is ready.

Workers and PR agents do not directly mutate the canonical graph. They produce
evidence. The curator converts evidence into accepted lessons or proposal-only
source updates, and deterministic graph ingestion owns the final write.

## Worker Packet Evidence

Before a worker starts editing, the runner attaches `knowledge_context` to the
target packet. This precomputed context includes the file card, editability
state, graph resource hits, PR history, scheduling signals, and the direct CLI
commands the worker can call for follow-up lookup. Workers may still search
individual sources or tools when the packet exposes a concrete question, but
they do not start from a cold prompt.
