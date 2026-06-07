---
covers: Worker-facing documentation gaps for Ghidra, opseq, mismatch_db, mwcc_debug, and normalized tool_outputs
concepts: [worker-context, knowledge-tools, ghidra, opseq, mismatch-db, mwcc-debug, tool-outputs]
code-ref: src/agents/worker/context, knowledge/tools, knowledge/sources/tool_outputs, knowledge/sources/reference_docs/data/docs
---

# Worker Tooling Documentation Gap Report

Date: 2026-06-07

Status: implemented in the active worker context, worker system prompt, tool
README, and knowledge implementation overview on 2026-06-07. This report remains
as the audit trail for what was promoted out of the reference material.

## Purpose

This report identifies what should be added to the worker docs, READMEs, and
runtime instructions so a worker understands when and how to use the knowledge
tools around Ghidra, opseq, mismatch_db, mwcc_debug, and normalized tool output.

The current system has working tool APIs and live runner status, but the worker
context mostly says that tool-specific lookup should happen only after a concrete
question exists. It does not yet teach the worker which concrete questions belong
to which tool, how to read the returned provenance, or where each tool fits in a
matching loop.

## Current Coverage

- `src/agents/worker/context/operating-guide.md` already tells workers to build
  an evidence packet, verify with narrow commands, stop before random guessing,
  and treat Ghidra-style output as candidate material rather than trusted source.
- `src/agents/worker/context/lookup-guide.md` includes the general search order
  and direct commands for graph/source APIs, PowerPC docs, external mirrors, and
  `mismatch_db`.
- `src/agents/worker/context/matching-guide.md` lists good source-shape levers:
  control flow, locals/registers, stack/frame, types/fields, inlines/macros,
  data/literals, and duplicate adaptation.
- `knowledge/tools/README.md` and each tool README describe the registered live
  runners, cache/index artifacts, and readiness criteria.
- `docs/20-implementation/knowledge/00-overview.md` documents the tool runner
  contract and makes clear that fallback rows such as symbol lookup, function
  shapes, mismatch-note chunks, and compiler-note chunks are supplemental.

The gap is worker-facing policy, not infrastructure. The infrastructure knows the
tools; the worker docs do not yet make the tools operationally legible.

## Main Gaps

1. The worker guides do not include direct commands for Ghidra, opseq,
   mwcc_debug, or normalized `tool_outputs` lookup.
2. There is no compact "which tool for which question" decision table.
3. There is no explicit tool-assisted matching loop that tells a worker when to
   query opseq before duplicate adaptation, mismatch_db after the first diff,
   mwcc_debug only after lighter tools stop explaining a last-mile mismatch, and
   Ghidra for names/calls/strings/type hints rather than pasted decompiler output.
4. Tool API output interpretation is under-documented for workers. A tool can
   report `operation_mode: live_runner_v1` while individual results are still
   supplemental fallback or reference-note rows. Workers need to inspect result
   `kind`, `evidence_ref`, `payload`, `limitations`, and runner status before
   treating a result as evidence.
5. MWCC pattern knowledge is present in reference docs, but not promoted into the
   active worker matching guide. Important rules about declaration order,
   `int` versus `s32`, pointer-local reuse, direct global/static/extern access,
   BSS ordering, varargs/assert/report shapes, by-value `Vec3`, relocation-only
   mismatches, and stack-frame triage are missing from active policy.
6. The active worker docs do not warn strongly enough that most stack-frame
   bucket mismatches are compound. Reference characterization found only 6 of 54
   sampled stack-frame functions had a single detectable root cause; blind
   `PAD_STACK` probing is usually the wrong default.
7. The runtime worker system prompt mentions `decomp_context_lookup.py` and
   resource lookup, but does not name the registered tool APIs or their
   guardrails. This means a worker may never discover the tools unless the
   selected opt-in guide happens to mention them.

## Recommended Additions By Destination

### `src/agents/worker/context/lookup-guide.md`

Add a short "Tool Selection" table after the search order:

| Tool | Use when the concrete question is | Worker value |
| --- | --- | --- |
| `tool_outputs` | "I know the symbol, file, opcode, or mismatch term, but not which tool owns the evidence." | Cross-tool normalized search before narrowing to a tool-specific API. |
| `ghidra` | "What symbol/address/source path/name/string/call context is associated with this target?" | Symbol provenance, address/file sanity, names, strings, bounded xref/call hints. Use decompiler output only as a hypothesis source. |
| `opseq` | "Which functions look instruction-shape similar to this target?" | Find matched analogs, duplicate-adaptation candidates, opcode fingerprints, instruction-shape neighbors, and structural versus layout-only clues. |
| `mismatch_db` | "What known pattern explains this first mismatch?" | Search known mismatch symptoms such as `stack`, `register`, `inline`, `literal`, `branch`, `stwu`, opcode names, source-shape tactics, and negative evidence. |
| `mwcc_debug` | "Is this a compiler/codegen issue after lighter evidence is exhausted?" | Register allocation, stack/frame, local lifetime, varargs/assert, coalescing, scheduling, and MWCC-specific pattern notes. Start with cached lookup notes; reserve expensive pcdump/compiler experiments for bounded hypotheses. |

Add command snippets:

```bash
python3 decomp-orchestrator/knowledge/sources/tool_outputs/api/search.py --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/sources/tool_outputs/api/tool_lookup.py --tool <tool_id> --query <term> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/ghidra/api/lookup.py --query <symbol_or_address_or_path> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/opseq/api/similar_functions.py --query <symbol_or_path_or_opcode_prefix> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/mismatch_db/api/search.py --query <mismatch_pattern> --limit 10 --json
python3 decomp-orchestrator/knowledge/tools/mwcc_debug/api/lookup_dump.py --query <compiler_or_mismatch_pattern> --limit 10 --json
```

Add an "Output Interpretation" note:

- Check top-level `available`, `operation_mode`, `runner_smoke_passed`, and
  `limitations` when present.
- Check each result's `kind`, `title`, `evidence_ref`, `payload`, and
  `index_file` when using `tool_outputs`.
- Treat live rows, fallback rows, and reference-note chunks differently. A
  fallback row from `build/GALE01/report.json` can prove symbol/source metadata,
  but not a Ghidra xref. A reference-note chunk can suggest a tactic, but still
  needs local source and objdiff/checkdiff validation.
- Cite the exact command and evidence path in the worker report.

### `src/agents/worker/context/matching-guide.md`

Add a "Tool-Assisted Matching Loop" section after common levers:

1. Use `opseq` before duplicate adaptation or broad local rewrites to find
   already-matched instruction-shape analogs and near-neighbor functions.
2. Use `mismatch_db` after the first concrete objdiff/checkdiff mismatch to name
   the symptom and retrieve known source-shape tactics.
3. Use `mwcc_debug` notes when the remaining mismatch appears MWCC-specific:
   register allocation, stack/frame layout, local lifetime, coalescing,
   scheduling, varargs/assert/report layout, or hard-to-explain compiler shape.
4. Use Ghidra as a second opinion for names, calls, strings, types, and control
   context. Do not paste decompiler output or let it outrank source, headers,
   symbols, splits, assembly, or objdiff.
5. Do not chase register allocation first. Fix instruction sequence, call shape,
   source structure, types, and data ownership before treating register diffs as
   the root cause.

Promote the compact MWCC pattern checklist from the reference docs:

- Declaration order can affect data/helper placement and source shape.
- `int` versus `s32` can affect loop compare/unroll/codegen shape because `s32`
  is a typedef to `long`.
- Wrong `void`/return signatures create durable caller mismatch noise; fix
  headers first.
- Reusing one natural pointer local can be closer to MWCC output than splitting
  every load.
- `static` versus `extern`, direct global access, and BSS declaration order can
  explain data access and relocation differences.
- Varargs/report/assert forms perturb stack layout; prefer known project macro
  and inline forms before manual expansions.
- Multiple `Vec3` locals and by-value helper calls can affect stack reservation;
  test declaration order and missing inlines before padding.
- If the instruction body is identical and only relocations/labels differ, treat
  it as a symbol/data layout problem, not a C rewrite problem.

Add a stack-frame warning:

- Most stack-layout bucket mismatches are compound. Only treat a stack/frame
  change as a clean local-padding candidate when opcodes and line count are the
  same, the frame-size or stack-slot delta is isolated, and diffs normalize to
  `r1` stack offsets. Otherwise classify it as source-shape, call-shape,
  register/operand cascade, or compound evidence before editing.

### `src/agents/worker/context/operating-guide.md`

Expand the evidence packet rule to explicitly include live knowledge tool
queries when the target evidence justifies them:

- "Tool lookups belong in the evidence packet when the source path, symbol,
  first mismatch, opcode pattern, or compiler-shape question is concrete."

Expand the source quality rule:

- "Treat m2c, Ghidra, AI, permuter output, and knowledge-tool pattern notes as
  candidate material. Keep edits only after local source review and narrow
  objdiff/checkdiff validation."

Add a stop/negative-evidence rule:

- "If tools only return broad register/allocation hints, stale notes, or
  fallback metadata and no bounded source-shape axis remains, stop as
  `stalled_no_useful_guess` or report a tooling/fact blocker. Do not continue
  into random perturbation."

### `src/agents/worker/templates/system.md`

Add a compact tool policy in `build_evidence_packet` or `resource_policy` so the
default worker prompt knows the tools exist even when only the operating guide is
selected:

```text
Use registered knowledge tool APIs when a concrete target question justifies
them: tool_outputs for cross-tool search, ghidra for symbol/address/name/string
or call context, opseq for instruction-shape analogs, mismatch_db for known
mismatch symptoms, and mwcc_debug for late MWCC compiler-shape questions. Tool
outputs are hypotheses with provenance; verify source edits with local
objdiff/checkdiff.
```

This should stay short in the system prompt. The detailed table belongs in
`lookup-guide.md` and `matching-guide.md`.

### `knowledge/tools/README.md`

Add a "Worker Use" subsection after the runner list:

- Tool runners and caches are operator/maintenance surfaces.
- Workers usually call API scripts, not runners.
- Workers should use `tool_outputs` when unsure which tool owns a clue, then use
  direct tool APIs for narrower lookup.
- Workers must report provenance and distinguish live runner evidence from
  supplemental fallback/reference rows.

### `docs/20-implementation/knowledge/00-overview.md`

Add one worker-facing paragraph after the tool runner contract:

- The implementation doc should explain that the registered tools serve two
  audiences: maintenance runners build caches and indexes, while workers consume
  small CLI APIs during evidence gathering. Link or point to the active worker
  context files for behavior policy.

This keeps the implementation overview from becoming a tactics guide while still
connecting the tool infrastructure to worker behavior.

## Command Cheatsheet To Promote

From an orchestrator checkout:

```bash
python3 knowledge/sources/tool_outputs/api/search.py --query <term> --limit 10 --json
python3 knowledge/sources/tool_outputs/api/tool_lookup.py --tool opseq --query <symbol> --limit 10 --json
python3 knowledge/tools/ghidra/api/status.py --json
python3 knowledge/tools/ghidra/api/lookup.py --query <symbol_or_address_or_path> --limit 10 --json
python3 knowledge/tools/opseq/api/status.py --json
python3 knowledge/tools/opseq/api/similar_functions.py --query <symbol_or_path_or_opcode_prefix> --limit 10 --json
python3 knowledge/tools/mismatch_db/api/status.py --json
python3 knowledge/tools/mismatch_db/api/search.py --query <mismatch_pattern> --limit 10 --json
python3 knowledge/tools/mwcc_debug/api/status.py --json
python3 knowledge/tools/mwcc_debug/api/lookup_dump.py --query <compiler_or_mismatch_pattern> --limit 10 --json
```

From the parent Melee checkout, keep the existing worker style with the
`decomp-orchestrator/` prefix.

## Priority Order

1. Update `lookup-guide.md` with the decision table, direct commands, and output
   interpretation rules. This is the biggest missing piece for discoverability.
2. Update `matching-guide.md` with the tool-assisted matching loop and MWCC
   pattern checklist. This turns the tools into actual decomp workflow.
3. Add a short default prompt policy in `worker/templates/system.md` so workers
   know the tools exist even without opt-in lookup context.
4. Update `operating-guide.md` with provenance/stop-condition guardrails.
5. Add a small worker-use paragraph to `knowledge/tools/README.md` and
   `docs/20-implementation/knowledge/00-overview.md`.

Avoid creating a brand-new `tool-usage-guide.md` unless the context manifest is
also updated to route it. The existing manifest selects only the operating guide
by default and adds lookup/matching guides by capability, so editing those active
files is the lowest-friction route.

## Reference Evidence Used

- Active worker context currently routes only `operating-guide.md` by default and
  adds lookup/matching/sweep context by capability:
  `src/agents/context/manifest.json`.
- The lookup guide currently names `mismatch_db` but not the direct Ghidra,
  opseq, mwcc_debug, or `tool_outputs` API commands:
  `src/agents/worker/context/lookup-guide.md`.
- The matching guide has the right source-shape categories but no
  tool-assisted loop:
  `src/agents/worker/context/matching-guide.md`.
- The operating guide has the right "candidate material, never trusted source"
  rule but should extend it to all knowledge-tool outputs:
  `src/agents/worker/context/operating-guide.md`.
- Tool infrastructure and live readiness are documented in:
  `knowledge/tools/README.md`,
  `knowledge/tools/ghidra/README.md`,
  `knowledge/tools/opseq/README.md`,
  `knowledge/tools/mismatch_db/README.md`,
  `knowledge/tools/mwcc_debug/README.md`, and
  `docs/20-implementation/knowledge/00-overview.md`.
- Tool API commands are documented in each `knowledge/tools/<tool>/api/README.md`
  and in `knowledge/sources/tool_outputs/api/README.md`.
- MWCC reference behavior comes from:
  `knowledge/sources/reference_docs/data/docs/mwcc-debug.md`,
  `knowledge/sources/reference_docs/data/docs/mwcc-pattern-book.md`, and
  `knowledge/sources/reference_docs/data/docs/mwcc-debug-stack-frame-characterization-2026-05-27.md`.
