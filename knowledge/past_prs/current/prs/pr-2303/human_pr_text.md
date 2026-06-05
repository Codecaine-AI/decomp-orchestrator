## PR #2303: gm/mn: match 4 functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2303

## Summary
- `fn_8018846C`
- `mn_80232458`
- `mnName_GetPageCount`, `mnName_GetColumnCount`, `mnName_802388D4`

## Verification
- All functions verified 100% match via objdiff during overnight run
- `ninja` builds cleanly

## What these functions do
Menu and game-mode utilities. `fn_8018846C` is a game-state callback in the results/ranking screen flow. `mn_80232458` handles logic in the **Rules** menu screen. The three `mnName` functions support the **Name Entry** screen — `GetPageCount` and `GetColumnCount` calculate pagination for the 120-slot name list (pages of 24, columns of 6), and `802388D4` is a layout callback for rendering the scrollable name grid.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
