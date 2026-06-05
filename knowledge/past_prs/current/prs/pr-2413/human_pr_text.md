## PR #2413: Fix various function signatures
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2413

I had Claude write a script that infers types by examining asm. It's not perfect and definitely returned a lot of false negatives and false positives, but it also found a lot of legitimate mismatches.

(no real point committing the script; it was actually three scripts, all vibecoded and thus surely hideous, and most of what it reports now is garbage anyway)
