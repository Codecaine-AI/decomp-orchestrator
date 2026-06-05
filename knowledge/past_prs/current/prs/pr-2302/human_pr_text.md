## PR #2302: grkinokoroute: match 2 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2302

## Summary
- `grKinokoRoute_802084B4`
- `grKinokoRoute_80208660`

## Verification
- All functions verified 100% match via objdiff during overnight run
- `ninja` builds cleanly

## What these functions do
Two **Mushroom Kingdom** stage callbacks. These handle event-driven logic for the stage's moving platforms and hazard spawning routes — checking conditions to trigger platform transitions and camera updates as players move through the stage.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
