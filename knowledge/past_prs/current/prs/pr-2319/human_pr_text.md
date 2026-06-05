## PR #2319: Match 4 fighter functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2319

## Summary
- `ftKb_SpecialN_800F1420` in ftKb_Init.c
- `ftCh_Init_80157170` in ftCh_Init.c
- `ft_800C0098` in ftcolanim.c
- `fn_800DC070` in ftCo_Attack100.c

## What these functions do

**Kirby's copy ability** — Updates the diffuse color on Kirby's copied character hat model, used when tinting the hat appearance.

**Crazy Hand** — Initiates Crazy Hand's heavy damage flinch animation when he takes a big hit in Boss mode.

**Fighter color overlays** — Clears a fighter's spycloak color animation and optionally re-applies it when the Cloaking Device effect is active.

**Grab escape** — When a grabbed fighter breaks free by jumping, sets the escape velocity and enters the CaptureJump animation.

## Verification
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
