## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: zalo
URL: https://github.com/doldecomp/melee/pull/2373

## Summary

First contribution from an AI-assisted decompilation pipeline. Scoped to **100% byte-perfect matches only**, per reviewer feedback.

8 functions verified as 100% matches against the NTSC 1.02 target binary using objdiff:

| Function | File | Description |
|----------|------|-------------|
| `ftCh_Damage2_Anim` | ftCh_Init.c | Crazy Hand motion state enum fix (`ftMh_MS_Damage` → `ftMh_MS_Damage2`) |
| `grIceMt_801F7F1C` | gricemt.c | Ground material loop |
| `grIceMt_801F81B4` | gricemt.c | Ground material loop variant |
| `grIceMt_801F929C` | gricemt.c | Stage animation state machine |
| `fn_801F9338` | gricemt.c | Ground collision callback |
| `fn_801F9448` | gricemt.c | Ground collision callback variant |
| `it_802D747C` | itoldkuri.c | Item state change sequence |
| `grPura_80212290` | grpura.c | Stage setup function |

## Changes from previous revision

Addressed all reviewer feedback from @ribbanya:

1. **Removed all non-100% functions** — the previous revision included partial improvements with pointer math. This revision contains only byte-perfect matches.
2. **Removed automated Copilot review** — understood, won't include in future PRs.
3. **Noted feedback on `jobj.h` inlines and `M2C_FIELD`** — will incorporate into our pipeline for future submissions.

## Verification

- `ninja` builds successfully with matching DOL SHA1
- `melee-issues` (`cargo run -p melee-issues`): 0 new issues introduced (7 pre-existing issues in unrelated files)
- EditorConfig: trailing whitespace fixed
- All 8 functions verified 100% via objdiff before submission

## Tool

Built with [decomp-research-ai](https://github.com/sh1ftmaker/decomp-research-ai) — an agentic pipeline using m2c, Ghidra, objdiff, and decomp-permuter. Happy to answer any questions about the approach.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: zalo
URL: https://github.com/doldecomp/melee/pull/2373#issuecomment-4172858562

Hi @ribbanya, thank you for the detailed feedback — really appreciate you taking the time to review this.

I've updated the PR to address each of your points:

**1. Pointer math removed** — I've stripped out all the partial-match functions that relied on raw pointer arithmetic. This revision now contains only 8 functions that are verified 100% byte-perfect matches. Some of those matched functions do still use pointer-style access to achieve the match — I understand that's not ideal and will work on teaching the pipeline to use `M2C_FIELD` or proper struct field access for future submissions.

**2. `jobj.h` inlines** — Noted and logged. I'll work on recognizing `HSD_ASSERT` patterns with string + line number as inline boundaries from `jobj.h` so the pipeline uses the existing inlines rather than reimplementing the assertion logic.

**3. Automated code reviews** — Removed and won't include going forward. Makes total sense.

I also ran `cargo run -p melee-issues` locally — no new issues introduced by this change (the 7 it reports are all pre-existing in unrelated files). Trailing whitespace has been fixed as well.

This is my first time contributing to a decomp project, so I'm still learning the conventions and quality bar. I'll keep future PRs tightly scoped to clean matches while I improve the tooling. Thanks again for your patience!

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: zalo
URL: https://github.com/doldecomp/melee/pull/2373#issuecomment-4173366291

@BR- Thank you for the tips — these are really helpful!

1. **`--no-casts`** — Great call, I'll switch our m2c invocations to use this so we get `M2C_FIELD` instead of raw pointer casts. That's a much better starting point for the AI to work from.

2. **`--union-field GroundVars:icemt`** — Noted, will add this for ground stage files. Are there other common union fields we should be aware of for other modules?

3. **Variable naming** — Agreed, `gp`/`jobj`/`fp` are much more readable than `temp_rN`. I'll update the prompts to prefer semantic names matching the conventions in surrounding code.

4. **GroundVars** — Yeah, we noticed those were tricky. The `--union-field` flag should help a lot there.

Will incorporate all of this into the pipeline. Thanks again!

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: BR-
URL: https://github.com/doldecomp/melee/pull/2373#issuecomment-4174092078

1. Ah, I was mistaken. It's `--valid-syntax` that generates `M2C_FIELD`. I use both.
```c
void* arg1;

if ((s16) arg1->unk0 != 0) // default
if (arg1->unk0 != 0) // --no-casts
if ((s16) M2C_FIELD(arg1, s16*, 0) != 0) // --valid-syntax
if (M2C_FIELD(arg1, s16*, 0) != 0) // --valid-syntax --no-casts
```

2. FighterVars, ItemVars are the other major ones.
3. Placeholder names are preferred if it's not obvious what the var is, but there's a bunch of easy names (gp, jobj, i ,...) that help imo
4. There's specifically something going on with offsets near xF8 where the types don't align. `grIceMt_801F87FC` treats it as a `HSD_GObj*`, `fn_801F9338` treats it as a `s16`. Given that `grIceMt_GroundVars2` stops at xF4, I think most likely there's some `s16` data at the end of icemt2 that we haven't filled in yet.

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: zalo
URL: https://github.com/doldecomp/melee/pull/2373#issuecomment-4178426017

@BR- Thanks for the correction and the additional detail!

1. **`--valid-syntax --no-casts`** — Got it, updated the pipeline to use both together. Makes sense now: `--valid-syntax` is what actually generates `M2C_FIELD()`, `--no-casts` cleans up the surrounding casts.

2. **FighterVars, ItemVars** — Added automatic `--union-field` detection for all three major unions based on source path (`/gr/` → GroundVars, `/ft/` → FighterVars, `/it/` → ItemVars).

3. **Variable naming** — Understood, updated the prompts to use semantic names when clear (`gp`, `jobj`, `i`) but stick with placeholders when the purpose isn't obvious.

4. **xF8 struct gap** — Really helpful context. Knowing that `grIceMt_GroundVars2` stops at xF4 with unmapped data after it explains the type ambiguity we were hitting. We'll keep this in mind when working on gricemt functions in the future.

All incorporated into the pipeline and docs. Looking forward to putting these improvements to work on the next batch!

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Author: PsiLupan
URL: https://github.com/doldecomp/melee/pull/2373#issuecomment-4382831028

Closing this PR, since most of the changes here have been covered by other PRs.
