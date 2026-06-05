## PR #2249: grmaterial: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2249

## Summary
- Decompile `grMaterial_801C9490`, `grMaterial_801C9698`, `grMaterial_801C9604` — 100% match

## Verification
- `ninja` builds clean
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2249: grmaterial: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2249#issuecomment-4034543793

Will fix pointer math soon

## PR #2249: grmaterial: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2249#issuecomment-4034980182

The pointer math in `grMaterial_801C9490` (`(u8*) gp + 0xC0`) and `grMaterial_801C9604`/`grMaterial_801C9698` (`(u8*) gp + 0x40` cast to `ColorOverlay*`) can't be replaced with struct field access — the material system overlays a `ColorOverlay` (0x80 bytes) at Ground offset 0x40, reusing the `self_vel`/`cur_pos`/padding region. Offset 0xC0 sits in unnamed padding before the GroundVars union. Fixing this would require adding a union around the 0x40–0xC3 region of the shared `Ground` struct, which is non-trivial. --Claude

## PR #2249: grmaterial: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2249#issuecomment-4056020200

Consolidated into other PRs
