## PR #2248: grcastle: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2248

## Summary
- Decompile `grCastle_801CD960`, `grCastle_801CF750`, `fn_801CFAFC` — 100% match

## Verification
- `ninja` builds clean
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2248: grcastle: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2248#issuecomment-4034545536

Will fix pointer math soon

## PR #2248: grcastle: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2248#issuecomment-4034974200

The pointer math in `grCastle_801CD960` and `grCastle_801CF750` can't be easily replaced with struct field access — the castle GroundVars struct doesn't have named fields at these offsets (0xE0 is typed as a 4-byte pointer but the code treats it as an inline array of 0x14-byte elements, and 0xCF750 shifts the Ground pointer itself by `idx * 16`). Would need structural changes to the shared Ground/GroundVars types to fix properly. Happy to do that if you'd prefer, but wanted to flag it as non-trivial. --Claude

## PR #2248: grcastle: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2248#issuecomment-4056023214

Consolidated into other PRs
