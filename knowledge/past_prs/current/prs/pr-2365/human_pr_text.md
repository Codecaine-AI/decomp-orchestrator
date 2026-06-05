## PR #2365: Item and Pokemon decompilation matches
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2365

## Summary
- 17 matched functions across 11 item/Pokemon files

## What these functions do

**ithitodeman.c — `it_802D48B0`** — Smoothly accelerates or decelerates Staryu toward a target speed, controlling how it homes in on opponents after being released from a Poke Ball.

**ithitodeman.c — `it_2725_Logic24_Spawned`** — Initializes Staryu when it spawns from a Poke Ball, setting its lifetime, clearing tracking variables, and playing its cry.

**itmewtwoshadowball.c — `it_802C5B18`** — Launches Mewtwo's Shadow Ball after release, setting its travel animation and speed based on charge level.

**itmewtwoshadowball.c — `itMewtwoshadowball_UnkMotion8_Anim`** — Updates Shadow Ball each frame by scaling its visual model to match charge size and checking if it should despawn.

**itclimbersice.c — `it_802C16F8`** — Fires Ice Climbers' Ice Shot forward, setting its velocity, spawning the frosty visual effect, and enabling its hitbox.

**itclimbersice.c — `itClimbersice_UnkMotion3_Phys`** — Applies gravity and air friction to Ice Shot while airborne after bouncing, scaling damage based on speed.

**itclimbersice.c — `it_2725_Logic90_HitShield`** — Handles Ice Shot bouncing off a shield, reducing velocity and lifetime, destroying it below a threshold.

**itpatapata.c — `itPatapata_UnkMotion4_Phys`** — Applies gravity and wing wobble to Butterfree as it floats down after being KO'd, making it look like fluttering.

**itoldottosea.c — `itOldottosea_UnkMotion2_Phys`** — Moves the Octarok stage hazard forward, fires a rock projectile at the player, and adjusts walking direction for terrain.

**itseakneedlethrown.c — `itSeakneedlethrown_UnkMotion4_Anim`** — Spins Sheik's thrown needle as it flies, saving position each frame for trail rendering.

**itseakneedlethrown.c — `itSeakneedlethrown_UnkMotion1_Anim`** — Updates Sheik's thrown needle by saving position, applying spin rotation, and checking for despawn.

**itflipper.c — `it_80290938`** — Spawns a Flipper item at a joint's position, initializes it with zero velocity, and attaches it.

**itlugia.c — `it_802D1A44`** — Transitions Lugia into its Aeroblast attack phase, setting up the beam trajectory from its mouth to the target.

**itkamex.c — `it_2725_Logic31_Spawned`** — Initializes Blastoise when it spawns from a Poke Ball, setting lifetime, starting idle animation, and shrinking to entry scale.

**ittincle.c — `it_802EBA00`** — Transitions Tingle into his balloon inflation hover state, zeroing velocity and computing vertical bounce acceleration.

**itmatadogas.c — `itMatadogas_UnkMotion2_Phys`** — Applies floating physics to Weezing and transitions it to its idle poison gas state when landed.

**itkirbycutterbeam.c — `it_8029BB90`** — Sets up Kirby's Final Cutter shockwave projectile, computing travel angle and velocity from attack state.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
