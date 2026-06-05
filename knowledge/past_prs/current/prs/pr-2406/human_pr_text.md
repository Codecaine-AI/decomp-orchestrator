## PR #2406: it: 10 match progress (items, 100%)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2406

Split from #2345 — item-related 100% matches only.

## Matches

| File | Function | Status |
|------|----------|--------|
| `ithitodeman.c` | `itHitodeman_UnkMotion1_Anim` | 100% |
| `itkabigon.c` | `it_802CA074` | 100% |
| `itkamex.c` | `it_802CAE94` | 100% |
| `itkirbycutterbeam.c` | `itKirbycutterbeam_UnkMotion0_Phys` | 100% |
| `itmewtwoshadowball.c` | `itMewtwoshadowball_UnkMotion17_Anim` | 100% |
| `itnessyoyo.c` | `itNessyoyo_UnkMotion3_Phys` | 100% |
| `itoldottosea.c` | `it_802E27B4` | 100% |
| `itpatapata.c` | `it_802E16F8` | 100% |
| `itrshell.c` | `itRshell_UnkMotion5_Anim` | 100% |
| `itzgshell.c` | `itZrshell_UnkMotion6_Phys` | 100% |

## What Claude thinks these functions do

- **`itHitodeman_UnkMotion1_Anim`** (Staryu) — Per-frame anim tick for Staryu's motion-1 state. Decrements a float "time left" (`x8C`) each frame; when it hits zero, decrements an integer "repeats remaining" (`x88`) and resets the timer, or returns true (transition) when both run out.

- **`it_802CA074`** (itkabigon / Snorlax) — Snorlax Pokemon transition helper. Shows the jobj (clears flag `0x10`), switches to motion state 1, wires up `efLib_Pause/ResumeAll` as the hitlag callbacks, zeros Y velocity, sets uniform XYZ scale from `itemVar.kabigon.x68`, and plays sfx `0x2724`.

- **`it_802CAE94`** (itkamex / Koffing) — Koffing scale-up tick: if the jobj's X scale is below 1.0, reads the current scale, adds `0.06` to all three axes, and writes it back.

- **`itKirbycutterbeam_UnkMotion0_Phys`** (Kirby Cutter Beam) — Physics tick for the cutter beam projectile. Saves the initial position, derives X/Y velocity from `speed` and `angle` via `cosf`/`sinf` scaled by `facing_dir`, and applies a vertical displacement.

- **`itMewtwoshadowball_UnkMotion17_Anim`** (Mewtwo Shadow Ball) — Pulse-scale animation during the charged shadow ball's travel state. Sets the grandchild jobj scale to the per-frame value at `itemVar.mewtwoshadowball.x10`, and if the hitbox is active also rescales it to `x64`, then defers to `it_80273130` for the default anim update.

- **`itNessyoyo_UnkMotion3_Phys`** (Ness Yoyo) — Physics tick for yoyo's returning state. Identity-matrix-concats with the second `ItemLink` joint's matrix to extract its world position, runs hit detection via `it_802BF800`, and on hit zeros the velocity and snaps the first link's pos to Ness's `yoyo_hitbox_pos`.

- **`it_802E27B4`** (itoldottosea / Octorok) — Octorok launch helper. Zeros all three velocity components, resets counter `x24`, sets `mpCollSetFacingDir` based on `facing_dir == -1`, and (if `x2C` is set) spawns a freeze-effect item at `pos + attr->x14 * facing_dir` via `it_8028EB88`, then chooses motion state 1 or 2.

- **`it_802E16F8`** (itpatapata / Paratroopa) — Paratroopa spawn helper. Spawns item kind `0xD4` at `pos` with initial velocity from `it_803B8708`, sets facing direction / collision facing, stores `arg0` as a mode at `patapata.x40`, optionally runs motion state 0 + jobj anim, configures motion state 1, wires up the `jumped_on` callback to `it_802E0F1C`.

- **`itRshell_UnkMotion5_Anim`** (Red Shell) — Red shell motion-5 anim tick. Returns true to transition once `xDD4` runs out; otherwise decrements `xDD4` and `xDD8` (when non-zero), fires `it_80275444` on the frame `xDD8` hits zero (and the `b5` flag is clear), and calls `it_8028CFE0` when in motion state 5.

- **`itZrshell_UnkMotion6_Phys`** (Z-shell) — Per-frame physics for the green-shell motion-6 state. When `|vel.x|` drops below the attr's `x8` threshold, runs the slow-down cleanup (`it_8026B390` / `it_802725D4` / `it_802754D4`). When it drops below the stricter `x30` threshold, zeros velocity and either transitions to motion state 0 or back to the bouncing state via `it_80277040`.
