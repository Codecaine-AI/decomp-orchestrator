## PR #2577: Attempt to resolve the mystery of HSD_JObjSetMtxDirty
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2577

Several TUs had fake HSD_JObjSet* helpers. Confusingly, many of these called ftCo_800C6AFC, unlike the real helpers, which call HSD_JObjSetMtxDirty. Why would JObj helpers call a function that lives in `ft/`?

I asked Codex to investigate this mystery. It concluded that ftCo_800C6AFC was actually HSD_JObjSetMtxDirty, just placed in the ft range when included. It managed to replace most of the fake helpers with the real deal. For the rest, it introduced WithMtxDirty variants. I pushed it hard to unify everything, but it was not able to, even after trying many different things.

Curious if anyone who knows more about this stuff could take a stab at it (either alone, or by giving better prompts to Claude/Codex than I can).

## PR #2577: Attempt to resolve the mystery of HSD_JObjSetMtxDirty
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2577#issuecomment-4618500699

apparently wrapping a macro in parens when calling it results in different behavior vs. calling it unwrapped. ‾\\\_(ツ)\_/‾

## PR #2577: Attempt to resolve the mystery of HSD_JObjSetMtxDirty
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2577#issuecomment-4618590043

Okay, well, the macro is for sure fake. I'm fine with merging the cleaned up duplicates for now, though, even if it introduces weird parentheses.
