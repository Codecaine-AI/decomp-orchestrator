# Worker Lookup Guide

Use this opt-in context when the packet needs fact research, resource lookup,
scratch/history reconstruction, or type/symbol resolution.

## Search Order

1. File graph or file card for the target source: editability, known PR touches,
   related files, resource hits, and rank signals.
2. Local repo source: target file, sibling files, headers, macros, symbols,
   splits, glossary terms, report strings, assert strings, and nearby matched
   functions.
3. Past PRs: exact source path, symbol, subsystem, struct/field term, mismatch
   class, review warning, and tactic.
4. Data/resource sources: SSBM data sheet CSVs, PowerPC docs, external mirrors,
   Discord/reference docs, and normalized tool output.
5. Tool-specific lookups only when the local/resource evidence points to a
   concrete question.

## Useful Commands

```bash
bun run kg:file-card -- --repo-root <repo_root> --source <source_path>
bun run kg:search -- --repo-root <repo_root> --source past_prs --query <term> --limit 10
python3 decomp-orchestrator/knowledge/sources/<source_id>/api/status.py --json
python3 decomp-orchestrator/knowledge/sources/<source_id>/api/search.py --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/ssbm_data_sheet/api/search.py --query <address_or_offset_or_id> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/powerpc_docs/api/lookup_instruction.py --mnemonic <mnemonic> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/external_mirrors/api/lookup_external_symbol.py --symbol <name> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/mismatch_db/api/search.py --query <mismatch_pattern> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/decomp_context_lookup.py --target <source_path> --symbol <symbol>
rg -n "<symbol>|<source_path>|<field>|<mismatch>" decomp-orchestrator/knowledge/sources/past_prs/data
```

## Evidence Rules

- Local source, headers, symbols, splits, assembly, and objdiff outrank PR notes
  and external mirrors.
- A fact is useful only when it changes the next bounded hypothesis, verifies a
  name/type/layout, or explains why a target should cool down.
- Keep provenance in the report: source path, PR number, graph result, tool
  output path, or resource CSV/PDF row.
- If sources disagree, preserve the disagreement as negative evidence instead
  of forcing a guessed fact.

## Fact Outputs

Good facts are small and reusable: field names, struct ownership, callback
relationships, duplicate source shapes, review constraints, verifier commands,
and named compiler-shape levers. Avoid broad summaries that cannot be checked.
