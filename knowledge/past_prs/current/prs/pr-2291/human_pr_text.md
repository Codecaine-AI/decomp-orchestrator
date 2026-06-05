## PR #2291: it: decompile Super Scope functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2291

## Summary
- Decompile `it_80291F14` and `it_80291FA8` in `itsscope.c` (Super Scope)

Splits padding in `itSScopeAttributes` to expose `xC` float array.

## Verification
- All functions at 100% match via objdiff
- `main.dol: OK` (SHA1 verified)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
