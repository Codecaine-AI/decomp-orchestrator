## PR #2276: ft: decompile 9 fighter functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2276

## Summary
- Decompile `ftCh_TagRockPaper_Anim`, `ftCh_Slam_Anim`, `ftCh_GrabUnk1_8015B670` in ftCh_Init
- Decompile `ftCo_Rebirth_Cam` in ft_0D31
- Decompile 5 functions in ftPp_SpecialS

## Test plan
- [x] `ninja` builds successfully
- [x] `ninja diff` shows no regressions
- [x] All functions are 100% matches in objdiff

🤖 Generated with [Claude Code](https://claude.com/claude-code)
