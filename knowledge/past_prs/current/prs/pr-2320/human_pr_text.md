## PR #2320: Match 2 misc functions (lb, mn)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2320

## Summary
- `lbAudioAx_80024DC4` in lbaudio_ax.c
- `mnName_8023749C` in mnname.c

## What these functions do

**Sound engine** — Registers a sound channel into the audio pool. When a sound is already playing, refreshes its priority so it doesn't get dropped. When it's a new sound, finds an open slot in the 16-channel pool and claims it.

**Name entry screen** — Appends a string terminator byte to a name tag entry when the player finishes typing a name.

## Verification
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
