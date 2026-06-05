## PR #2278: gm/gr/ty: decompile 5 misc functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2278

## Summary
- Decompile `gm_80180BA0` and `fn_8017DE54` in gmregclear
- Decompile `grOldPupupu_80211C1C` in groldpupupu
- Decompile `fn_801CFAFC` in grcastle
- Decompile `un_8031BB34` in tydisplay

## Test plan
- [x] `ninja` builds successfully
- [x] `ninja diff` shows no regressions
- [x] All functions are 100% matches in objdiff

🤖 Generated with [Claude Code](https://claude.com/claude-code)
