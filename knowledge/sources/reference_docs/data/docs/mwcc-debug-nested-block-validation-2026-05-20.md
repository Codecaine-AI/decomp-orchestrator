# Nested-block per-scope ordinal validation — 2026-05-20

Tested 4 functions for the Phase-1 bridge's per-scope ordinal heuristic.

## Methodology

For each candidate function, manually correlate AST `LocalDecl`s
(in source order, grouped by scope) against `observed_virtuals`
from the AFTER PEEPHOLE FORWARD pre-coloring pass.

The per-scope ordinal model predicts: MWCC numbers ALL locals (top-level
and nested) in a single flat sequence starting at virtual r32+n (where n
is the parameter count). Top-level decls claim r32+n through r32+n+T-1;
nested-block decls continue in source order from r32+n+T onward.

For each nested decl with a non-`-1` predicted virtual, we check whether
the first-def instruction in the pcdump for that virtual matches the
source decl's semantic identity (e.g. the decl's initializer expression,
or a load from the same object/field described in source).

### Candidate selection

Functions chosen had at least 1 nested-block decl and were distributed
across three TU pcdumps. All were in the `mn/` module.

| TU | Function | Top-level decls | Nested decls | pcdump source |
|----|----------|----------------|--------------|---------------|
| mnvibration.c | fn_80248A78 | 16 | 6 | /tmp/mnvibration_pcdump.txt |
| mnvibration.c | fn_80247510 | 13 | 2 | /tmp/mnvibration_pcdump.txt |
| mnname.c | fn_80239574 | 9 | 4 | /tmp/mnname_pcdump.txt |
| mnevent.c | fn_8024D864 | 12 | 1 | /tmp/mnevent_pcdump.txt |

All pcdumps were generated with `melee-agent debug pcdump-local` (wibo +
mwcc_debug DLL).

## Confounding observation: extra-virtuals red flag

A significant confounding factor emerged: **all 4 candidate functions
triggered the `extra-virtuals` red flag** (observed virtual count
substantially exceeds param + local count). The gap between expected and
observed virtuals ranged from 40 to 177. This means:

- The sequential cursor model is already known to be unreliable for
  these functions (it breaks down even for top-level locals when MWCC
  creates intermediate CSE/IV virtuals that shift the slot assignment).
- The `ambiguous-nested` confidence label is thus "doubly correct":
  these functions are ambiguous both because they have nested decls AND
  because they have extra compiler-introduced virtuals.

The per-scope ordinal model, strictly speaking, tests whether nested-block
decls continue the sequential numbering after top-level decls. In the
presence of extra-virtuals, neither claim can be validated cleanly.

## Per-function results

### fn_80248A78 (mnvibration.c)

**Source:** 1 param (`arg0`), 16 top-level locals, 6 nested locals in
three separate nested scopes (frame==14.0f branch has 4 at depth 3; a
loop counter at depth 3 elsewhere; a `proc` pointer at depth 2 near end
of function).

**Red flags:** `extra-virtuals` (63 observed vs 23 expected).

**Bridge predictions for nested decls** (sequential cursor continues from
after top-level walk):

| Decl | Line | Bridge predicts | Actual first-def | Match? |
|------|------|----------------|-----------------|--------|
| data2 | 861 | r49 | r37 (B73: `lwz r37,44(r32)`) | NO |
| data3 | 862 | -1 (ambiguous) | r66 (B83) | N/A |
| assets | 863 | -1 (ambiguous) | r87 (B73: address of mnVibration_804A0868) | N/A |
| loaded_joint | 864 | r52 | r34 (B77: `mr r34,r89`) | NO |
| i | 782 | r53 | r38 (B8: `li r38,0`) | NO |
| proc | 897 | r54 | none (stays in physical r3) | NO |

Nested decls with concrete bridge predictions: 4. Correct: 0. **Score: 0/4.**

**Explanation:** The frame==14 branch allocates virtuals r37, r87, r43,
r34 for the four named nested decls. These are scattered through the high
virtual number space, not sequentially after the 16 top-level locals. The
sequential model predicts r49–r54, which are all in a different range used
by jobj-traversal intermediate registers in the frame==10–13 branches.

### fn_80247510 (mnvibration.c)

**Source:** 1 param (`gobj`), 13 top-level locals, 2 nested locals
(`exit_data` in the B-button handler block, `temp_jobj` in the per-port
A-button loop).

**Red flags:** `extra-virtuals` (193 observed vs 16 expected). This is
the most complex function in the TU — large switch-like dispatch with many
per-port copies of the same code, generating hundreds of compiler-introduced
intermediates.

**Bridge predictions for nested decls:**

| Decl | Line | Bridge predicts | Actual first-def | Match? |
|------|------|----------------|-----------------|--------|
| exit_data | 186 | r46 | r170 (B41: `lwz r170,44(r169)`) | NO |
| temp_jobj | 215 | r47 | r99 (B41: `lwz r99,104(r170)`) | NO |

Bridge predictions: 2. Correct: 0. **Score: 0/2.**

**Explanation:** The compiler assigns r170 and r99 to `exit_data` and
`temp_jobj` respectively, well above the range the bridge predicts (r46,
r47). r46 is actually a (u8)-masked version of the loop counter `i` (used
as `var_ctr` after subtraction), and r47 is `data->user_data` loaded at
function entry. The sequential model fails because the 193 observed
virtuals are dominated by per-port CSE copies.

### fn_80239574 (mnname.c)

**Source:** 1 param (`arg0`), 9 top-level locals, 4 nested locals
(two named `jobj` in different nested scopes, plus `text` and `idx`).

**Red flags:** `extra-virtuals` (59 observed vs 14 expected).

**Bridge predictions for nested decls:**

| Decl | Line | Bridge predicts | Actual first-def | Match? |
|------|------|----------------|-----------------|--------|
| jobj (line 981) | 981 | r42 | r42 (B17: `mr r42,r54`) | YES |
| text | 1046 | -1 (ambiguous) | r45 (B68) | N/A |
| idx | 1047 | -1 (ambiguous) | r36 (B68) | N/A |
| jobj (line 1009) | 1009 | r45 | r45 (B68: `lwz r45,64(r53)`) | YES |

Bridge predictions: 2. Correct: 2. **Score: 2/2.**

**Explanation:** Both hits appear coincidental rather than principled.
The first `jobj` at line 981 (`(HSD_JObj*) data->gobj.next_gx`) gets r42,
which happens to be the 10th slot (cursor=10 = 32+10 = 42). The second
`jobj` at line 1009 (same expression) gets r45 = cursor=13. But `text`
and `idx` are already flagged ambiguous by the bridge (cursor not in
observed set), and the extra-virtuals flag indicates the model is
unreliable for this function. The two hits are consistent with coincidence
given that r42 and r45 are lower-numbered virtuals that happen to align
with the cursor positions.

### fn_8024D864 (mnevent.c)

**Source:** 1 param (`gobj`), 12 top-level locals, 1 nested local
(`max_events` in the XButton handler block, line 456).

**Red flags:** `extra-virtuals` (137 observed vs 14 expected).

**Bridge predictions for nested decls:**

| Decl | Line | Bridge predicts | Actual first-def | Match? |
|------|------|----------------|-----------------|--------|
| max_events | 456 | r45 | r100 (B29: `mr r100,r3`) | NO |

Bridge predictions: 1. Correct: 0. **Score: 0/1.**

**Explanation:** `max_events = mnEvent_8024CE74()` is assigned at B29
from the call return value r3 → r100. The bridge predicts r45 = cursor
position 13 (after 12 top-level locals). r45 in the pcdump is first-def'd
at B132 (`mr r45,r153`), which corresponds to a different `gm_801BEBA8`
call return value. The XButton handler's `max_events` virtual (r100) is
far outside the predicted range.

## Aggregate results

| Function | Nested decls | Bridge predictions | Correct | Score |
|----------|-------------|-------------------|---------|-------|
| fn_80248A78 | 6 | 4 | 0 | 0/4 |
| fn_80247510 | 2 | 2 | 0 | 0/2 |
| fn_80239574 | 4 | 2 | 2 | 2/2 |
| fn_8024D864 | 1 | 1 | 0 | 0/1 |
| **Total** | **13** | **9** | **2** | **22%** |

## Decision

Aggregate correct-match rate for nested-decl predictions: **22%**.

The 80% threshold for promotion is not met.

**Decision: KEEP `ambiguous-nested` confidence label. No promotion.**

### Root cause analysis

The per-scope ordinal model fails for nested-block decls for a structural
reason: **nested decls appear in late-numbered virtual slots, not
sequentially after top-level slots**. The compiler introduces many
intermediate virtuals between each conceptual source variable. In functions
with complex control flow (multi-path dispatch, per-element loops), the
observed virtual count is 10–12x the expected count, and the slot for a
nested decl depends on the CSE/IV pattern of the entire function, not on
declaration order.

The two "hits" in fn_80239574 are consistent with coincidence: both nested
`jobj` decls happen to get virtuals that fall at the sequential cursor
positions, but the same function has two other nested decls that are
`-1` (ambiguous). If the model were reliable, we'd expect all four to hit.

### Phase 2 guidance

A better algorithm for nested-block decls would need to:
1. Identify the nested block's entry block in the CFG.
2. Find the first virtual-destination instruction in that block that
   corresponds to a decl with an initializer.
3. Walk decls in that scope in source order and match them to
   first-defs in the block order.

This per-block-entry search is not implemented in Phase 1. Keep
`ambiguous-nested` until a block-entry heuristic is validated.
