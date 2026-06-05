## PR #2290: it: decompile item functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2290

## Summary
- Decompile `it_802CE710` and `itUnknown_UnkMotion0_Anim` in `itunknown.c` (Unown)
- Decompile `itPatapata_UnkMotion4_Anim` and `it_802E15B0` in `itpatapata.c` (Butterfree)
- Decompile `it_802EBE5C`, `itTincle_UnkMotion7_Anim`, `it_802EC4D0`, `it_802EC9E8` in `ittincle.c` (Tingle)
- Decompile `itOldottosea_UnkMotion2_Coll` in `itoldottosea.c` (Goldeen)

Splits padding in `itTincle_ItemVars`, `itTincleAttributes`, `itPatapata_ItemVars`, `itPatapataAttributes`, and `itUnknownAttributes` to expose fields needed by the new functions.

## Verification
- All functions at 100% match via objdiff
- `main.dol: OK` (SHA1 verified)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
