## PR #2467: Fix various literals and frame sizes
Author: lukechampine
URL: https://github.com/doldecomp/melee/pull/2467

I made two scripts: one that finds and fixes incorrect literals, and one that fixes frame sizes by adding or removing padding. I ran them on all nonmatching functions, keeping only the results that improved total match score. (There were a handful of false positives.)
