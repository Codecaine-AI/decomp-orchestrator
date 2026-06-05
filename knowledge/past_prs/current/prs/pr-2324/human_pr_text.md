## PR #2324: gm: decompile fn_80170110, gm_801BEDA8, fn_8017F09C
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2324

## Summary
- `fn_80170110` in gm_16F1.c
- `gm_801BEDA8` in gm_1BA8.c
- `fn_8017F09C` in gmregclear.c

## What these functions do

**Unlock check** — Looks up a menu item by kind in the unlock table and checks whether it's accessible for a given player based on unlock flags. Routes to different unlock handlers depending on whether the item is a standard unlockable or a special category.

**Match type cycling on CSS** — On the Character Select Screen, handles scrolling through the match type selector (Time, Stock, Coin, etc.). Pressing one direction wraps forward through all 24 match types; pressing the other wraps backward. Syncs the result into the VS mode settings.

**Clear bonus calculation** — Computes the time bonus awarded for finishing a mode quickly. Multiplies the remaining timer by a stored multiplier, returning 0 if the player isn't eligible or the result would be negative.

## Verification
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2324: gm: decompile fn_80170110, gm_801BEDA8, fn_8017F09C
Author: encounter
URL: https://github.com/doldecomp/melee/pull/2324#issuecomment-4090558973

### Report for GALE01 (af6792b - a451775)

📈 **Matched code**: 59.10% (+0.02%, +880 bytes)

<details>
<summary>✅ 5 new matches</summary>

| Unit | Item | Bytes | Before | After |
| - | - | - | - | - |
| `main/melee/if/soundtest` | `un_802FFCD0` | +196 | 0.00% | 100.00% |
| `main/melee/it/items/ittincle` | `it_802EB5C8` | +188 | 0.00% | 100.00% |
| `main/melee/gm/gmregclear` | `fn_8017F09C` | +176 | 0.00% | 100.00% |
| `main/melee/gm/gm_1BA8` | `gm_801BEDA8` | +176 | 0.00% | 100.00% |
| `main/melee/gm/gm_16F1` | `fn_80170110` | +144 | 0.00% | 100.00% |

</details>

<details>
<summary>📈 16 improvements in unmatched items</summary>

| Unit | Item | Bytes | Before | After |
| - | - | - | - | - |
| `main/melee/gm/gmregclear` | `fn_8017FE54` | +199 | 0.00% | 99.94% |
| `main/melee/it/items/itclimbersice` | `itClimbersice_UnkMotion2_Coll` | +199 | 0.00% | 99.50% |
| `main/melee/gr/gryorster` | `grYorster_80202428` | +198 | 0.00% | 99.20% |
| `main/melee/gr/grhomerun` | `grHomeRun_8021EA30` | +198 | 0.00% | 99.20% |
| `main/melee/it/items/itclimbersice` | `itClimbersice_UnkMotion2_Phys` | +198 | 0.00% | 99.10% |
| `main/melee/it/items/itkyasarin` | `itKyasarin_UnkMotion2_Coll` | +195 | 0.00% | 99.82% |
| `main/melee/gm/gm_1601` | `fn_80168A6C` | +194 | 0.00% | 97.30% |
| `main/melee/it/items/itcrazyhandbomb` | `it_802F0F6C` | +194 | 0.00% | 99.47% |
| `main/melee/ft/chara/ftKirby/ftKb_SpecialN` | `fn_800F98F4` | +191 | 0.00% | 95.58% |
| `main/melee/ft/chara/ftPopo/ftPp_SpecialS` | `fn_80122B54` | +186 | 0.00% | 95.10% |
| `main/melee/gr/grrcruise` | `grRCruise_80200B48` | +184 | 0.00% | 97.98% |
| `main/melee/gr/grhomerun` | `.sdata2` | +32 | 17.14% | 42.05% |
| `main/melee/gr/grrcruise` | `.sdata` | +16 | 0.00% | 70.27% |
| `main/melee/gr/gryorster` | `.sdata2` | +9 | 33.33% | 57.14% |
| `main/melee/gr/grhomerun` | `.sbss` | +8 | 57.14% | 88.89% |
| `main/melee/it/items/itcrazyhandbomb` | `.sdata2` | +8 | 0.00% | 50.00% |

</details>

<details>
<summary>📉 2 regressions in unmatched items</summary>

| Unit | Item | Bytes | Before | After |
| - | - | - | - | - |
| `main/melee/gm/gmregclear` | `.sdata2` | -15 | 30.12% | 24.43% |
| `main/melee/it/items/itclimbersice` | `.sdata2` | -4 | 66.67% | 50.00% |

</details>
