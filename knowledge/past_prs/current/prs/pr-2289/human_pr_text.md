## PR #2289: ft: decompile Kirby & Ice Climbers special moves
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2289

## Summary
- Decompile 5 functions in `ftKb_SpecialNNs.c` (Kirby copying Ness neutral-B)
- Decompile 2 functions in `ftKb_SpecialNZd.c` (Kirby copying Sheik neutral-B)
- Decompile 5 functions in `ftKb_SpecialNPk.c` (Kirby copying Pikachu/Bowser neutral-B)
- Decompile 5 functions in `ftPp_SpecialS.c` (Ice Climbers up-B and down-B)

## Verification
- All functions at 100% match via objdiff
- `main.dol: OK` (SHA1 verified)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
