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

## Tool Selection

| Tool | Use when the concrete question is | Worker value |
| --- | --- | --- |
| `tool_outputs` | "I know the symbol, file, opcode, or mismatch term, but not which tool owns the evidence." | Cross-tool search before narrowing to one tool API. |
| `ghidra` | "What symbol, address, source path, string, name, caller, or callee context belongs to this target?" | Symbol/address sanity, string/name hints, call-context clues, and a second opinion. Decompiler-shaped output is only a hypothesis. |
| `opseq` | "Which functions have a similar instruction shape or distinctive opcode pattern?" | Matched analogs, duplicate-adaptation candidates, opcode fingerprints, and clues that a gap is structural versus layout-only. Distinctive 3-6 opcode patterns are usually useful. |
| `mismatch_db` | "What known pattern explains this first mismatch?" | Known mismatch symptoms such as `stack`, `register`, `inline`, `literal`, `branch`, `stwu`, opcode names, source-shape tactics, and negative evidence. |
| `mwcc_debug` | "Is this still a compiler/codegen problem after lighter evidence stopped explaining it?" | MWCC-specific notes for register allocation, stack/frame, local lifetime, varargs/assert layout, coalescing, and scheduling. Start with lookup notes; expensive pcdump/debug experiments need a bounded hypothesis. |

## Useful Commands

```bash
bun run kg:file-card -- --repo-root <repo_root> --source <source_path>
bun run kg:search -- --repo-root <repo_root> --source past_prs --query <term> --limit 10
python3 decomp-orchestrator/knowledge/sources/<source_id>/api/status.py --json
python3 decomp-orchestrator/knowledge/sources/<source_id>/api/search.py --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/ssbm_data_sheet/api/search.py --query <address_or_offset_or_id> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/powerpc_docs/api/lookup_instruction.py --mnemonic <mnemonic> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/external_mirrors/api/lookup_external_symbol.py --symbol <name> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/tool_outputs/api/status.py --json
python3 decomp-orchestrator/knowledge/sources/tool_outputs/api/search.py --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/tool_outputs/api/tool_lookup.py --tool <tool_id> --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/<tool_id>/api/status.py --json
python3 decomp-orchestrator/knowledge/tools/ghidra/api/lookup.py --query <symbol_or_address_or_path> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/opseq/api/similar_functions.py --query <symbol_or_path_or_opcode_prefix> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/mismatch_db/api/search.py --query <mismatch_pattern> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/mwcc_debug/api/lookup_dump.py --query <compiler_or_mismatch_pattern> --limit 10 --json
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
- For tool APIs, inspect top-level `available`, `operation_mode`,
  `runner_smoke_passed`, and `limitations`, then inspect each result's `kind`,
  `title`, `evidence_ref`, `payload`, and `index_file` when present.
- Treat live rows, fallback rows, and reference-note chunks differently. A
  fallback row from `build/GALE01/report.json` can prove symbol/source metadata,
  not a Ghidra xref. A note chunk can suggest a tactic, but still needs local
  source and objdiff/checkdiff validation.
- If sources disagree, preserve the disagreement as negative evidence instead
  of forcing a guessed fact.

## Fact Outputs

Good facts are small and reusable: field names, struct ownership, callback
relationships, duplicate source shapes, review constraints, verifier commands,
and named compiler-shape levers. Avoid broad summaries that cannot be checked.
