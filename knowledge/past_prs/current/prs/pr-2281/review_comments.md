## PR #2281: it: decompile 24 item functions
Path: src/melee/it/itCommonItems.h
URL: https://github.com/doldecomp/melee/pull/2281#discussion_r2934007399
Author: ribbanya

This is wrong; create a new `ItemVars` union for each type of Pokémon.

Hunk:
```diff
@@ -646,14 +654,24 @@ typedef struct itKamexAttributes {
 typedef struct {
     s16 x0;
     u8 padding[0xE34 - 0xDD8];
-    s32 timer;
-    int x64;
-    f32 x68;
-    f32 x6C;
+    union {
+        s32 timer;
+        f32 timer_f;
+    };
+    union {
+        int x64;
+        f32 x64_f;
+    };
+    union {
+        int x68;
+        f32 x68_f;
+    };
```
