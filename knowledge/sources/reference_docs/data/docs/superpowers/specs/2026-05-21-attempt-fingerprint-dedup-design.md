# Attempt Fingerprint Dedup

## Problem

Long-running matching sessions repeatedly apply the same source change to the
same function, even after the prior attempt failed. From a sweep of 5
substantive matching sessions (~30–100 hours each):

| Session | Tool | Attempts | Repeat attempts | Worst single repeat |
|---|---|---|---|---|
| f3df857d (Claude) | Edit | 538 | 74 | 4x |
| 32f87360 (Claude) | Edit | 457 | 70 | — |
| 9f800355 (Claude) | Edit | 585 | 115 | — |
| 6c6be25b (Claude) | Edit | 405 | 89 | — |
| 019e3d43 (Codex) | apply_patch | 1,412 | 600 | **29x** |

In the worst case, the same four-line code addition was applied 29 times
across 649 turns on `mn/mnvibration.c`. Cross-session repeats also occur — the
same snippet shows up across two unrelated Claude sessions on the same
function. The driving cause is context loss: agent compaction events strip
the in-conversation history of what was tried, so the agent re-discovers the
same dead end repeatedly.

The existing `melee-agent attempts record` ledger captures attempts with
prose notes, classification, and a `move_on_recommended` flag. It does not
fingerprint the source state, so there is no programmatic way to ask "did
we already try this exact code?" Recording is also voluntary, so most
attempts are not in the ledger at all.

## Goals

1. **Detect a repeat at the moment of verification.** When the agent runs
   `tools/checkdiff.py <fn>`, the tool should recognize that the function's
   current source state matches a previously-tried state and surface the
   prior outcome.
2. **Survive compaction and cross-session context.** Storage must be
   external to the conversation and queryable by any future agent on the
   same host. Cross-host repeat detection is out of scope (the ledger
   lives in `~/.config/decomp-me/`, per-host by design).
3. **Automatic capture.** Every checkdiff invocation should record (or
   update) a fingerprinted attempt without the agent having to opt in.
4. **Per-function precision.** The same code change applied to two
   different functions must not collide (e.g., `u8 cursor_row;` legitimately
   appears in many cleanup loops). Fingerprint is scoped to the target
   function's body, not the diff or the whole file.

### Success criterion

v1 is successful if, on a follow-up sweep of comparable matching
sessions after rollout (the next 3 multi-day sessions, typically
within 2–3 weeks), the per-session repeat-attempt rate (raw repeats /
total attempts) is below **5% absolute** for both Claude and Codex.
Current baselines from the data sweep: 14% (Claude average) and 42%
(Codex 55h session). The largest single-fingerprint repeat count
should also be capped at ~3 (down from 29). Failure to hit these
signals that Layer-3 (hypothesis-level) work is justified.

## Non-goals

- Hard-blocking the build. A function-body match plus an unchanged compile
  environment is a strong signal, but legitimate retries exist (e.g.,
  upstream header change with the same function source). The intervention is
  a prominent warning showing prior outcome, not a refusal.
- Hypothesis-level (LLM-summarized) dedup. The data model leaves room for
  it (free-form `note` is preserved per attempt), but Layer-3 clustering is
  out of scope for v1.
- Edit-time intercept. v1 catches repeats at checkdiff time. An Edit-time
  PreToolUse hook is plausible v2 work but adds platform-specific code
  (Claude Code hooks vs Codex hooks) and is deferred.
- Migrating the existing `attempt_ledger.json` to SQLite. v1 extends the
  JSON shape.

## Architecture

Two new components and one modification:

```
┌──────────────────────────────────┐
│ tools/checkdiff.py               │  (modified)
│                                  │
│  1. extract fn body              │ ──► fingerprint.py
│  2. compute fingerprint          │
│  3. lookup prior in ledger       │ ──► tracking.py
│  4. if match: emit [REPEAT] banner│
│  5. run objdiff (always)         │
│  6a. if match: increment         │ ──► tracking.py
│      replay_count on existing    │     (in-process import,
│  6b. else: append new attempt    │      no subprocess)
└──────────────────────────────────┘
            │            │
            ▼            ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ fingerprint.py (new)    │   │ tracking.py (extended)  │
│                         │   │                         │
│ - extract_function_body │   │ - record_attempt(...,   │
│   (tree-sitter-c)       │   │     fingerprint=,       │
│ - compute_fingerprint   │   │     fingerprint_norm=,  │
│   (raw + normalized)    │   │     source_file=)       │
│                         │   │ - find_attempt_by_fp()  │
│                         │   │   (new helper)          │
└─────────────────────────┘   │ - increment_replay()    │
                              │   (new helper)          │
                              └─────────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────────┐
                              │ attempt_ledger.json     │
                              │   functions[<fn>]       │
                              │     attempts[]          │
                              │       + fingerprint     │
                              │       + fingerprint_norm│
                              │       + source_file     │
                              │       + replay_count    │
                              │       + last_replay_ts  │
                              └─────────────────────────┘
```

### Component 1: `fingerprint.py` (new module)

A small library inside `tools/melee-agent/src/cli/` exposing:

```python
def extract_function_body(source_path: Path, function_name: str) -> Optional[str]:
    """Use tree-sitter-c to find function_name's definition in source_path,
    return the source text between (and excluding) its outermost braces.
    Returns None if not found."""

def compute_fingerprint(function_body: str) -> tuple[str, str]:
    """Return (raw_fingerprint, normalized_fingerprint).
    - raw: sha1(function_body with line/block comments stripped)
    - normalized: sha1(tree-sitter-tokenized body, joined with single spaces)
    Both are 12-char hex prefixes."""

def fingerprint_for(source_path: Path, function_name: str) -> Optional[Fingerprint]:
    """Convenience: extract + compute. Returns dataclass."""
```

**Why tree-sitter (not libclang).** The codebase already depends on
`tree-sitter` and `tree-sitter-c` (declared in
`tools/melee-agent/pyproject.toml`), and
`tools/melee-agent/src/mwcc_debug/ast_walker.py` already has
`_find_function_definition(root, source_bytes, fn_name)` (line 187) that
does exactly the lookup we need. Reusing this:

- avoids a new system-level dependency (`libclang.so`/`libclang.dylib`)
  that would break environments installing the agent from
  `pyproject.toml` alone
- avoids libclang's include-path/preprocessing complexity (tree-sitter
  parses without preprocessing, so missing includes are a non-issue)
- reuses an in-house parser that already handles pragmas, multi-line
  declarators, function-pointer return types, and macro-expanded
  signatures correctly in the `mwcc_debug` flow

Implementation: extract the existing `_find_function_definition` and the
tree-sitter-c parser bootstrap (lines 19–22 of `ast_walker.py`) into a
shared helper in `tools/melee-agent/src/common/tree_sitter_c.py` (new),
imported by both `ast_walker.py` and `fingerprint.py`. The
`function_definition` node's text spans the entire definition; we slice
the `compound_statement` child (the function body, including braces) and
strip the outer braces for the fingerprint input.

**Fallback chain.** If tree-sitter fails to load (missing wheel) or the
function definition is not found, `extract_function_body` falls back to
a brace-matching regex on the function's signature line. If both fail,
fingerprint computation is skipped and the attempt is recorded without
one. This degrades gracefully — checkdiff still runs, just with no
repeat detection for that attempt.

**Known limitation (deferred to v2).** The extracted body is the text
inside the function's outermost braces. Pragmas immediately above the
function (`#pragma auto_inline off`, `#pragma dont_inline on`) and
`static inline` helpers used only by this function are *outside* that
extent but affect codegen. Two attempts with identical bodies but
different surrounding pragmas will fingerprint the same and may
incorrectly flag as a repeat. The divergent-match% mitigation (see
edge-case table) catches this when the agent re-runs the build — the
new entry is written, not a replay bump. True fix is the v2 transitive
fingerprint (widen the extent to include preceding pragmas and called
static-inline definitions).

### Component 2: extended ledger schema

Each attempt entry in `attempt_ledger.json` gains five fields:

```json
{
  "index": 5,
  "timestamp": 1778884497.06,
  "agent_id": "pid83109",
  "worktree": "/Users/mike/...",
  "match_percent": 99.2,
  "outcome": "reverted",
  "classification": "register-allocation",
  "blocker": "",
  "retained": false,
  "note": "Tried assigning aligned_100 before width...",
  "fingerprint": "9afcad123cd3",          // ← new
  "fingerprint_norm": "8eb04ae7d5b1",     // ← new
  "source_file": "src/melee/mn/mnname.c", // ← new (informational; not used for lookup)
  "replay_count": 0,                      // ← new (incremented on dedup-on-write)
  "last_replay_ts": null                  // ← new (epoch float when last replayed)
}
```

**Storage location.** The ledger lives at
`~/.config/decomp-me/attempt_ledger.json` — a per-host (not per-agent)
file already used by `tracking.py`. The per-agent `match_history.json`
files in the same directory are *not* touched by this design; they
serve a separate purpose (scratch-slug history). All fingerprint reads
and writes go through `attempt_ledger.json`, so cross-agent
same-host dedup is automatic.

**Dedup-on-write.** When checkdiff records an attempt, it first asks
`tracking.py` for any existing attempt entry on this function with a
matching `fingerprint`. If found AND the new match% equals the entry's
stored match% (within 0.1% tolerance), `increment_replay(entry)` bumps
`replay_count` and updates `last_replay_ts` — *no new ledger entry,
and no mutation of `outcome`, `note`, `classification`, or `blocker`
on the existing entry*. (If the agent later wants to reclassify the
prior entry, the manual `melee-agent attempts record --outcome reverted`
flow still works.) If the new match% differs, a fresh entry is written
instead — see the divergent-match% row in edge cases.

This dedup-on-write logic addresses three problems:

1. **Streak-counter pollution for repeated fingerprints.** The existing
   `_move_on_state()` logic bumps `no_progress_count` for every
   neutral/non-improving attempt. Without dedup, the 29-copy case would
   drive `no_progress_count` to 29, triggering spurious `move_on`
   recommendations. With dedup, repeat-fingerprint replays don't add
   entries and don't touch the streak. *Novel-fingerprint* auto-records
   still go through `record_attempt` (which still updates the streak),
   so the streak still meaningfully reflects "how many distinct
   experiments produced no improvement."
2. **Ledger growth.** The 29-copy case writes 1 entry with
   `replay_count=28` instead of 29 entries.
3. **Banner repeat-count signal.** `replay_count` is what the
   `[REPEAT]` banner displays ("this is the 30th time at this
   fingerprint"), making the cost obvious to the agent.

No migration needed; old entries lack the new fields, and lookups treat
missing fingerprints as "no prior match." `_normalize_ledger()` already
tolerates unknown per-entry fields (it only normalizes the top-level
shape), so the schema extension is forward-compatible. Fingerprints are
12-char SHA1 prefixes (48-bit space), keyed within a single function's
namespace. Birthday-bound collision probability for N=1000 attempts on
one function: N²/(2·2⁴⁸) ≈ 1.78e-9. Acceptable.

`source_file` is informational only — recorded for debugging and human
review, never used for lookup. If a function moves TUs upstream, the
fingerprint lookup still matches; only the displayed `source_file` will
reflect the original location.

### Component 3: `tools/checkdiff.py` modifications

Insert a pre-build phase and a post-build phase around the existing
objdiff invocation. All `tracking.py` interaction is done via direct
in-process import (no subprocess to `melee-agent`).

**Note on import path.** `tools/checkdiff.py` lives outside the
`melee-agent` package. It already does `sys.path.insert(0,
str(melee_agent_src))` for `apply_name_magic_if_available` (around line
198). The same shim works for `from src.cli.tracking import
find_attempt_by_fp, increment_replay, record_attempt` and
`from src.cli.fingerprint import fingerprint_for`.

**Pre-build (added):**
1. Resolve target source file via the existing `find_unit_for_function()`
   helper (already returns `obj_path`; source file is
   `SRC_ROOT / f"{obj_path}.c"`). If the function lives in a `.s`-only
   TU (no `.c` source exists), skip fingerprinting; behavior is identical
   to the parse-failure path.
2. Call `fingerprint_for(source_file, function_name)`. If returns None,
   skip step 3 (and remember "no fingerprint" so post-build skips the
   dedup branch).
3. Use `tracking.find_attempt_by_fp(function_name, fingerprint,
   fingerprint_norm)` (new helper) to locate any prior entry on this
   function with a matching `fingerprint` or `fingerprint_norm`. Cache
   the result for the post-build phase. *No banner is emitted yet* —
   we wait for the post-build match% so the banner shows the full
   comparison.

**Post-build (added):**
4. After objdiff completes and the new `match_percent` is known,
   classify into one of three branches:

   **a. Repeat (fingerprint matches AND match% within 0.1%):**
      - Call `tracking.increment_replay(entry)`. No new ledger entry;
        streak counter untouched; prior `outcome`/`note`/`classification`/
        `blocker` are *not* mutated.
      - Emit a `[REPEAT]` banner (or `[REPEAT (semantic)]` if the match
        was on `fingerprint_norm` only):

        ```
        [REPEAT] this source matches attempt #N for fn_8024E1B4
          - prior match%:    99.2   (class=register-allocation, outcome=reverted)
          - current match%:  99.2   (same — verified)
          - prior agent:     pid83109, 2026-05-15 22:34:17 UTC
          - prior note:      "Tried assigning aligned_100 before width..."
          - repeat count:    this is the 30th time at this fingerprint
        ```

   **b. Divergent repeat (fingerprint matches BUT match% differs):**
      - Append a new entry via `record_attempt` (same fingerprint, new
        match%, `outcome="neutral"`). Both old and new entries remain.
      - Emit a `[DIVERGENT REPEAT]` banner:

        ```
        [DIVERGENT REPEAT] same source as attempt #N but new outcome
          - prior match%:    99.2   (class=register-allocation)
          - current match%:  98.7   ← changed; external state differs
          - prior agent:     pid83109, 2026-05-15 22:34:17 UTC
          - prior note:      "Tried assigning aligned_100 before width..."
          - this fingerprint has produced 2 distinct match%s historically
        ```

      The agent reads this as "you didn't change the function body, but
      a header / static-inline helper / build flag changed since the
      last attempt." Useful diagnostic.

   **c. Novel (no fingerprint match, OR fingerprint computation was
      skipped):**
      - Call `tracking.record_attempt(function_name, match_percent=pct,
        outcome="neutral", fingerprint=..., fingerprint_norm=...,
        source_file=...)`. Streak counter updates normally via the
        existing `improved_score` logic. Outcome is always recorded as
        `neutral`; agents reclassify via `melee-agent attempts record
        --outcome reverted` (or similar) if they want a richer label.
      - No banner emitted (this is the common case).

**CLI surface:**
- `--no-fingerprint` flag on `checkdiff.py` disables both the pre-build
  lookup and post-build record (useful for CI / environments without
  tree-sitter).
- `CHECKDIFF_NO_FINGERPRINT=1` env var sets the same — important because
  agents typically invoke `tools/checkdiff.py <fn>` without flags.
- `--dry-run` flag is **read-only**: runs pre-build + would-be
  post-build classification using a *cached* `build/GALE01/report.json`
  (path resolution unchanged). The ledger is consulted but **never
  written**. If `report.json` does not exist, exits with code 3
  (distinct from argparse's code 2). Use cases: integration testing,
  ad-hoc queries by agents who want to check "what would happen if I
  ran checkdiff right now?" without burning the build time or polluting
  the ledger.

The `record_attempt()` API in `tracking.py` gains three optional kwargs
(`fingerprint`, `fingerprint_norm`, `source_file`). Two new public
helpers are added to `tracking.py`:

```python
def find_attempt_by_fp(function_name: str, fingerprint: str,
                       fingerprint_norm: str | None = None,
                       path: Path | None = None) -> dict | None:
    """Return the MOST RECENT attempt entry matching fingerprint (raw).
    If no raw match, return the most recent entry matching fingerprint_norm.
    'Most recent' is ordered by attempt index (which is monotonic per
    function). None if no match. The returned dict includes a
    `match_type` field ('raw' or 'norm') so callers can render the
    banner header correctly."""

def increment_replay(function_name: str, attempt_index: int,
                     path: Path | None = None) -> dict:
    """Atomically bump replay_count and last_replay_ts on the entry.
    Reuses the existing file_lock; does NOT mutate outcome, note,
    classification, blocker, or no_progress_count."""
```

Existing manual `melee-agent attempts record` calls continue to work
unchanged. Manual calls without fingerprint kwargs simply append an
entry without those fields (treated as "fingerprint unknown" by future
lookups).

## Data flow: the 29-copy case under this design

1. Agent (turn 426) makes an apply_patch adding `u8 cursor_row;` to
   `mnVibration_80248644`. Runs `tools/checkdiff.py mnVibration_80248644`.
2. Pre-build: tree-sitter extracts the function body, computes
   `fingerprint=a1b2c3...`, `find_attempt_by_fp` returns None. Cached as
   "no prior match." No banner yet.
3. Build runs, objdiff produces match% = 87.2.
4. Post-build: novel branch (no prior match) → `record_attempt` writes
   attempt #1 with `fingerprint=a1b2c3..., replay_count=0,
   outcome=neutral`. Streak counter `no_progress_count` bumps to 1.
5. ~600 turns later, after a compaction event, the agent has lost the
   prior context. It re-derives the same hypothesis and applies the
   same `u8 cursor_row;` patch.
6. Runs `tools/checkdiff.py mnVibration_80248644`. Pre-build phase
   computes fingerprint `a1b2c3...`, `find_attempt_by_fp` returns
   attempt #1. Cached.
7. Build runs. Match% comes back 87.2 (same source = same result).
8. Post-build: repeat branch (fingerprint matches, match% within
   tolerance) → `increment_replay(attempt #1)` bumps `replay_count`
   from 0 to 1. No new ledger entry. Streak counter untouched.
9. Banner emitted:
   ```
   [REPEAT] this source matches attempt #1 for mnVibration_80248644
     - prior match%:    87.2   (class=, outcome=neutral)
     - current match%:  87.2   (same — verified)
     - prior agent:     pid7842, 2026-05-18 03:14:09 UTC
     - prior note:      (empty — auto-recorded)
     - repeat count:    this is the 2nd time at this fingerprint
   ```
10. Agent immediately sees "I'm back where I was" and pivots — or
    doesn't, in which case attempts 3 through 29 all hit the same
    branch and bump `replay_count` instead of creating new entries. The
    banner's "this is the Nth time" line gets louder each iteration.

The ledger growth in this scenario: 1 entry with `replay_count=28`,
instead of 29 entries. The streak counter reflects only the agent's
*genuinely distinct* experiments (incremented once at step 4), so the
`move_on_recommended` logic remains meaningful.

## Data flow: the divergent-match% case (header changed)

1. Agent records attempt #5 on `fn_8024E1B4` with body fingerprint
   `9afcad...` and match% 99.2.
2. Later, agent edits a header that this function transitively depends
   on (e.g., adds a field to a struct used inside the function).
3. Agent makes no code change to `fn_8024E1B4` itself; runs checkdiff.
4. Pre-build: fingerprint `9afcad...` matches attempt #5.
5. Build runs. Match% comes back 98.5 (changed — the header edit
   affected codegen).
6. Post-build: divergent branch (fingerprint matches, match% differs
   beyond 0.1%) → `record_attempt` writes attempt #6 with the same
   fingerprint and new match%. Both entries kept.
7. Banner:
   ```
   [DIVERGENT REPEAT] same source as attempt #5 but new outcome
     - prior match%:    99.2   (class=register-allocation)
     - current match%:  98.5   ← changed; external state differs
     - prior agent:     pid83109, 2026-05-15 22:34:17 UTC
     - prior note:      "Tried assigning aligned_100 before width..."
     - this fingerprint has produced 2 distinct match%s historically
   ```
8. Future lookups for this fingerprint will return attempt #6 (most
   recent). The "2 distinct match%s historically" count is derived by
   scanning all entries with this fingerprint.

## Edge cases & failure modes

| Case | Behavior |
|---|---|
| Function source unchanged but a header struct changed | Dedup-on-write fires (fingerprint matches), but the new `match_percent` differs from the prior one stored on the entry. The increment helper detects the divergence and, instead of just bumping `replay_count`, writes a *new* attempt entry with the same fingerprint and the new match%. The ledger thus reflects "same source → two different outcomes," a useful signal that something external changed. |
| Same code reused in another function | Different function name → different ledger entry → no collision. The per-function scoping handles this naturally. |
| tree-sitter parse failure on the TU | `extract_function_body` falls back to regex; if regex also fails, attempt is recorded without fingerprint; no repeat detection for that attempt. Logged at WARN level. |
| Function lives in `.s`-only TU (no `.c` source) | Pre-build skips fingerprinting (same as parse failure). Post-build records the attempt without fingerprint fields. Repeat detection is not available for asm-only attempts; this is acceptable since matching workflows always produce a `.c` source before checkdiff is useful. |
| Ledger corruption / lock contention | Existing `file_lock(_lock_path(ledger_path), exclusive=True)` in `tracking.py` is reused. Worst case: skip the repeat check, log a warning, run the build. |
| Different agents racing on the same function | The existing lock serializes ledger writes. Fingerprint lookups are read-only and tolerate stale snapshots — a brief race window where a concurrent attempt is missed is acceptable. |
| `function_name` is an alias (e.g., `fn_80238540` matched but agent uses original symbol) | **Deferred to v2.** Adding alias canonicalization to `tracking.py` would create a new dependency from the JSON ledger world to the SQLite `agent_state.db` world, and would need to apply to all callers (`record_attempt`, `summarize_attempts`, `find_attempt_by_fp`, the manual `attempts record` CLI) to avoid divergent keys. For v1, alias mismatch produces a known false negative: the agent gets no repeat detection if it uses a non-canonical name. Mitigation: the convention is already "use the symbol from `extract get`," which is canonical. |
| Whitespace-only edit, comment-only edit, or `clang-format` reformat | Raw fingerprint differs, normalized fingerprint matches. The banner header is `[REPEAT (semantic)]` so the agent knows the difference. Dedup-on-write still fires against the existing entry. |
| Function body identical but surrounding pragmas differ (`#pragma auto_inline off` etc.) | Known false positive — fingerprints will match but compile outputs differ. The divergent-match% branch catches this on the *second* run (writes a fresh entry tagged with the new match%), but the first pragma-changed run will produce a misleading `[REPEAT]` banner if match% happens to coincide. True fix is the v2 transitive fingerprint (include preceding pragmas in the extent). |
| `static inline` helper used only by this function is edited | Same as the pragma case — body fingerprint unchanged but compile output differs. Same mitigation: divergent match% creates a fresh entry. Deferred to v2 transitive fingerprint. |
| checkdiff is killed (SIGINT, OOM, timeout) between pre-build lookup and post-build record | Pre-build lookup is read-only; post-build record never runs. The next checkdiff invocation will re-discover the same prior entry (if any) and proceed normally. No corruption. If the kill happens on a *novel*-fingerprint attempt, no entry is written — same as today's behavior when checkdiff crashes. Future checkdiff for the same code state will treat it as the first attempt. |
| Two checkdiff invocations on the same function in parallel (different agents) | The existing `file_lock(_lock_path(ledger_path), exclusive=True)` in `tracking.py` serializes writes. Reads happen without the lock (best-effort fresh snapshot). Worst case: agent A and agent B both classify their attempt as "novel" because B's record hadn't landed when A read; A writes a second entry with the same fingerprint. The divergent-match% mechanism handles cleanup if their match%s differ; if they match, the next read sees both entries and `find_attempt_by_fp` returns the most recent (correct). |

## Testing

Unit tests for `fingerprint.py`:
- Extract function from a known TU; verify body text contains only the
  body (no signature, no surrounding code)
- Two semantically-identical functions with whitespace differences →
  same `fingerprint_norm`, different `fingerprint`
- Two functions with same body but different names → different lookups
- Tree-sitter parser load failure (simulated) → returns None, no crash;
  regex fallback engages
- Function not present in TU → returns None
- Function defined inside `#pragma` blocks → body extraction still
  works (pragmas are outside the extent)
- TU with malformed syntax (truncated file) → regex fallback engages
  or returns None gracefully

Unit tests for `tracking.py` extensions:
- `find_attempt_by_fp` returns the matching entry for raw match
- `find_attempt_by_fp` returns the matching entry for norm-only match
  (and the result includes a `match_type` discriminator)
- `find_attempt_by_fp` returns None for no match
- `find_attempt_by_fp` returns None for unknown function
- `increment_replay` bumps `replay_count` and sets `last_replay_ts`
- `increment_replay` does NOT touch `no_progress_count`,
  `move_on_recommended`, or `best_match_percent`
- `record_attempt` with fingerprint kwargs persists the fields
- `record_attempt` without fingerprint kwargs (legacy callers) works
  unchanged
- `_normalize_ledger` round-trips an extended-schema ledger without loss

Integration test for checkdiff.py:
- Uses an isolated ledger via `DECOMP_ATTEMPT_LEDGER_FILE=<tmpdir>/...`
  (env var is already supported in `tracking.py`; no test pollutes the
  real ledger)
- Test harness writes a minimal stub `report.json` + a `.c` source file
  for a fixture function (no committed `.o` files; reduces repo bloat
  and keeps fixtures human-readable)
- Drive checkdiff with `--dry-run` against the stub twice with
  identical source → first run produces no banner (read-only dry-run
  never writes); use a separate normal (non-dry-run) invocation between
  runs to populate the ledger, then re-run `--dry-run` to confirm the
  banner appears
- Drive checkdiff *without* `--dry-run` against the stub twice with
  identical source → first run produces no banner and writes a new
  ledger entry; second run produces `[REPEAT]` banner with the first
  run's outcome and bumps `replay_count` (no new entry)
- Modify the function body between runs → no banner; new entry written
- Modify only whitespace/comments → `[REPEAT (semantic)]` banner
- Stub a divergent match% via a second `report.json` → `[DIVERGENT
  REPEAT]` banner; fresh entry written
- Set `CHECKDIFF_NO_FINGERPRINT=1` → no banner, no fingerprint fields
  in recorded entry
- SIGINT mid-run (between pre-build read and post-build write): no
  partial ledger state; subsequent run behaves as if the killed one
  never happened

The `--dry-run` mode reads a cached `report.json` instead of invoking
ninja/objdiff, making the integration test fast (~100ms per case)
without needing a working build environment in CI. `--dry-run` is
strictly read-only; ledger mutations require a normal (non-dry) run.

Migration test:
- Existing `attempt_ledger.json` with attempts that have no
  `fingerprint` field → `summarize_attempts`, `record_attempt`,
  `find_attempt_by_fp`, and `increment_replay` continue to work; new
  records gain the fields without breaking old readers.

## Rollout

This is fork-internal tooling (not shipped upstream), so the rollout
can be a single PR or three sequential commits in one PR — at
implementer's discretion. Logical landing order:

1. Refactor the tree-sitter-c parser bootstrap out of
   `mwcc_debug/ast_walker.py` into
   `tools/melee-agent/src/common/tree_sitter_c.py`. Update
   `ast_walker.py` to import from the new location. No behavioral
   change; pure refactor.
2. Land `fingerprint.py` + unit tests. No behavioral change to existing
   tools.
3. Land `tracking.py` extensions — new optional kwargs on
   `record_attempt`, new `find_attempt_by_fp` and `increment_replay`
   helpers, schema tolerance verified by migration test. Still no
   caller change.
4. Land `checkdiff.py` integration: pre-build lookup, post-build
   classification (repeat / divergent / novel), banner output,
   `--no-fingerprint` flag, `CHECKDIFF_NO_FINGERPRINT` env var,
   `--dry-run` mode.

**Post-rollout observation.** After the next 3 multi-day matching
sessions (typically within 2–3 weeks given current cadence), re-run
the analysis script from the problem statement and produce a
breakdown:

- Total `[REPEAT]` banners emitted
- Of those, fraction that were *same-match%* (true repeats)
- Of those, fraction that were `fingerprint_norm`-only matches
  (whitespace/comment/reformat-only edits)
- Total `[DIVERGENT REPEAT]` banners (header/helper changes detected)
- Estimated false-positive rate from pragma/static-inline cases
  (sample: 20 random `[REPEAT]` events, manually inspect the function's
  source history for pragma changes)

Success criterion: per-session repeat rate (raw repeats / total
attempts) below 5% across both Claude and Codex sessions. Worst
single-fingerprint repeat count below 3. If the pragma false-positive
rate exceeds ~10% of all banners, prioritize the v2 transitive
fingerprint. If genuine repeats are still common, investigate Layer-3
hypothesis-level dedup.

## Future work (explicitly deferred)

- **Layer 3: hypothesis-level dedup.** Cluster `note` strings by embedding
  similarity to detect "different code, same hypothesis" repeats. Requires
  an embedding model and a similarity threshold. Defer until v1 data shows
  whether Layer 1+2 already catches most of the waste.
- **Edit-time intercept.** PreToolUse hook on Edit / apply_patch to flag
  repeats before checkdiff runs. Worth it if v1 shows the build cost
  (typically several seconds of wibo/ninja work) is a meaningful tax.
- **Transitive fingerprint.** Walk the tree-sitter AST to include
  preceding pragmas (`#pragma auto_inline off` etc.) and callees defined
  in the same TU. Catches the case where a static helper is edited but
  the caller's body is unchanged. Risk: complicates the fingerprint and
  may cause false negatives if the call-graph parse fails.
- **Cross-function "shape" dedup.** Group attempts by some normalized
  shape (e.g., AST-skeleton) to detect "this pattern was tried on similar
  functions and didn't work." Out of scope; requires a real corpus to
  validate the shape metric.

## Open questions

The design above commits to:
- **tree-sitter-c** for extraction (reusing existing project dep and the
  `_find_function_definition` helper from `ast_walker.py`)
- JSON ledger extension (per user preference), with `replay_count` /
  `last_replay_ts` for dedup-on-write
- Warn-not-block at verification time, with banner emitted *after* the
  build so it can show prior + current match% in one message
- Auto-record from checkdiff via direct in-process import (no subprocess)
- Per-host, cross-session, cross-agent scope (not cross-host)
- Function alias canonicalization deferred to v2

**Non-blocking questions for the plan:**

1. **Ledger lookup cost.** Under dedup-on-write, attempts/function
   grows roughly with the number of *distinct experiments* — not
   raw checkdiff invocations. v1 expects this to remain small
   (~30 entries/function based on pre-dedup data). Linear scan is
   fine. If observation shows a function growing past ~500 distinct
   entries, add a sidecar `fingerprint_index: {fp: attempt_index}`
   dict on the function entry, rebuilt on load.
2. **Ledger archival.** At ~350 bytes per attempt entry and dedup-on-write
   in effect, the ledger will grow to ~10MB across a few thousand
   matched functions. Tolerable, but a `melee-agent attempts archive
   --before <date>` housekeeping command may be wanted in 6+ months.
3. **Banner relative-time format.** Current spec uses absolute UTC
   timestamps. If integration testing shows the banner is hard to
   scan, add "(N hours/days ago)" suffix. Defer until observed.
4. **`DECOMP_API_BASE` switching.** A developer who switches between
   `nzxt-discord.local`, `10.200.0.1`, and `localhost:8000` (same host,
   different API endpoints) hits the same ledger — the ledger lives in
   `~/.config/decomp-me/` regardless of API base. This is the desired
   behavior; noted here so future debugging knows where to look.
