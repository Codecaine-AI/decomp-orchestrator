## PR #2294: Fix a bunch of near-matches
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2294

I noticed a lot of recent matches were nearly 100%, but had wrong data values, like calling the wrong function or passing the wrong float literal. I had Claude search the codebase for these and fix some of the easier ones. Later I wrote a script to find all functions that only have wrong `bl` instructions, and fixed those.

I'm not sure how these errors were introduced, but my guess is that they were produced by agents that either did not use `m2c` as a starting point, or did not use `functionRelocDiffs=data_value` when diffing.

## PR #2294: Fix a bunch of near-matches
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2294#issuecomment-4063339257

Does our match reporting not care about data values? There are a lot more fixes here than what the bot says. 🤔
