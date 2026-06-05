## PR #2301: ftKb_SpecialN: match 3 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2301

## Summary
- `ftKb_SpecialHi1_Anim`
- `ftKb_SpecialAirS_Enter`
- `ftKb_EatJump1_Anim`

## Verification
- All functions verified 100% match via objdiff during overnight run
- `ninja` builds cleanly

## What these functions do
Three **Kirby** special move callbacks. `SpecialHi1_Anim` handles the transition in **Final Cutter** from the rising slash to the downward plunge (switches to `SpecialAirHi2` when the animation ends). `SpecialAirS_Enter` initiates **Hammer** in the air, applying a one-time vertical momentum boost on the first airborne use. `EatJump1_Anim` manages Kirby's floaty jump while holding a swallowed opponent.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
