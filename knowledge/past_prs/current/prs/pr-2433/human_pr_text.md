## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Author: malvarezcastillo
URL: https://github.com/doldecomp/melee/pull/2433

Decompile the main per-frame update for the Snap menu. Large state-machine switch (cases 0–23) handling slot selection, photo browsing, dialog confirmations, and copy/move/delete card operations. Function is 99.373% match.

Also fixes two `mnsnap.h` prototypes (`mnSnap_8025409C` arg type, `mnSnap_8025441C` return type) and declares the `"jobj.h"` / `"jobj"` SDATA assert strings.
