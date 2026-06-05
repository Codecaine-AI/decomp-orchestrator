## PR #2344: Decompile 9 fighter, library, game, and menu functions
Path: src/melee/mn/mnname.c
URL: https://github.com/doldecomp/melee/pull/2344#discussion_r2970215570
Author: PsiLupan

This lacks a `#pragma push` before it followed by `#pragma pop` at the end of the function, so it's incorrectly affecting all functions in the file.

Hunk:
```diff
@@ -245,7 +245,37 @@ f32 mnName_80238964(u8 index, u8 target, u8 flag)
     }
 }
 
-/// #mnName_80238A04
+#pragma dont_inline on
```

## PR #2344: Decompile 9 fighter, library, game, and menu functions
Path: src/melee/mn/mnname.c
URL: https://github.com/doldecomp/melee/pull/2344#discussion_r2971624959
Author: johnwinston

Fixed — added `#pragma push` / `#pragma pop` wrapping.

Hunk:
```diff
@@ -245,7 +245,37 @@ f32 mnName_80238964(u8 index, u8 target, u8 flag)
     }
 }
 
-/// #mnName_80238A04
+#pragma dont_inline on
```
