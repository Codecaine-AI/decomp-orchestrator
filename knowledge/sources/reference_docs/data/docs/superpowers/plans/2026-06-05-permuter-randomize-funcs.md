# Permuter Randomize Funcs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let decomp-permuter score one target function while randomizing an explicit ordered set of function bodies, and have melee-agent bootstrap populate that set for injected same-TU helpers.

**Architecture:** Add `randomize_funcs` as a decomp-permuter `settings.toml` array that defaults to `[func_name]`. Preserve `func_name` as the scoring target, but preserve/deep-copy/normalize every selected randomizer entry body in candidates. Extend melee-agent settings rendering and bootstrap JSON so #424-injected helper bodies become searchable.

**Tech Stack:** Python 3.11, decomp-permuter unittest suite, melee-agent pytest suite, TOML settings, existing permuter@home JSON protocol.

---

### Task 1: Decomp-Permuter Candidate Scope

**Files:**
- Modify: `/Users/mike/code/decomp-permuter/src/ast_util.py`
- Modify: `/Users/mike/code/decomp-permuter/src/candidate.py`
- Test: `/Users/mike/code/decomp-permuter/test/test_randomizer_typemap.py`

- [ ] **Step 1: Add failing candidate-scope tests**

Add tests that construct `Candidate.from_source(...)` with
`randomize_fn_names=("helper",)`. Use a fake `Randomizer.randomize` spy for
scope/order tests where that is clearer than relying on a random pass. For the
normalization regression, enable an insertion-oriented randomizer pass such as
`perm_add_self_assignment` on a helper with an unbraced `if` or loop, because
expression-only passes such as `perm_mult_zero` do not prove nested statement
blocks were normalized. The assertions must prove:

- `candidate.fn_name` remains the caller;
- the helper body changes when helper-only scope is used;
- the caller body is preserved for scoring and output;
- a second candidate from the same source starts from the unmodified cached AST;
- a helper with unbraced control flow can be randomized without assertion.
- `randomize_fn_names=("caller", "helper")` invokes the randomizer in exactly
  that order, while the preserved AST set contains each body only once.

Run:

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -m unittest test.test_randomizer_typemap.TestRandomizerTypemap
```

Expected before implementation: at least one new test fails because
`Candidate.from_source` does not accept or use a helper scope.

- [ ] **Step 2: Add multi-function AST extraction**

In `src/ast_util.py`, add an `extract_fns(ast, fn_names)` helper that returns a
dict of `{name: (FuncDef, index)}`. It should:

- reject missing names and duplicate definitions with
  `CandidateConstructionFailure`;
- preserve all selected function bodies;
- strip only unselected non-inline `FuncDef` nodes to declarations;
- keep existing function declaration cleanup behavior.

Keep `extract_fn(ast, fn_name)` as:

```python
def extract_fn(ast: ca.FileAST, fn_name: str) -> Tuple[ca.FuncDef, int]:
    return extract_fns(ast, (fn_name,))[fn_name]
```

- [ ] **Step 3: Preserve, copy, and randomize scoped functions**

In `src/candidate.py`:

- add `randomize_fn_names: Optional[Iterable[str]] = None` to
  `Candidate.from_source`;
- canonicalize the entry scope to a tuple, defaulting to `(fn_name,)`;
- reject an empty explicit tuple and duplicates;
- derive a `preserved_fn_names` tuple containing a unique union of `fn_name`
  plus the entry scope;
- update the cached AST helper key to include `preserved_fn_names`;
- normalize every entry function body during cache construction;
- deep-copy every preserved `FuncDef` into the candidate AST;
- store `randomize_fn_names` on `Candidate`;
- update `randomize_ast()` to call `Randomizer.randomize(ast, fn)` for each
  entry function, then refresh `self.fn` to `fn_name`.

- [ ] **Step 4: Run candidate tests**

Run:

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -m unittest test.test_randomizer_typemap.TestRandomizerTypemap
```

Expected: all tests in that class pass.

### Task 2: Decomp-Permuter Settings and Remote Propagation

**Files:**
- Modify: `/Users/mike/code/decomp-permuter/src/main.py`
- Modify: `/Users/mike/code/decomp-permuter/src/permuter.py`
- Modify: `/Users/mike/code/decomp-permuter/src/net/core.py`
- Modify: `/Users/mike/code/decomp-permuter/src/net/client.py`
- Modify: `/Users/mike/code/decomp-permuter/src/net/evaluator.py`
- Test: `/Users/mike/code/decomp-permuter/test/test_randomizer_typemap.py`

- [ ] **Step 1: Add failing settings tests**

Add tests using lightweight fake compiler/scorer classes rather than
`test_perm.TestPermMacros`, because that suite requires the unavailable local
`mips-linux-gnu-gcc` toolchain. The tests should cover:

- `Permuter(..., randomize_fn_names=("test", "helper"), ...)` forwards the
  exact tuple into both base and candidate `Candidate.from_source` calls;
- `main.run_inner` reads `settings.toml` with
  `randomize_funcs = ["test", "helper"]` and constructs a permuter with that
  scope;
- `randomize_funcs = []` is rejected;
- duplicate names are rejected;
- non-string elements are rejected.
- `randomize_funcs = ["missing_helper"]` is rejected with
  `CandidateConstructionFailure`.
- `PermuterData` JSON round-trips `randomize_fn_names`, and an older JSON
  payload without that field decodes to `[fn_name]`.

Run:

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -m unittest test.test_randomizer_typemap.TestRandomizerTypemap
```

Expected before implementation: the new scope tests fail because neither
`Permuter` nor settings parsing accepts `randomize_funcs`.

- [ ] **Step 2: Thread scope through Permuter**

Add `randomize_fn_names` to `Permuter.__init__`, store a canonical tuple, pass
it into both base and candidate `Candidate.from_source(...)` calls, and expose it
for `make_portable_permuter`.

- [ ] **Step 3: Parse settings**

In `src/main.py`, parse `randomize_funcs` if present. Use `json_array(..., str)`,
reject empty arrays and duplicates with clear errors, and pass `None` when the
key is absent.

- [ ] **Step 4: Propagate remote payloads**

Add `randomize_fn_names` to `PermuterData`. JSON decode should default missing
payloads to `[fn_name]`; JSON encode should include the field. Client portable
data and evaluator reconstruction should pass the field through. Add direct
tests for `permuter_data_to_json`, `permuter_data_from_json`, and
`make_portable_permuter` so the remote path cannot silently drop the scope.

- [ ] **Step 5: Run settings and remote tests**

Run:

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -m unittest test.test_randomizer_typemap.TestRandomizerTypemap
.venv/bin/python -m unittest discover -s test -p 'test_custom_scorer*.py'
```

Expected: all selected tests pass.

### Task 3: Melee-Agent Settings Rendering and Bootstrap Wiring

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/mwcc_debug/permuter_config.py`
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/cli/debug.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_mwcc_debug_permuter_config.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Add failing settings renderer test**

Add a test asserting:

```python
spec = build_spec("fn_test", None, randomize_funcs=["fn_test", "helper"])
text = render_settings_toml(spec)
parsed = tomllib.loads(text)
assert parsed["randomize_funcs"] == ["fn_test", "helper"]
```

Run:

```bash
cd /Users/mike/code/melee
PYTHONDONTWRITEBYTECODE=1 PYTEST_ADDOPTS= pytest --no-cov -p no:cacheprovider tools/melee-agent/tests/test_mwcc_debug_permuter_config.py -q
```

Expected before implementation: `build_spec` does not accept
`randomize_funcs`.

- [ ] **Step 2: Render randomize_funcs**

Extend `SettingsTomlSpec`, `build_spec`, and `render_settings_toml` to carry and
render a top-level `randomize_funcs` array when provided. Preserve existing
section ordering: scalar settings first, then optional `weight_overrides`, then
optional `[scorer]`.

- [ ] **Step 3: Add failing bootstrap tests**

Extend the #424 bootstrap injection test to assert:

- JSON includes `"randomize_funcs": ["fn_80000000", "helper_inline"]`;
- fresh `settings.toml` includes the same TOML array.

Add a second test where an existing `settings.toml` is kept. It should assert:

- the file content is not overwritten;
- JSON includes `"randomize_funcs": null`;
- JSON includes `"recommended_randomize_funcs": ["fn_80000000", "helper_inline"]`;
- JSON includes a warning/status field explaining that existing settings were
  kept.

Add a third test where the same existing settings file is present but bootstrap
is invoked with `--force`. It should assert the file is rewritten and now
contains `randomize_funcs = ["fn_80000000", "helper_inline"]`.

- [ ] **Step 4: Wire bootstrap**

In `_bootstrap_permuter_dir`, derive:

```python
recommended_randomize_funcs = (
    [function, *injected_inline_callees] if injected_inline_callees else None
)
```

When settings are written, pass this list to `build_spec`. When settings are
kept, report the recommendation and a concise status in the JSON payload without
modifying the existing file.

- [ ] **Step 5: Run melee-agent focused tests**

Run:

```bash
cd /Users/mike/code/melee
PYTHONDONTWRITEBYTECODE=1 PYTEST_ADDOPTS= pytest --no-cov -p no:cacheprovider tools/melee-agent/tests/test_mwcc_debug_permuter_config.py tools/melee-agent/tests/test_debug_cli_reorg.py -k 'permuter_config or permute_bootstrap or permuter_bootstrap' -q
python -m compileall tools/melee-agent/src/mwcc_debug/permuter_config.py tools/melee-agent/src/cli/debug.py
git diff --check
```

Expected: selected tests and checks pass.

### Task 4: Integration Verification and Commits

**Files:**
- Commit all modified files in `/Users/mike/code/decomp-permuter` except
  pre-existing unrelated dirty files such as `src/scorer.py` and
  `nonmatchings.zip`.
- Commit all modified files in `/Users/mike/code/melee`, including this plan and
  the design spec.

- [ ] **Step 1: Run decomp-permuter verification**

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -m unittest test.test_randomizer_typemap.TestRandomizerTypemap
.venv/bin/python -m unittest discover -s test -p 'test_custom_scorer*.py'
git diff --check
```

- [ ] **Step 2: Run melee-agent verification**

```bash
cd /Users/mike/code/melee
PYTHONDONTWRITEBYTECODE=1 PYTEST_ADDOPTS= pytest --no-cov -p no:cacheprovider tools/melee-agent/tests/test_mwcc_debug_permuter_config.py tools/melee-agent/tests/test_debug_cli_reorg.py -q
python -m compileall tools/melee-agent/src/mwcc_debug/permuter_config.py tools/melee-agent/src/cli/debug.py
git diff --check
```

- [ ] **Step 3: Run installed-entrypoint smoke**

After refreshing the editable install:

```bash
cd /Users/mike/code/melee
/opt/homebrew/bin/python3.11 -m pip install -e tools/melee-agent
/opt/homebrew/bin/python3.11 - <<'PY'
import pathlib
import src.cli.debug as debug
print(pathlib.Path(debug.__file__).resolve())
PY
```

Expected import path:

```text
/Users/mike/code/melee/tools/melee-agent/src/cli/debug.py
```

Run a temporary `debug permute bootstrap --json` smoke that injects one helper
and assert the output settings contain:

```toml
randomize_funcs = ["fn_80000000", "helper_inline"]
```

- [ ] **Step 4: Resolve issue**

Resolve only #425 after the commits and verification:

```bash
/opt/homebrew/bin/melee-agent issue resolve 425 --note "Fixed in <hashes>: decomp-permuter randomize_funcs plus melee-agent bootstrap wiring."
/opt/homebrew/bin/melee-agent issue list --status open
```
