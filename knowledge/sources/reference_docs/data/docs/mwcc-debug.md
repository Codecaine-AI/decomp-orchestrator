# mwcc-debug local-first workflow

`mwcc-debug` dumps MWCC's back-end PCode passes for a translation unit:
basic blocks, virtual registers, interference graph events, register
coloring decisions, and final scheduled instructions. Use it after the
lighter tools (`mismatch-db`, `opseq`, `ghidra`, and Discord notes) stop
explaining a last-mile mismatch.

The canonical CLI is grouped under `melee-agent debug`:

| Group | Purpose |
|---|---|
| `dump` | Produce or refresh pcdumps. |
| `inspect` | Read, compare, and explain existing pcdumps. |
| `target` | Derive and score allocator targets. |
| `suggest` | Surface source-shape hints. |
| `mutate` | Try targeted source mutations. |
| `permute` | Integrate with decomp-permuter. |
| `util` | Low-level helpers and catalogs. |

## Normal workflow

Prefer local cached dumps. They see the current worktree and are much
faster than the SSH path.

```bash
melee-agent debug dump setup
melee-agent debug dump local src/melee/mn/foo.c
melee-agent debug inspect guide -f fn_80247510
melee-agent debug inspect analyze -f fn_80247510
```

If the guide points at allocator shape, derive and score a target:

```bash
melee-agent debug target derive -f fn_80247510 > /tmp/target.yaml
melee-agent debug target score-dump -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target score-source src/melee/mn/foo.c -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target match-iter-first -f fn_80247510
```

If the issue is source shape, try the targeted suggestion and mutation
commands before broad permutation:

```bash
melee-agent debug suggest casts fn_80247510 --signedness
melee-agent debug suggest coalesce -f fn_80247510 --discover --top 5
melee-agent debug mutate decl-orders fn_80247510 --strategy all
melee-agent debug mutate type-change -f fn_80247510 --var local_var --type u32
melee-agent debug mutate insert-alias -f fn_80247510 --var local_var --at 0
```

For decomp-permuter:

```bash
melee-agent debug permute config -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute run -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute verify output-1234/source.c -f fn_80247510
melee-agent debug permute triage permute_output_dir -f fn_80247510 --apply-best
melee-agent debug permute fix-compile path/to/compile.sh
```

## Local and remote dumps

Local mode is the default path for day-to-day iteration:

```bash
melee-agent debug dump setup
melee-agent debug dump local src/melee/lb/lbarq.c
melee-agent debug dump local src/melee/lb/lbarq.c --output build/mwcc_debug/lbarq.txt
melee-agent debug dump local src/melee/lb/lbarq.c --output -
```

With no `--output`, local dumps are cached under
`build/mwcc_debug_cache/`, so later commands can auto-resolve by
`--function`.
Forced local runs do not update the baseline cache. Pass
`--output /tmp/forced.txt` and pass that pcdump path to follow-up
commands such as `melee-agent debug target derive` or
`melee-agent debug target score-dump`.

Remote mode remains a fallback when local wibo is unavailable or you
need the Windows host behavior:

`melee-agent debug dump setup` is local setup only. Remote dumps require
a preconfigured Windows SSH host with a repo checkout, `run_pcdump.ps1`,
and the patched DLL already installed.

```bash
melee-agent debug dump remote src/melee/lb/lbarq.c
melee-agent debug dump remote src/melee/lb/lbarq.c --output build/mwcc_debug/lbarq.txt
melee-agent debug dump remote src/melee/lb/lbarq.c --timeout 180
melee-agent debug dump remote src/melee/lb/lbarq.c --no-pull
```

Remote runs use the Windows checkout, so uncommitted local changes are
not visible there. Local runs compile the current worktree.

## Reading dumps

Use `inspect` commands instead of scrolling raw output first:

```bash
melee-agent debug inspect analyze -f fn_80247510
melee-agent debug inspect guide -f fn_80247510 --target /tmp/target.yaml
melee-agent debug inspect diff before.txt after.txt -f fn_80247510
melee-agent debug inspect simulate -f fn_80247510 --all
melee-agent debug inspect stuck fn_80247510
melee-agent debug inspect diagnose fn_80247510
```

The raw dump still matters when checking exact pass output. Look for
`BEFORE REGISTER COLORING`, `COLORGRAPH DECISIONS`, `SIMPLIFY GRAPH`,
`AFTER REGISTER COLORING`, and `AFTER INSTRUCTION SCHEDULING`.

## Force options

Force options are hypothesis tests. They patch allocator decisions in a
dump to see whether a desired register shape would close the assembly
gap. A forced match means the target may be reachable through natural C;
it is not a source change you can commit by itself.

```bash
melee-agent debug dump local src/melee/mn/foo.c \
    --force-phys "36:31" --force-phys-fn fn_80247510 \
    --output /tmp/forced.txt
melee-agent debug target derive /tmp/forced.txt -f fn_80247510 > /tmp/target.yaml

melee-agent debug dump local src/melee/mn/foo.c \
    --force-coalesce "53=3" --force-coalesce-fn fn_80247510 \
    --output /tmp/forced.txt

melee-agent debug dump local src/melee/mn/foo.c \
    --force-phys-iter "0:3:31" --force-phys-fn fn_80247510 \
    --output /tmp/forced.txt
```

For `--force-phys-iter`, `class:iter:phys` values come from the
`COLORGRAPH DECISIONS` / `SIMPLIFY GRAPH` sections in the pcdump.

Use `melee-agent debug target match-iter-first -f fn_80247510` before
forced iter-order testing. `--force-iter-first` is global to the whole
translation unit and has no per-function scope; use it only on
single-function TUs or after accepting that it can perturb other
functions in the file:

```bash
melee-agent debug dump local src/melee/mn/foo.c \
    --force-iter-first "62,47" --output /tmp/forced.txt
```

`--force-phys-fn` scopes `--force-phys` and `--force-phys-iter` only.

## Utility helpers

```bash
melee-agent debug util patterns
melee-agent debug util patterns decl-order
melee-agent debug util name-magic build/GALE01/src/melee/mn/foo.o --map @123=lbl_804D0000
melee-agent debug util verify-name-magic -f fn_80247510
```

`util patterns` lists the named source-shape patterns that guidance can
cite. `util name-magic` and `util verify-name-magic` handle anonymous
magic-constant symbol naming so relocation noise does not hide real text
differences.

Bridge helpers live under inspect:

```bash
melee-agent debug inspect var-to-virtual local_var -f fn_80247510
melee-agent debug inspect virtual-to-var r62 -f fn_80247510
```

## Relationship to mwcc-inspect

`mwcc-debug` is the back-end view: PCode passes, register allocation,
and scheduling. `mwcc-inspect` is the front-end view: ENode trees,
ObjObjects, statements, and parser-level structure.

Use `mwcc-inspect` when the question is "how did MWCC parse this C?"
Use `mwcc-debug` when the question is "why did the allocator or codegen
pick this shape?" For stubborn functions, using both on the same
translation unit is often the fastest way to separate source-expression
issues from allocator issues.

## Reporting Tooling Issues

Report mwcc-debug hangs, confusing output, missing affordances, bad
suggestions, and feature requests in the shared tool issue queue:

```bash
melee-agent issue report "mwcc-debug local dump hung after COLORGRAPH DECISIONS" \
  --tool mwcc-debug --kind bug --function fn_80247510 \
  --body "Command, last visible output, timeout, and what this blocked"
```

Bugs and papercuts should stay lightweight. Feature requests must include the
governance metadata enforced by the CLI:

```bash
melee-agent issue report "mwcc-debug needs a source lever for frame-only walls" \
  --kind feature --tool mwcc-debug --function gm_801A9DD0 \
  --reusable-class "stack/local unused home reservation" \
  --applies-to gm_801A9DD0 \
  --source-actionable-output "ranked frame source transforms and score-source target" \
  --stop-condition "no candidate improves frame score after 50 probes" \
  --existing-workflow-failed "inspect diagnose was register-only and reported no fast transform"
```

Use `--governance-waiver "<reason>"` only for exploratory feature issues that
cannot honestly fill those fields yet. When resolving an issue, add
`--impact matched|retained-source-improvement|negative-evidence|infrastructure-only|diagnostic-only`
when the outcome is known.

If a `melee-agent` command fails through the wrapped entrypoint, copy the
suggested `melee-agent issue report ...` command it prints. If it hangs,
interrupt it and report the hang manually.
