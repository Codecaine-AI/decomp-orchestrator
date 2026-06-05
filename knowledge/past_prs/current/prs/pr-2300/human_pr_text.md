## PR #2300: it: match 14 item functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2300

## Summary
- `itClimbersice_UnkMotion0_Anim` (48 bytes)
- `it_802C84A0`, `itGamewatchchef_UnkMotion0_Coll`, `itGamewatchchef_UnkMotion1_Coll` (40–80 bytes)
- `it_802B211C`, `it_802B22B8` (56–72 bytes)
- `it_2725_Logic17_Spawned`, `itLugia_UnkMotion2_Phys`, `it_802D1DD8` (28–64 bytes)
- `it_2725_Logic18_Spawned`, `itHouou_UnkMotion2_Phys`, `it_802D2B4C`, `it_802D2C78` (28–80 bytes)
- `it_802D73F0` (140 bytes)

## Verification
- All functions verified 100% match via objdiff during overnight run
- `ninja` builds cleanly

## What these functions do
Pokeball summon callbacks for **Lugia** and **Ho-Oh** — spawn initialization, physics during flight, and the damage-on-contact logic that fires when they sweep across the stage. The **Goomba** (`itOldkuri`) initializer resets velocity and picks a patrol direction when spawning on Mushroom Kingdom. **Ice Climbers' ice block** (`itClimbersice`) handles the animation tick for the frozen projectile. **Mr. Game & Watch's chef** (`itGamewatchchef`) sausage projectiles get their collision callbacks for bouncing off platforms. The **Pikachu Thunder** (`itpikachuthunder`) functions handle the lightning bolt's downward travel logic.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
