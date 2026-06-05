## PR #2484: Match HSD_ByteCodeEval
Path: src/sysdolphin/baselib/bytecode.c
URL: https://github.com/doldecomp/melee/pull/2484#discussion_r3221043907
Author: itsgrimetime

idk why codex insisted on renaming this everywhere. can clean up if preferred

Hunk:
```diff
@@ -158,57 +165,57 @@ float HSD_ByteCodeEval(u8* bytecode, float* args, int nb_args)
             break;
         case 0x0C:
             HSD_ASSERT(405, stack);
-            fv = HSD_Randf();
```
