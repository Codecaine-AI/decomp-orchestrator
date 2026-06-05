## PR #2262: fighters: match 6 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2262

## Summary
Decompile 6 fighter functions — all 100% match:
- `ftKb_SpecialNMt_80106FEC` (ftKb_SpecialNZd)
- `ftKb_SpecialNFx_800FDC00` (ftKb_SpecialNPk)
- `ftKb_LgSpecialN_Coll`, `ftKb_LgSpecialAirN_Coll` (ftKb_SpecialN)
- `ftPp_SpecialHi_80122898` (ftPp_SpecialS)
- `ftCh_Slap_Anim` (ftCh_Init)

## Verification
- `ninja` builds clean
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
