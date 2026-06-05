## PR #2576: Match several particle functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2576

Matches four functions in `src/sysdolphin/baselib/particle.c`:

- `hsd_80393D2C`
- `hsd_803966A0`
- `hsd_80396C78`
- `fn_80397374`

The second commit keeps a shared `ps_remove_node` inline fold together, which also retains improvements in nearby partial functions. `hsd_80393D2C` is kept behind the file-local `dont_inline` pragma used elsewhere in this TU so existing callers keep the intended call shape.

Additional report improvements:

- `hsd_80395D88`
- `hsd_803962A8`
- `hsd_80396A20`
- `fn_80397814`

Verification:

- `python configure.py --require-protos`
- `ninja`
- GALE01 report shows the four listed functions at 100.0%.
