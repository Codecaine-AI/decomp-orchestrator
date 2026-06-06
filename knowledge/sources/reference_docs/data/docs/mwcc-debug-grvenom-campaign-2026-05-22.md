# mwcc-debug diff campaign: grVenom_80204284

Date: 2026-05-22

Function: `grVenom_80204284`

Source: `src/melee/gr/grvenom.c`

## Goal

Use the newly expanded `debug inspect diff` RA-input breakdown on an
actual stuck matching case, then decide whether it points to a natural
source fix or to further tooling needs.

## Baseline

`python tools/checkdiff.py grVenom_80204284`

- Match: 97.7%
- Opcode similarity: 99.0%
- Line delta: 0
- Classification: instruction-sequence
- Main real mismatch: current source keeps `gobj` in `r31` and `gp` in
  `r30`; expected code keeps `gobj` in `r30` and `gp` in `r31`.
- Remaining visible relocation mismatches are anonymous assert-string
  labels (`@456` / `@457`) versus named `grVe_804D47C0` /
  `grVe_804D47C8`. They are secondary; the register swap is real.

Baseline pcdump:

```bash
melee-agent debug dump local src/melee/gr/grvenom.c \
  --output /tmp/grvenom_base.pcdump.txt \
  --function grVenom_80204284
```

## Key proof

`debug target match-iter-first` predicted the relevant allocator order:

```text
r31 <- ig_idx 42   (virt r42, instr 1: lwz r31, 0x2c(r3)) [ambiguous]
r30 <- ig_idx 32   (virt r32, instr 0: mr r30, r3) [ambiguous]
```

Full suggested force `42,32,36,36` over-fixed the function: it corrected
the `gobj`/`gp` swap but incorrectly swapped the `src_jobj`/`dst_jobj`
callee-saves.

The narrower force was the useful result:

```bash
melee-agent debug dump local src/melee/gr/grvenom.c \
  --force-iter-first 42,32 \
  --force-iter-first-fn grVenom_80204284 \
  --diff
```

This removed all real instruction/register differences; the diff was
reduced to the anonymous assert-string relocations. This proves the
target allocator condition is specifically:

- simplify/color r42 (`gp = gobj->user_data`) before r32 (`gobj`)
- leave the rest of the allocator order natural

## What the new diff breakdown showed

Comparing baseline pcdump against the successful forced pcdump:

```bash
melee-agent debug inspect diff \
  /tmp/grvenom_base.pcdump.txt \
  /tmp/pcdump_forced_78244_1779487853924.txt \
  -f grVenom_80204284
```

Important output:

```text
Pass 6: AFTER REGISTER COLORING
  DIVERGENCE (cascade from pass 5): register allocation input-derived
  input: class 0: simplify order differs (first changed position: 0; was ig_idx 32, now ig_idx 42)
  output: class 0: coloring output: ig_idx 32: (31, 2) -> (30, 2)
  output: class 0: coloring output: ig_idx 42: (30, 2) -> (31, 2)
```

This was high-signal. The old coarse "allocator input differs" would
have left several plausible theories open. The decomposed output showed
that interference graph, coalesce mappings, and spill set were not the
interesting parts for the successful forced result. The relevant input
component is simplify order only.

## Source experiments

All source variants were compiled through the `diff_capture` source
staging helper and compared as pcdump-vs-pcdump to avoid the remote
`mwcc-inspect` path.

### No-op/tie variants

These produced no pcdump divergence from baseline:

- initialize `gp`, `src_jobj`, and `dst_jobj` at declaration
- initialize only `gp` at declaration
- cast the final `Ground_801C2FE0(gobj)` call through `HSD_GObj*`
- change `Ground_801C2FE0(gobj)` to the equivalent cast shape

These are useful negative results: simple C spelling changes do not move
the allocator order.

### Declaration-order variants

`melee-agent debug mutate decl-orders grVenom_80204284 --strategy all`

Result:

- 21 candidates
- no ordering improved by at least 0.05%
- most tied at 97.74%; a few worsened to 97.68%

Manual declaration move (`gp` after JObj locals) changed early virtual
numbering and the `dst_jobj` virtual, but final code stayed effectively
tied. The diff breakdown showed an interference-graph change for the
JObj virtual, not the desired `r42`/`r32` simplify-order correction.

### Alias / lifetime variants

Explicit alias for `gp`:

```c
Ground* gp_alias;
...
gp = GET_GROUND(gobj);
gp_alias = gp;
dst_jobj = (HSD_JObj*) ((HSD_GObj*) gp_alias->gv.venom.xC4)->hsd_obj;
```

Diff result:

```text
input: class 0: interference graph differs ...
input: class 0: simplify order differs (first changed position: 0; was ig_idx 32, now ig_idx 39)
output: ig_idx 32: (31, 2) -> (30, 2)
output: ig_idx 42: (30, 2) -> (29, 2)
```

This moved `gobj` toward `r30`, but it inserted/promoted a new virtual
that took `r31`, so it did not solve the function.

Changing later `gp->gv.venom.xC8` accesses to reload from `gobj` perturbed
later allocator input, not the leading `r42`/`r32` decision.

### Higher-level source-shape tools

`melee-agent debug suggest inlines -f grVenom_80204284 --verify --trace-copies`

- produced 8 candidates
- every verified candidate tied baseline at 97.740

`melee-agent debug mutate search -f grVenom_80204284 --budget 8`

- no safe Tier 3 targets; local bindings were demoted to low-confidence

`--include-low-confidence` produced seed plans, but stopped because the
function was not imported into decomp-permuter:

- alias seeds for `gp`, `src_jobj`, `dst_jobj`
- type-change seeds for `pad2`, `timer`, `pad`

The manually tested `gp` alias seed did not solve the allocator order.

## Tooling lessons

1. The RA-input breakdown is useful for real matching work.
   It converted this from "some allocator input changed" into "the only
   productive target is class 0 simplify order, first element r42 before
   r32."

2. `match-iter-first` plus `inspect diff` is a good force-proof loop.
   The full ambiguous suggestion over-forced; the narrow subset
   `42,32` proved the desired allocation cleanly.

3. Source-mode `inspect diff` is not the right default away from the
   Windows `mwcc-inspect` host. For remote-unavailable environments,
   campaign workflows should explicitly capture pcdumps and run
   pcdump-vs-pcdump diffs.

4. The current source tools do not yet answer "how do I naturally move
   one existing IG node to the front of simplify order?"
   Existing tools can detect and force the condition. They do not
   generate targeted source changes for this exact allocator-order
   problem.

5. Low-confidence source binding blocks `mutate search` on this function.
   That is reasonable from a safety perspective, but the tool could still
   be more useful if it offered a pcdump-targeted mode that proposes
   mutations tied to concrete IG nodes (`r42` before `r32`) rather than
   only source variable names.

## Current conclusion

The campaign does not produce a natural source fix for
`grVenom_80204284` yet.

It does prove that the function is solvable if natural source can make
the allocator simplify `gp`'s virtual r42 before `gobj`'s virtual r32.
The remaining source-search problem is narrower than before: preserve the
current pre-coloring instruction stream and allocator graph, but change
only the simplify order head from `32` to `42`.

## Suggested next tooling

Add a "simplify-order source search" workflow:

```bash
melee-agent debug mutate simplify-order \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --preserve-precolor
```

Minimum viable behavior:

- derive the current pre-coloring signature for the function
- generate bounded source variants that affect lifetime/ordinal pressure
  around the target IG nodes
- reject variants whose pre-coloring instruction stream changes beyond a
  small allowed window
- score by whether simplify order begins with the desired IG sequence
- only then run normal checkdiff

This is distinct from normal permuter scoring. The target is not match
percent first; it is preserving source structure while moving a known
allocator-order input.

## Custom-scorer candidate translation, 2026-05-24

The custom-scorer overnight run produced 167 candidates. The best saved
distance plateaued at `output-76-1` after the first half hour and did not
improve over the remaining run. The top candidates all reached the target
class-0 simplify prefix `42,32`, but their source changes clustered around
synthetic rewrites:

- `output-76-1`: introduces `volatile unsigned int new_var` and folds
  `gp->gv.venom.xC4` into the cast expression for `dst_jobj`.
- `output-79-1`: moves `Ground_801C3BB4()` before the JObj setup and splits
  `timer + 1` into two field stores.
- `output-82-1`: moves `Ground_801C39C0()` before the JObj setup and splits
  `timer + 1` into `xC8 = 1; xC8 = timer + xC8;`.
- `output-83-1`: combines an xC4 temp with moving `Ground_801C2FE0(gobj)`
  into the `xC8 == 0x3C` branch, which is not behavior-preserving.
- `output-84-1`: introduces a volatile xC4 temp and wraps the
  `grVenom_80203EAC(1)` assignment in `do { } while (0)`.

Manual translation tests were run against `src/melee/gr/grvenom.c` using
`melee-agent debug dump local --no-cache-sync --keep-obj ... --diff`, then
scored with `melee-agent debug target score-simplify-order --json` against
the same `42,32` target. The real source file was restored after each
temporary variant.

| Translation tested | Result |
| --- | --- |
| Baseline source | prefix `0/2`, observed `[32, -1]`, precolor distance `0` |
| Direct xC4 fold through `GET_GROUND(gobj)` | prefix `0/2`, distance `0` |
| Clean non-volatile xC4 temp | prefix `0/2`, distance `0` |
| Non-volatile xC4 assignment inside the cast | prefix `0/2`, distance `68` |
| Volatile xC4 temp, separate assignment | prefix `0/2`, distance `32` |
| Volatile xC4 assignment inside the cast | prefix `0/2`, distance `0` |
| Move `Ground_801C39C0()` earlier only | prefix `0/2`, distance `0` |
| Move `Ground_801C3BB4()` earlier only | prefix `0/2`, distance `0` |
| Split timer as `xC8 = timer; xC8 = xC8 + 1;` | prefix `0/2`, distance `20` |
| Split timer as `xC8 = 1; xC8 = timer + xC8;` | prefix `2/2`, observed `[42, 32]`, distance `21` |
| Clean `output-82` combination: move `Ground_801C39C0()` early plus the `xC8 = 1; xC8 = timer + xC8;` split | prefix `2/2`, observed `[42, 32]`, distance `21` |
| `do { } while (0)` around `grVenom_80203EAC(1)` | prefix `0/2`, distance `0` |
| Clean `output-84` combination: xC4 temp plus `do { } while (0)` | prefix `0/2`, distance `0` |
| Cleaned `output-83` call movement | prefix `0/2`, distance `19`; rejected as not behavior-preserving |

The only low-distance target hit was the `output-82` timer-store split. More
natural spellings of the same source intent did not preserve the simplify
order:

| Timer spelling tested | Result |
| --- | --- |
| `++gp->gv.venom.xC8` | prefix `0/2`, distance `20` |
| `gp->gv.venom.xC8++` | prefix `0/2`, distance `20` |
| `gp->gv.venom.xC8 += 1` | prefix `0/2`, distance `20` |
| `gp->gv.venom.xC8 = 1 + timer` | prefix `0/2`, distance `0` |
| `timer += 1; gp->gv.venom.xC8 = timer` | prefix `0/2`, distance `0` |
| `gp->gv.venom.xC8 = 1; gp->gv.venom.xC8 += timer` | prefix `2/2`, distance `21` |

Conclusion: the custom scorer successfully found the allocator objective, and
the smallest observed precolor disturbance is modest (`21`). However, the
load-bearing source feature is a redundant store to `gp->gv.venom.xC8` that
does not look like developer-written source. The cleaner source translations
of the top candidate clusters either keep the original prefix `[32, -1]` or
require non-natural two-store code to reach `[42, 32]`.

This campaign should be treated as a Tier-6 structural ceiling for now:
permuter can reach the desired simplify order for `grVenom_80204284`, but the
observed path depends on synthetic source features rather than a plausible
source rewrite suitable for committing.

## Manual translation survey (2026-05-24, follow-up)

The first custom-scorer writeup proved the `output-82` timer-store split, but
it did not make the per-candidate stripping results explicit. This follow-up
re-tested the top five candidates in the real `grvenom.c` translation unit,
preserving candidate-local declaration placement where relevant. Each variant
was compiled with:

```bash
melee-agent debug dump local src/melee/gr/grvenom.c \
  --function grVenom_80204284 \
  --no-cache-sync \
  --keep-obj /tmp/grvenom_followup_survey/<variant>.o \
  -o /tmp/grvenom_followup_survey/<variant>.o.pcdump.txt \
  --diff
```

and scored with:

```bash
melee-agent debug target score-simplify-order \
  --function grVenom_80204284 \
  --target nonmatchings_custom_scorer/nonmatchings/grVenom_80204284/simplify_order_target.yaml \
  --json /tmp/grvenom_followup_survey/<variant>.o
```

Baseline remained prefix `0/2`, observed `[32, -1]`, distance `0`, match
`97.7%`.

| Candidate | Structural change | Synthetic features identified | Clean translations attempted | Simplify order result | Distance |
| --- | --- | --- | --- | --- | --- |
| `output-76-1` | Introduces an xC4 temp and folds the temp assignment into the `dst_jobj` cast. | `volatile unsigned int`, assignment inside cast, temp whose only use is the cast. | Exact body with candidate declaration placement; strip only `volatile`; keep `volatile` but split assignment from cast; direct developer fold through `GET_GROUND(gobj)->gv.venom.xC4`. | All variants stayed prefix `0/2`, observed `[32, -1]`. The real-TU translation does not reproduce raw permuter output `76`. | `0`, `110`, `32`, `0` |
| `output-79-1` | Moves `Ground_801C3BB4()` before the JObj setup and splits `timer + 1` into two stores. | Behavior-suspicious call movement, redundant `xC8 = timer; xC8 = xC8 + 1`, imported-source return-type noise outside this function body. | Exact structural body; call move only; timer split only; named intermediate `s32 t = timer; xC8 = t + 1`. | All variants stayed prefix `0/2`, observed `[32, -1]`. | `20`, `0`, `20`, `0` |
| `output-82-1` | Moves `Ground_801C39C0()` before the JObj setup and splits `timer + 1` as `xC8 = 1; xC8 = timer + xC8`. | Redundant two-store rewrite; call movement is suspicious but not required. | Exact structural body; call move only; timer split only; `s32 t = timer; xC8 = t + 1`; `(u8)(timer + 1)`; `(s32) timer + 1`; `*(volatile s32*) &timer + 1`; `s32 t = 1; xC8 = timer + t`; `xC8 = 1; xC8 += timer`; timer load before the Ground calls. | Target prefix `2/2`, observed `[42, 32]`, only for the redundant field-store forms: exact body, timer split only, and `xC8 = 1; xC8 += timer`. All cleaner locals/casts/position changes stayed prefix `0/2`; the volatile timer load moved to `[41, 32]`, not the target. | Hits: `21`; misses: `0`, `18`, `147`, `10` depending on variant |
| `output-83-1` | Adds an xC4 temp and moves `Ground_801C2FE0(gobj)` into the `xC8 == 0x3C` branch while removing the final call. | `volatile int` temp, behavior-changing call movement/removal, temp only used for the cast. | Exact structural body; strip only `volatile`; keep volatile temp only; plain temp only; call move only. | All variants stayed prefix `0/2`, observed `[32, -1]`. The call movement is not behavior-preserving, so these were attribution probes only. | `34`, `19`, `33`, `0`, `19` |
| `output-84-1` | Adds an xC4 temp and wraps the `grVenom_80203EAC(1)` assignment in `do { } while (0)`. | `volatile unsigned long` temp, no-op `do/while`, temp only used for the cast. | Exact structural body; strip only `volatile`; keep volatile temp only; `do/while` only; developer `HSD_GObj* ground_gobj` intermediate plus `do/while`. | All variants stayed prefix `0/2`, observed `[32, -1]`. | `32`, `0`, `32`, `0`, `0` |

The important attribution result is that the real-TU versions of outputs 76,
83, and 84 do not preserve their raw permuter simplify-order score even when
their synthetic features are kept. That suggests some imported-source context
or declaration noise outside the manually translated function body also
contributed to those raw custom-scorer scores. For source work in `grvenom.c`,
those candidates did not yield a useful clean pattern.

### Combinations tested

- Direct xC4 fold from `output-76` plus the `output-82` timer split:
  prefix `2/2`, observed `[42, 32]`, distance `21`.
- Early `Ground_801C3BB4()` from `output-79` plus the `output-82` timer
  split: prefix `2/2`, observed `[42, 32]`, distance `21`.
- Developer `HSD_GObj* ground_gobj` xC4 intermediate plus the `output-82`
  timer split: prefix `2/2`, observed `[42, 32]`, distance `21`.

These combinations show that the extra structural changes are mostly
orthogonal. They do not improve the distance or create a cleaner target hit;
the redundant `xC8` two-store remains the load-bearing part.

### Lifetime / position probes

- `if (gp == NULL) return;` after `GET_GROUND(gobj)`: prefix `0/2`,
  observed `[32, -1]`, distance `0`.
- `if (dst_jobj == NULL) return;` after the xC4 JObj load: prefix `0/2`,
  observed `[32, -1]`, distance `34`.
- Developer `HSD_GObj* ground_gobj` intermediate for the xC4 object:
  prefix `0/2`, observed `[32, -1]`, distance `0`.
- Real second use of `gp` after the Ground calls: prefix `0/2`, observed
  `[32, -1]`, distance `0`.
- Local `next_timer = timer + 1; xC8 = next_timer`: prefix `0/2`, observed
  `[32, -1]`, distance `0`.
- Forced volatile load from `timer`: prefix `0/2`, observed `[41, 32]`,
  distance `147`.

The function is sensitive to some developer-plausible shape changes, but none
of those non-synthetic probes moved the simplify head to `42`. The volatile
timer-load probe is especially useful: forcing an extra load can move the first
entry near the target, but it still does not reproduce the redundant-store
effect.

### Standalone two-store retest

The two-statement form from the survey was re-applied as the only source
change:

```c
gp->gv.venom.xC8 = 1;
gp->gv.venom.xC8 += timer;
```

This is a plausible source spelling, not inherently synthetic: it can be read
as "initialize the field to one, then accumulate the current timer." The earlier
writeup over-classified this as permuter noise.

`python configure.py && ninja` could not complete because the worktree still
has an unrelated dirty `src/melee/mn/mnmain.c` syntax error. The targeted
`tools/checkdiff.py grVenom_80204284 --no-tty --format summary` run did compile
and verify this exact source fingerprint:

```text
function=grVenom_80204284 match=false match_percent=97.74 classification=stack-layout
```

The mwcc-debug score confirmed the allocator target still moves in the desired
direction:

```text
prefix 2/2, observed [42, 32], precolor distance 21
```

However, the match percentage did not improve over baseline. The remaining
gap is not only simplify order and not a cosmetic relocation/assert issue.
`debug inspect diff` against the baseline pcdump shows the earliest divergence
before global optimization: the compact baseline expression emits
`addi r55,r34,1; stw r55,200(r38)`, while the two-store source emits
`li; stw; lwz; add; stw`. The register-coloring input then changes as intended
(`32` first becomes `42` first), but the final code still contains the extra
load/store/add sequence and shifted branch offsets.

## Full-pool triage (2026-05-24)

The previous surveys inspected the best simplify-order candidates, not the full
custom-scorer pool ranked by the real objective. Running:

```bash
melee-agent debug permute triage \
  /Users/mike/code/melee/nonmatchings_custom_scorer/nonmatchings/grVenom_80204284 \
  -f grVenom_80204284 \
  --top 20
```

against the real source tree changed the conclusion. The log is
`/tmp/grVenom_triage_full_20260524T183758Z.log`.

Triage baseline was `97.74%`. It evaluated 172 candidates, found 4 winners,
and had 62 build failures. The top real-tree results were:

| Candidate | Real-tree match | Delta | Notes |
| --- | ---: | ---: | --- |
| `output-180-1` | `100.00%` | `+2.26%` | Winner; raw candidate contains several alias/temp artifacts, but reduces to a small source-plausible alias. |
| `output-199-1` | `99.27%` | `+1.53%` | Partial; xC4 temp, preloaded timer, spawned-object temp, no-op `do { } while (0)`, and integer temp for the `4` argument. |
| `output-147-1` | `98.94%` | `+1.20%` | Partial; void temp for `hsd_obj`, inline `GET_JOBJ(gobj)`, and an extra repeated `xC8 = timer + 1` inside the spawned-object block. |
| `output-184-1` | `98.67%` | `+0.93%` | Partial; pointer-to-`hsd_obj` temp, `grVenom_GroundVars*` field alias, and object/temp aliases. |

The raw `output-180-1` function body looked noisy: it introduced aliases for
`gp`, `dst_jobj`, `other_gobj`, and the threshold comparison, used a bitwise
form of `timer > 0`, and ended with an empty `if (!other_gobj) {}`. Isolation
showed most of that was not load-bearing. The final empty `if`, bitwise
condition, JObj comma assignment, spawned-object temp, and threshold temp can
all be stripped.

The minimal matching translation is:

```c
Ground* cur_gp;

gp = GET_GROUND(gobj);
src_jobj = GET_JOBJ(gobj);
cur_gp = gp;
dst_jobj = (HSD_JObj*) ((HSD_GObj*) cur_gp->gv.venom.xC4)->hsd_obj;
```

with the rest of the function left in its original source shape. This verifies
with:

```text
function=grVenom_80204284 match=true match_percent=93.92 classification=relocation-label-only
```

The reported percent is low because the remaining raw diff is relocation-label
noise; `checkdiff` classifies it as a match after normal name-magic. A direct
`debug dump local --diff` shows only anonymous `@456/@457` relocation labels
where the expected object names are `grVe_804D47C0` and `grVe_804D47C8`.

This result also corrects the simplify-order hypothesis. The matching
`cur_gp` fix does not preserve the `42,32` target that drove the custom scorer;
its scorer result is prefix `0/2`, observed `[39, 32]`, precolor distance `64`.
The full-pool triage found the real fix because it measured actual match
transfer, not just the simplify-order proxy.

### Final conclusion

`grVenom_80204284` is matched by introducing a second `Ground*` local alias for
the early xC4 JObj load. The earlier Tier-6/no-source framing was wrong: the
answer was in the custom-scorer pool, but it was not one of the top candidates
by simplify-order distance.

The durable lesson is that simplify-order scoring is useful for surfacing
allocator-sensitive source shapes, but it is not a complete objective. Future
campaigns should run real-tree `debug permute triage` over the full candidate
pool before drawing structural conclusions from proxy scores alone.
