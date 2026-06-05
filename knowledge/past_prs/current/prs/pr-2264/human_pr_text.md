## PR #2264: gmregclear: match 2 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2264

## Summary
Decompile 2 functions — all 100% match:
- `fn_8017DE54` (gmregclear)
- `fn_8017F14C` (gmregclear)

## Verification
- `ninja` builds clean
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2264: gmregclear: match 2 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2264#issuecomment-4034541088

Will fix pointer math soon

## PR #2264: gmregclear: match 2 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2264#issuecomment-4034979912

The pointer math in `fn_8017F14C` (`*(s32*) ((u8*) arg0 + 0x98)`) can't be replaced with struct field access — the parameter is `void*` with no known callers in decomped code, so we don't know the actual struct type. Offset 0x98 falls within unnamed padding in the closest candidate struct. --Claude

## PR #2264: gmregclear: match 2 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2264#issuecomment-4056021532

Consolidated into other PRs
