## PR #2581: Improve matching in Melee source files
Author: fjooord
URL: https://github.com/doldecomp/melee/pull/2581

## Summary
- Improve matching across a batch of `src/melee` source files.
- Fix the regressions reported by the saved-baseline comparison.
- Add a strict local regression gate so `changes`/`changes_all` fail when any unit, section, or function metric moves backward.

## Validation
- Clean PR worktree at `ff551b3`
- Baseline from `dae3629`
- `python3 configure.py --require-protos`
- `ninja changes_all`

## Expected / local run
This is the local saved-baseline report for the pushed PR commit. CI is expected to confirm the same no-regression result.

### Report for GALE01 (dae3629 - ff551b3)

**Matched code**: 70.39% (+0.24%, +9176 bytes)
**Matched data**: 41.33% (+0.06%, +712 bytes)

<details>
<summary>13 new matches</summary>

| Unit | Item | Bytes | Before | After |
| - | - | - | - | - |
| `main/melee/if/if_2FC93` | `fn_802FDA78` | +355 | 82.48% | 100.00% |
| `main/melee/ft/ftafterimage` | `.data` | +208 | 0.00% | 100.00% |
| `main/melee/gr/grkinokoroute` | `.data` | +27 | 88.68% | 100.00% |
| `main/melee/gr/grkongo` | `.rodata` | +25 | 60.87% | 100.00% |
| `main/melee/if/if_2FC93` | `un_802FE260` | +21 | 93.25% | 100.00% |
| `main/melee/ft/ftchangeparam` | `ftCo_800CF6E8` | +17 | 99.69% | 100.00% |
| `main/melee/if/ifstock` | `.sdata2` | +13 | 82.26% | 100.00% |
| `main/melee/gr/grkongo` | `.sdata` | +7 | 69.39% | 100.00% |
| `main/melee/mn/mnmain` | `.sdata` | +3 | 96.97% | 100.00% |
| `main/melee/if/if_2FC93` | `.sdata` | +2 | 86.67% | 100.00% |
| `main/melee/mp/mplib` | `mpGetSpeed` | +0 | 99.98% | 100.00% |
| `main/melee/gm/gmstaffroll` | `fn_801AA854` | +0 | 99.95% | 100.00% |
| `main/melee/gr/grcorneria` | `grCorneria_801DD534` | +0 | 99.98% | 100.00% |
</details>

<details>
<summary>0 broken matches</summary>

No entries.
</details>

<details>
<summary>123 improvements in unmatched items</summary>

| Unit | Item | Bytes | Before | After |
| - | - | - | - | - |
| `main/melee/mp/mplib` | `.data` | +3040 | 60.80% | 94.04% |
| `main/melee/gm/gmresult` | `fn_80175DC8` | +2751 | 8.23% | 93.22% |
| `main/melee/gm/gm_18A5` | `fn_8018B090` | +1450 | 63.37% | 86.71% |
| `main/melee/gr/grkongo` | `grKongo_801D7134` | +1408 | 0.27% | 95.13% |
| `main/melee/gm/gmresult` | `fn_80174B4C` | +940 | 10.70% | 91.99% |
| `main/melee/gr/grcorneria` | `grCorneria_801DED50` | +896 | 66.01% | 96.49% |
| `main/melee/gr/grvenom` | `grVenom_80205F30` | +769 | 62.22% | 94.69% |
| `main/melee/gr/grgreens` | `grGreens_8021483C` | +620 | 5.46% | 83.31% |
| `main/melee/if/ifstock` | `ifStock_802F7EFC` | +604 | 18.30% | 83.62% |
| `main/melee/mn/mnvibration` | `fn_80247510` | +546 | 73.75% | 92.37% |
| `main/melee/mn/mndiagram` | `mnDiagram_80240D94` | +544 | 58.58% | 97.35% |
| `main/melee/mn/mnnamenew` | `mnNameNew_MainInput` | +497 | 67.63% | 89.22% |
| `main/melee/ft/chara/ftCommon/ftCo_09F7` | `ftCo_8009F834` | +485 | 73.50% | 96.06% |
| `main/melee/gr/grmutecity` | `grMuteCity_801F1A34` | +402 | 85.78% | 96.66% |
| `main/melee/gm/gm_1BA8` | `gm_801BAD70` | +396 | 73.49% | 89.11% |
| `main/melee/ft/chara/ftCommon/ftCo_Attack100` | `fn_800DAADC` | +388 | 1.39% | 97.38% |
| `main/melee/mn/mndiagram3` | `fn_802461BC` | +386 | 85.31% | 98.42% |
| `main/melee/gr/grkongo` | `grKongo_801D6AFC` | +378 | 54.34% | 78.09% |
| `main/melee/gr/grgreens` | `grGreens_802166C4` | +365 | 56.87% | 83.45% |
| `main/melee/if/textlib` | `un_80302FFC` | +359 | 53.17% | 85.89% |
| `main/melee/gm/gm_16F1` | `fn_801701C0` | +358 | 91.77% | 97.41% |
| `main/melee/gm/gm_1601` | `fn_80161154` | +339 | 68.73% | 80.52% |
| `main/melee/gm/gm_1BFA` | `gm_801BFCFC` | +323 | 43.75% | 94.19% |
| `main/melee/if/ifstock` | `ifStock_802F8298` | +311 | 69.74% | 86.20% |
| `main/melee/ft/chara/ftCommon/ftCo_0A01` | `ftCo_800A4038` | +306 | 79.01% | 95.65% |
| `main/melee/gr/grkongo` | `grKongo_801D577C` | +299 | 73.91% | 88.21% |
| `main/melee/gr/grpura` | `grPura_802125F0` | +299 | 76.25% | 93.22% |
| `main/melee/gr/grrcruise` | `grRCruise_80201588` | +286 | 60.11% | 91.43% |
| `main/melee/ft/chara/ftCommon/ftCo_0A01` | `ftCo_800A6700` | +258 | 59.97% | 87.98% |
| `main/melee/ft/chara/ftCommon/ftCo_0A01` | `ftCo_800A7AAC` | +258 | 46.59% | 62.81% |

...and 93 more
</details>

<details>
<summary>0 regressions in unmatched items</summary>

No entries.
</details>
