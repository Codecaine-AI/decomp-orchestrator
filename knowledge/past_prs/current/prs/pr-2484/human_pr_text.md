## PR #2484: Match HSD_ByteCodeEval
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2484

Matches HSD_ByteCodeEval in sysdolphin/baselib/bytecode.c.

Verification:
- ninja -j8
- pre-commit run clang-format --files src/sysdolphin/baselib/bytecode.c src/sysdolphin/baselib/bytecode.h src/sysdolphin/baselib/robj.c
- pre-commit run --files src/sysdolphin/baselib/bytecode.c src/sysdolphin/baselib/bytecode.h src/sysdolphin/baselib/robj.c
