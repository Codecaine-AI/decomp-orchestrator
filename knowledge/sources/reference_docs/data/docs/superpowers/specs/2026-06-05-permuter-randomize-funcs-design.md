# Permuter Randomize Funcs Design

## Problem

Issue #425 reports that the #424 bootstrap fix makes same-translation-unit
helper bodies visible to `decomp-permuter`, but the randomizer still mutates only
`func_name`. This gives meaningful caller scores when the helper inlines into
the caller, but the search cannot change the helper source shape that controls
the inlined codegen. The concrete blocker is `fn_803AC7DC` and
`fn_803AC6B8`, where the caller is scored but the useful lever is the injected
same-TU helper `fn_803AC634`.

## Goals

- Add an explicit `settings.toml` key:

  ```toml
  func_name = "fn_803AC7DC"
  randomize_funcs = ["fn_803AC7DC", "fn_803AC634"]
  ```

- Keep `func_name` as the scoring, diff, output, and display target.
- Treat `randomize_funcs` as the ordered list of function bodies that receive
  randomizer entry passes.
- Preserve the scoring target body in candidates even when `func_name` is not in
  `randomize_funcs`, because PERM macro evaluation still targets the scored
  function.
- Preserve backward compatibility: missing `randomize_funcs` behaves exactly as
  `randomize_funcs = [func_name]`.
- Propagate the scope through local runs and permuter@home/remote runs.
- Have `melee-agent debug permute bootstrap` write `randomize_funcs` for fresh
  or forced settings when it injects inline same-TU helpers, and report the
  effective or missing scope in JSON.

## Non-Goals

- Do not change scoring: candidate object files are still scored against
  `target.o` for `func_name`.
- Do not attempt to make a perfectly sealed mutation sandbox. Existing
  randomizer passes may update declarations or types reachable from a selected
  body. `randomize_funcs` names randomizer entry bodies, not every AST node that
  can change as a side effect.
- Do not add a new command-line option to decomp-permuter; the setting must
  travel with function directories and remote jobs.
- Do not overwrite existing human-customized `settings.toml` during bootstrap
  unless the user passes `--force`.

## Alternatives

### Recommended: Explicit Randomizer Entry Scope

Add `randomize_funcs` as a top-level settings array. This keeps scoring and
mutation concerns separate, makes the behavior reproducible across local and
remote jobs, and lets `melee-agent` write the exact helper set discovered during
bootstrap.

### Rejected: Mutate Every Function Body Present in `base.c`

This would make #425 work for #424-generated files, but it would also mutate
unrelated inline support bodies that decomp-permuter imports for compilation.
That broadens the search space and makes results harder to explain.

### Rejected: Reuse `func_name` for Multiple Names

Changing `func_name` from string to list would break settings compatibility and
would confuse scorer/output code that is deliberately tied to one target
function.

## Decomp-Permuter Design

### Settings Parsing

`src/main.py` reads `randomize_funcs` with TOML array semantics. If the key is
absent, it passes `None` and the permuter defaults to `[func_name]`. If the key
is present:

- it must be a non-empty list of strings;
- duplicate names are rejected;
- missing function bodies are reported as candidate construction failures;
- list order is preserved and used as the per-candidate randomizer entry order.

### Candidate AST Preservation

`src/ast_util.py` gets a multi-function extraction helper. The helper preserves
all selected function bodies, strips only unselected non-inline function
definitions down to declarations, and keeps the current declaration cleanup
behavior. The existing `extract_fn` remains as a compatibility wrapper.

`src/candidate.py` changes its cache key from `(source, fn_name)` to
`(source, fn_name, preserved_func_names)`, where `preserved_func_names` is an
immutable unique union containing `func_name` plus all names in
`randomize_funcs`. This union is for AST preservation only; the
`randomize_funcs` list itself keeps its configured order for randomizer entry
calls. During cache construction it normalizes every function that can be
randomized, not just `func_name`, so randomizer passes can safely insert into
helper bodies with unbraced control flow.

For each candidate instance, every preserved function body is deep-copied from
the cached AST into the shallow-copied top-level AST. This prevents helper
randomization from mutating the shared cached AST or leaking changes across
candidates.

### Randomization Semantics

`Candidate.randomize_ast()` refreshes the selected function handles from the
candidate AST and calls `Randomizer.randomize(ast, fn)` once per configured
entry body, in `randomize_funcs` order. It then refreshes `self.fn` to the
scoring target.

If a selected function has `PERM_RANDOMIZE` markers, existing region behavior
applies inside that function. If it has no markers, the existing randomizer
behavior applies to that whole function. This is intentional: the setting says
which bodies are search entry points.

### Remote Propagation

`src/net/core.py` adds `randomize_fn_names` to `PermuterData`, JSON encode, and
JSON decode. `src/net/client.py` includes the local permuter's scope in portable
job data. `src/net/evaluator.py` passes the scope back into `Permuter`. Older
remote payloads without the field default to `[fn_name]`, preserving
compatibility for in-flight or stale clients.

## Melee-Agent Design

`tools/melee-agent/src/mwcc_debug/permuter_config.py` extends
`SettingsTomlSpec` with `randomize_funcs: list[str] | None` and renders the
array as a top-level TOML key when provided.

`tools/melee-agent/src/cli/debug.py` already receives the
`injected_inline_callees` list from #424. When bootstrap writes fresh settings,
or rewrites settings under `--force`, it passes
`randomize_funcs=[function, *injected_inline_callees]` when the helper list is
non-empty. If helper injection occurred but bootstrap kept an existing
`settings.toml`, the JSON payload reports that `randomize_funcs` was not written
and includes the recommended list so agents can rerun with `--force` or update
settings manually.

Existing settings preservation remains unchanged because agents may have custom
weights or scorer sections.

## Testing

Decomp-permuter tests cover:

- candidate randomization can mutate a helper-only scope while still scoring the
  caller;
- caller-plus-helper scopes randomize both bodies in order;
- cached ASTs are not contaminated across candidates;
- helper functions are normalized before randomization;
- invalid `randomize_funcs` settings reject empty lists, duplicates, wrong
  element types, and missing function bodies;
- permuter@home JSON round-trips the new scope and older payloads default to
  `[fn_name]`.

Melee-agent tests cover:

- `render_settings_toml` emits a parseable top-level `randomize_funcs` array;
- bootstrap JSON and settings include `[function, injected_helper]` for fresh
  settings after helper injection;
- bootstrap reports a recommended randomizer scope when helper injection
  happened but an existing settings file was kept.

## Review Notes

Independent design review required two important corrections that are included
above:

- normalize every randomized helper body, not just `func_name`;
- update permuter@home payloads so remote workers do not silently fall back to
  mutating only `func_name`.
