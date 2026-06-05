## PR #2504: lb: improve lbmthp matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2504

## Summary
- Type lbmthp static data, THP decode state, and movie-player file/buffer fields.
- Match several lbmthp helpers and replace literal/assert data references with named static data.
- Fix the THPVideoDecode pointer signature/call site used by lb.

## Test Plan
- python configure.py --wrapper wine && ninja
