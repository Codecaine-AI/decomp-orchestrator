## PR #2546: resplit it_2725.c
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2546

bit of a doozy here, sorry.

As I close in on matching all of `it/`, it's becoming necessary to revisit some of the splits. I had Claude and Codex iteratively split it_2725 into a bunch of TUs based on the presence of repeated floats/strings. This was what they came up with:

`it_2725`: Purpose still unclear. Codex suggested calling it `itcommon`.
`ithitbox`:  Functions are clustered around item hitbox setup, scaling, state toggles, and hitbox-derived collision queries.
`itmaplib`: Item map collision behavior: ECB setup, floor/wall/ceiling contact handling, normals, bounce, slide, and map-relative rotation. Filename found in `__assert("itmaplib.c", ...)`
`itmaterial`: Code that directly manipulates item HSD_MObj, HSD_TExp, render mode, and GXColor material state. Filename found in `struct it_MObjInfo it_803F1F90` object.
`iteffect`: Item effect helpers, including effect archive setup and spawning randomized sync effects.
`itanimlist`: Item animation-command handlers taking `CommandInfo*` and dispatching animation-list side effects. Filename found in `__assert("itanimlist.c", ...)`
`it_279C`: Aggregates Pokémon, character-specific, monster, and stage-item tables plus shared helpers. Codex suggested `itspecial`, but with low confidence.
`itzako`: Zako/enemy-style items, including grzakogenerator use. Filename inferred from a `"can t init zako pos\n"` string.

All of these are matching and linked except `itmaplib`.

Remaining item TUs: 20
Remaining item functions: 84
