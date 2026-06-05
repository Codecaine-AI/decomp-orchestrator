## PR #2501: lb: improve lbshadow matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2501

Improves lbshadow spline tangent and shadow update matching.

Functions:
- lbShadow_8000E9F0: 95.80645%
- lbShadow_8000F38C: 99.69586%

Verification:
- python configure.py && ninja
- tools/checkdiff.py lbShadow_8000E9F0
- tools/checkdiff.py lbShadow_8000F38C
