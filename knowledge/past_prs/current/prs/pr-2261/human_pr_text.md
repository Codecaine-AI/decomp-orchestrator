## PR #2261: items: match 20 more item functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2261

## Summary
Decompile 20 item functions — all 100% match:
- `it_2725_Logic101_Reflected` (itmewtwoshadowball)
- `it_2725_Logic32_Spawned`, `it_2725_Logic33_Spawned` (itmatadogas)
- `it_3F14_Logic7_EnteredAir`, `fn_80281734` (itdosei)
- `it_802D2F70`, `itHouou_UnkMotion3_Phys` (ithouou)
- `it_802DF9F8` (itzgshell)
- `it_802E3400` (itwhitebea)
- `it_802EC3F4`, `itTincle_UnkMotion7_Coll` (ittincle)
- `itGamewatchchef_UnkMotion1_Anim` (itgamewatchchef)
- `itHitodeman_UnkMotion2_Phys` (ithitodeman)
- `itKyasarin_UnkMotion0_Anim`, `itKyasarin_UnkMotion0_Coll`, `itKyasarin_UnkMotion2_Anim`, `itKyasarin_UnkMotion4_Anim` (itkyasarin)
- `itMewtwoshadowball_UnkMotion8_Phys` (itmewtwoshadowball)
- `itOldkuri_UnkMotion0_Phys`, `itOldkuri_UnkMotion1_Coll` (itoldkuri)
- `itOldottosea_UnkMotion7_Anim` (itoldottosea)

## Verification
- `ninja` builds clean
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
