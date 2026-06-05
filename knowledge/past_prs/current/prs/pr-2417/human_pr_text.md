## PR #2417: Fix build from macOS
Author: macabeus
URL: https://github.com/doldecomp/melee/pull/2417

Currently, when trying to build it from macOS, it tries to use `wibo` in the place of `wine`.

This PR fixes it.

**Before:**
```
FAILED: [code=126] build/GALE01/src/melee/pl/plstale.o 
build/tools/wibo build/tools/sjiswrap.exe build/compilers/GC/1.2.5n/mwcceppc.exe -nowraplines -cwd source -Cpp_exceptions off -proc gekko -fp hardware -align powerpc -nosyspath -fp_contract on -O4,p -multibyte -enum int -nodefaults -inline auto -pragma "cats off" -pragma "warn_notinlined off" -RTTI off -str reuse -DBUILD_VERSION=0 -DVERSION_GALE01 -maxerrors 1 -msgstyle std -warn off -warn iserror -requireprotos -i src -i src/MSL -i src/Runtime -i extern/dolphin/include -i src/melee -i src/melee/ft/chara -i src/sysdolphin -lang=c -MMD -c src/melee/pl/plstale.c -o build/GALE01/src/melee/pl && "/Users/macabeus/ApenasMeu/decompiler/melee/.venv/bin/python3" tools/transform_dep.py build/GALE01/src/melee/pl/plstale.d build/GALE01/src/melee/pl/plstale.d
/bin/sh: build/tools/wibo: cannot execute binary file
ninja: build stopped: subcommand failed.
```

**After:**
```
[1/1] PROGRESS
Progress:
  All: 84.13% fuzzy, 63.33% matched, 34.42% linked (718 / 970 files)
    Code: 2458420 / 3882032 bytes (18081 / 19830 functions)
    Data: 462002 / 1211269 bytes (38.14%)

You have 100 out of 293 Trophies and 16 out of 51 Event Matches.
```
