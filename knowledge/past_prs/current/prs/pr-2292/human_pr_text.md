## PR #2292: gr/gm: decompile stage and game functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2292

## Summary
- Decompile `grCastle_801CE860` and `fn_801D0924` in `grcastle.c` (Hyrule Castle)
- Decompile `grOnett_801E3CE4` in `gronett.c` (Onett)
- Decompile `fn_8017E318`, `gm_8017E7FC`, `gm_80180B18`, `gm_80181A44` in `gmregclear.c` (adventure mode)

## Verification
- All functions at 100% match via objdiff
- `main.dol: OK` (SHA1 verified)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
